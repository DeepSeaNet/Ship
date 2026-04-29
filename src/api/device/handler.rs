use std::sync::Arc;

use super::types::custom_mls::credentials::DeviceCredential;
use super::types::extensions::group_config::GroupConfig;
use super::types::extensions::group_config::group_extension::{
    GroupConfigExtension, UPDATE_GROUP_CONFIG_PROPOSAL_V1, UpdateGroupConfigProposal,
};
use super::types::group::MlsGroup;
use super::types::signature_bytes::UploadKeyPackagesTBS;
use mls_rs::group::CommitEffect;
use mls_rs::group::proposal::{MlsCustomProposal, Proposal};
use mls_rs::{MlsMessage, group::ReceivedMessage};
use mls_rs_codec::MlsDecode;
use mls_rs_codec::MlsEncode;
use moka::future::{Cache, CacheBuilder};
use std::time::Duration;
use tauri::AppHandle;

use super::connection::Backend;
use super::connection::group_microservice;
use super::types::message::UserGroupMessage;

use super::mls_client::MlsClient;
use super::types::errors::GroupError;
use super::types::group::{GroupId, GroupStorage};
use crate::api::account::Account;
use crate::commands::events::{
    emit_join_group_event, emit_message_delivery_event, emit_new_group_config,
    emit_text_message_event, emit_welcome_message_event,
};

pub struct GroupHandler {
    pub user_id: u64,
    pub client: MlsClient,
    pub groups: GroupStorage,
    pub backend: Backend,
    pub app_handle: Option<AppHandle>,
    pub device_id: String,
    pub account: Arc<Account>,
    sender_credential_cache: Cache<u32, DeviceCredential>,
}

impl GroupHandler {
    pub fn new(
        user_id: u64,
        client: MlsClient,
        groups: GroupStorage,
        backend: Backend,
        app_handle: Option<AppHandle>,
        device_id: String,
        account: Arc<Account>,
    ) -> Self {
        let sender_credential_cache = CacheBuilder::new(10_000)
            .time_to_live(Duration::from_secs(60 * 10))
            .build();
        Self {
            user_id,
            client,
            groups,
            backend,
            app_handle,
            device_id,
            account,
            sender_credential_cache,
        }
    }

    fn extract_group_config(&self, group: &MlsGroup) -> Result<GroupConfig, GroupError> {
        let current_context = group.context();
        let current_config: Option<GroupConfigExtension> =
            current_context.extensions.get_as().map_err(|e| {
                GroupError::ExtensionError(format!("Failed to get group config extension: {}", e))
            })?;

        let config_extension = current_config.ok_or(GroupError::ConfigurationNotFound)?;
        Ok(config_extension.config)
    }

    async fn sign_tbs<T: MlsEncode>(&self, tbs: &T) -> Result<Vec<u8>, GroupError> {
        let tbs_bytes = tbs
            .mls_encode_to_vec()
            .map_err(|e| GroupError::EncodingError(format!("TBS encoding failed: {}", e)))?;
        self.account.sign_message(&tbs_bytes).await
    }

    async fn upload_key_packages(&self) -> Result<(), GroupError> {
        let key_package = self
            .client
            .generate_key_package_message(Default::default(), Default::default(), None)
            //.await
            .map_err(|e| GroupError::MlsError(format!("Key package generation failed: {}", e)))?;
        let key_package_bytes = key_package.mls_encode_to_vec().map_err(|e| {
            GroupError::EncodingError(format!("Failed to encode key package: {}", e))
        })?;

        let tbs = UploadKeyPackagesTBS {
            user_id: self.user_id,
            device_id: self.device_id.clone(),
            key_packages: vec![key_package_bytes.clone()],
        };

        let signature = self.sign_tbs(&tbs).await?;
        self.backend
            .upload_key_packages(
                self.user_id,
                self.device_id.clone(),
                vec![key_package_bytes],
                signature,
            )
            .await
            .map_err(|e| GroupError::BackendError(format!("Key package upload failed: {}", e)))
    }

    async fn join(&self, welcome_message: &MlsMessage) -> Result<GroupId, GroupError> {
        let (mut group, _) = self.client.join_group(None, welcome_message, None)
            //.await
            ?;

        group.write_to_storage()
            //.await
            ?;
        let group_config = self.extract_group_config(&group)?;

        let group_id = GroupId::new(group.group_id().to_vec());
        self.groups.insert(group_id.clone(), group).await;
        if let Some(app_handle) = &self.app_handle {
            emit_join_group_event(app_handle, &group_config, &group_id).await?;
        }
        // Upload a fresh key package after consuming one for the welcome join
        self.upload_key_packages().await?;

        log::info!("Joined group with ID: {:?}", group_id);
        Ok(group_id)
    }

    pub async fn process_incoming_message(&self, message: MlsMessage) -> Result<(), GroupError> {
        let group_id = GroupId::new(
            message
                .group_id()
                .ok_or(GroupError::InvalidMessage("Missing group ID".to_string()))?
                .to_vec(),
        );

        let group_arc = self.groups.get(&group_id).await?;
        let mut group = group_arc.write().await;
        let received_message = group
            .process_incoming_message(message)
            //.await
            .map_err(|e| {
                log::error!("Failed to process incoming message: {:#}", e);
                GroupError::MessageProcessingError(e.to_string())
            })?;

        self.process_received_message(received_message, &group)
            .await
            .map_err(|e| {
                log::error!("Failed to process received message: {:#}", e);
                GroupError::MessageProcessingError(e.to_string())
            })?;

        group.write_to_storage()
            //.await
            ?;

        Ok(())
    }

    /// Processes a received message and extracts user content
    async fn process_received_message(
        &self,
        received_message: ReceivedMessage,
        group: &MlsGroup,
    ) -> Result<(), GroupError> {
        match received_message {
            ReceivedMessage::ApplicationMessage(app_msg) => {
                let message = UserGroupMessage::from_bytes(app_msg.data())
                    .map_err(|e| GroupError::MessageDecodingError(e.to_string()))?;

                let group_config = self.extract_group_config(group)?;

                let sender_cred = if let Some(cached) = self
                    .sender_credential_cache
                    .get(&app_msg.sender_index)
                    .await
                {
                    cached
                } else {
                    let sender = group.member_at_index(app_msg.sender_index).unwrap();
                    let sender_credential = sender.signing_identity.credential.as_custom().unwrap();
                    let parsed = DeviceCredential::mls_decode(&mut &*sender_credential.data)?;
                    self.sender_credential_cache
                        .insert(app_msg.sender_index, parsed.clone())
                        .await;
                    parsed
                };

                if !group_config.has_permission(sender_cred.device_id.user_id, "send_messages") {
                    return Err(GroupError::ConfigError(
                        "User is not allowed to send messages".to_string(),
                    ));
                }
                if group_config.is_muted(sender_cred.device_id.user_id) {
                    return Err(GroupError::ConfigError("User is muted".to_string()));
                }

                log::info!("Processed application message: {:?}", message);
                self.groups
                    .messages
                    .save_message(&message, group.group_id())
                    .await
                    .map_err(|e| GroupError::StorageError(e.to_string()))?;
                let group_id = GroupId::new(group.group_id().to_vec());
                if let Some(app_handle) = &self.app_handle {
                    emit_text_message_event(app_handle, &message, &group_id, &group_config).await?;
                }

                Ok(())
            }
            ReceivedMessage::Commit(commit_msg) => match commit_msg.effect {
                CommitEffect::NewEpoch(new_epoch) => {
                    log::debug!("Processed new epoch message: {:?}", new_epoch);
                    for proposal in &new_epoch.applied_proposals {
                        log::debug!("Applied proposal: {:?}", proposal);
                        match &proposal.proposal {
                            Proposal::Custom(custom) => {
                                log::debug!("Custom proposal: {:?}", custom);

                                if custom.proposal_type() == UPDATE_GROUP_CONFIG_PROPOSAL_V1 {
                                    let update_group_config =
                                        UpdateGroupConfigProposal::from_custom_proposal(custom)?;
                                    let group_id = GroupId::new(group.group_id().to_vec());
                                    if let Some(app_handle) = &self.app_handle {
                                        emit_new_group_config(
                                            app_handle,
                                            &group_id,
                                            &update_group_config.new_config,
                                        )
                                        .await?;
                                    }
                                }
                            }
                            _ => {
                                log::debug!("Not handled proposal")
                            }
                        }
                    }
                    Ok(())
                }
                CommitEffect::Removed { new_epoch, remover } => {
                    log::debug!(
                        "Processed removed message from {:?}: {:?}",
                        remover,
                        new_epoch
                    );
                    let group_id = GroupId::new(group.group_id().to_vec());
                    self.groups.remove(&group_id).await?;
                    Ok(())
                }
                CommitEffect::ReInit(proposal) => {
                    log::debug!("Processed reinit message: {:?}", proposal);
                    Ok(())
                }
            },
            ReceivedMessage::Proposal(proposal_msg) => {
                log::info!("Processed proposal message: {:?}", proposal_msg);
                Ok(())
            }
            ReceivedMessage::GroupInfo(group_info) => {
                log::info!("Processed group info: {:?}", group_info);
                Ok(())
            }
            ReceivedMessage::Welcome => {
                log::info!("Processed welcome message");
                Ok(())
            }
            ReceivedMessage::KeyPackage(key_package) => {
                log::info!("Processed key package: {:?}", key_package);
                Ok(())
            }
        }
    }

    pub async fn process_stream(&self) -> Result<(), GroupError> {
        log::info!("Waiting for stream messages...");
        while let Some(result) = self.backend.next_message().await {
            match result {
                Ok(message) => {
                    if let Some(response) = message.response {
                        match response {
                            group_microservice::stream_response::Response::GroupMessage(msg) => {
                                log::info!("User {} received group message:", self.user_id);
                                log::info!("  ID: {}", msg.message_id);
                                log::info!("  Group: {:?}", msg.group_id);
                                log::info!("  Message length: {:?}", msg.message.len());

                                if let Err(e) = async {
                                    let message =
                                        MlsMessage::from_bytes(&msg.message).map_err(|e| {
                                            GroupError::MessageDecodingError(e.to_string())
                                        })?;
                                    self.process_incoming_message(message).await
                                }
                                .await
                                {
                                    log::error!(
                                        "Failed to process incoming group message: {:?}",
                                        e
                                    );
                                }
                                self.backend
                                    .ack_delivery(
                                        msg.message_id,
                                        self.user_id,
                                        self.device_id.clone(),
                                        msg.group_id,
                                    )
                                    .await
                                    .map_err(|e| {
                                        GroupError::BackendError(format!(
                                            "Failed to ack delivery: {}",
                                            e
                                        ))
                                    })?;
                            }
                            group_microservice::stream_response::Response::Error(err) => {
                                log::error!("Error: {}", err.error);
                            }
                            group_microservice::stream_response::Response::InitGroupStream(
                                init,
                            ) => {
                                log::info!("Stream initialized for user {}", init.user_id);
                            }
                            group_microservice::stream_response::Response::SendGroupMessage(
                                msg,
                            ) => {
                                log::info!(
                                    "Send group message status: id={}, success={}",
                                    msg.message_id,
                                    msg.success
                                );
                                if let Some(app_handle) = &self.app_handle {
                                    emit_message_delivery_event(
                                        app_handle,
                                        msg.message_id,
                                        msg.success,
                                    )
                                    .await?;
                                }
                            }
                            group_microservice::stream_response::Response::SendWelcomeMessage(
                                msg,
                            ) => {
                                log::info!(
                                    "Send welcome message status: id={}, success={}",
                                    msg.message_id,
                                    msg.success
                                );
                                if let Some(app_handle) = &self.app_handle {
                                    emit_welcome_message_event(
                                        app_handle,
                                        msg.message_id,
                                        msg.success,
                                    )
                                    .await?;
                                }
                            }
                            group_microservice::stream_response::Response::WelcomeMessage(msg) => {
                                log::info!(
                                    "Received welcome message {} for user {}",
                                    msg.message_id,
                                    self.user_id
                                );
                                if let Err(e) = async {
                                    let message = MlsMessage::from_bytes(&msg.welcome_message)
                                        .map_err(|e| {
                                            GroupError::MessageDecodingError(e.to_string())
                                        })?;
                                    self.join(&message).await?;
                                    self.backend
                                        .ack_delivery(
                                            msg.message_id,
                                            self.user_id,
                                            self.device_id.clone(),
                                            Vec::new(),
                                        )
                                        .await
                                        .map_err(|e| {
                                            GroupError::BackendError(format!(
                                                "Failed to ack delivery: {}",
                                                e
                                            ))
                                        })
                                }
                                .await
                                {
                                    log::error!("Failed to process welcome message: {:?}", e);
                                }
                            }
                            group_microservice::stream_response::Response::AckDelivery(msg) => {
                                log::info!("Ack delivery: {:?}", msg);
                            }
                        }
                    } else {
                        log::warn!("Received empty message");
                    }
                }
                Err(e) => {
                    log::error!("Error receiving message: {:?}", e);
                }
            }
        }

        log::info!("Stream closed");
        Ok(())
    }
}
