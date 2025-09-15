use mls_rs::{MlsMessage, group::proposal::MlsCustomProposal};
use mls_rs_codec::{MlsDecode, MlsEncode};

use crate::api::device::{
    device::Device,
    types::{
        config::CREDENTIAL_V1,
        custom_mls::credentials::DeviceCredential,
        errors::GroupError,
        extensions::{
            group_config::{group_config::GroupConfig, group_extension::UpdateGroupConfigProposal},
            roster::proposals::RemoveUserProposal,
        },
        group::{GroupId, MlsGroup},
        message::UserGroupMessage,
    },
};

impl Device {
    /// Create a new MLS group
    ///
    /// - Initializes a group with context extensions (config and initial roster)
    /// - Persists the group locally, invites this user's other devices,
    ///   and subscribes backend delivery to the group topic
    pub async fn create_group(&mut self, group_config: GroupConfig) -> Result<GroupId, GroupError> {
        let context_extensions = self.build_context_extensions(group_config.clone())?;

        let mut group = self
            .client
            .create_group(context_extensions, Default::default(), None)
            .await
            .map_err(|e| GroupError::MlsError(format!("Group creation failed: {}", e)))?;

        group.write_to_storage().await.map_err(|e| {
            GroupError::StorageError(format!("Failed to write group to storage: {}", e))
        })?;

        self.invite_user_devices(&mut group).await?;

        let group_id = GroupId::new(group.group_id().to_vec());
        self.groups.insert(group_id.clone(), group).await;

        log::debug!("Created group with ID: {:?}", group_id);

        self.backend
            .as_mut()
            .ok_or(GroupError::BackendError("Client is offline".to_string()))?
            .update_group_subscriptions(vec![group_id.to_vec()], vec![])
            .await
            .map_err(|e| {
                GroupError::BackendError(format!("Failed to update group subscriptions: {}", e))
            })?;

        Ok(group_id)
    }

    /// Leave a group with the current device
    ///
    /// - Removes all of the current user's other devices from the roster
    /// - Updates the group config to remove the current user
    /// - Sends commit and acks its delivery
    pub async fn leave_group(&self, group_id: &GroupId) -> Result<(), GroupError> {
        {
            let group_arc = self.groups.get(group_id).await?;
            let mut group = group_arc.write().await;

            let mut config = self.extract_group_config(&group)?;
            config.remove_member(self.user_id());
            let update_config = UpdateGroupConfigProposal { new_config: config };

            let remove_user_proposal = RemoveUserProposal {
                user_id: self.user_id(),
            };

            let mut device_indexes = Vec::new();

            let members = group.roster().members();

            for member in members {
                if member.signing_identity.credential.credential_type() != CREDENTIAL_V1 {
                    continue;
                }
                let device_credential = DeviceCredential::mls_decode(
                    &mut &*member.signing_identity.credential.as_custom().unwrap().data,
                )?;
                if device_credential.device_id.user_id == self.user_id() {
                    if device_credential.device_id.device_id == self.device_id {
                        continue;
                    }
                    device_indexes.push(member.index);
                }
            }

            let mut commit = group.commit_builder();
            for device_index in device_indexes {
                commit = commit.remove_member(device_index)?;
            }

            let commit = commit
                .custom_proposal(update_config.to_custom_proposal()?)
                .custom_proposal(remove_user_proposal.to_custom_proposal()?)
                .build()
                .await
                .map_err(|e| {
                    GroupError::MlsError(format!("Failed to build remove commit: {}", e))
                })?;

            let members = self.extract_group_members(&group)?;
            let commit_bytes = commit.commit_message.mls_encode_to_vec().map_err(|e| {
                GroupError::EncodingError(format!("Failed to encode commit message: {}", e))
            })?;

            let message_id = Self::generate_message_id();
            self.backend
                .as_ref()
                .ok_or(GroupError::BackendError("Client is offline".to_string()))?
                .send_group_message(message_id, group_id.to_vec(), members, commit_bytes)
                .await
                .map_err(|e| {
                    GroupError::BackendError(format!("Failed to send commit to group: {}", e))
                })?;

            self.backend
                .as_ref()
                .ok_or(GroupError::BackendError("Client is offline".to_string()))?
                .ack_delivery(
                    message_id,
                    self.user_id(),
                    self.device_id.clone(),
                    group_id.to_vec(),
                )
                .await
                .map_err(|e| GroupError::BackendError(format!("Failed to ack delivery: {}", e)))?;
        }
        self.groups.remove(group_id).await?;
        Ok(())
    }

    /// Invite all of this user's other devices to a newly created group
    ///
    /// Skips the current device; fetches key packages for remaining devices
    /// and adds them to the group in a single commit.
    async fn invite_user_devices(&mut self, group: &mut MlsGroup) -> Result<(), GroupError> {
        let user_id = self.user_id();

        let devices = self
            .backend
            .as_mut()
            .ok_or(GroupError::BackendError("Client is offline".to_string()))?
            .get_users_devices(user_id)
            .await
            .map_err(|e| {
                GroupError::BackendError(format!("Failed to fetch user devices: {}", e))
            })?;

        let mut commit_builder = group.commit_builder();

        for device_id in devices {
            if device_id == self.device_id {
                continue;
            }
            let key_package_bytes = self
                .backend
                .as_mut()
                .ok_or(GroupError::BackendError("Client is offline".to_string()))?
                .get_device_key_package(user_id, device_id.clone())
                .await
                .map_err(|e| {
                    GroupError::BackendError(format!("Failed to fetch device key package: {}", e))
                })?;

            let key_package = MlsMessage::from_bytes(&key_package_bytes).map_err(|e| {
                GroupError::MessageDecodingError(format!("Failed to decode key package: {}", e))
            })?;

            commit_builder = commit_builder.add_member(key_package).map_err(|e| {
                GroupError::MlsError(format!("Failed to add member to commit: {}", e))
            })?;
        }

        let commit = commit_builder
            .build()
            .await
            .map_err(|e| GroupError::MlsError(format!("Failed to build invite commit: {}", e)))?;
        self.send_welcome_message(user_id, &commit).await?;
        self.apply_and_store_commit(group).await
    }

    /// Invite a user to the group
    ///
    /// Validates against ban list and existing membership, fetches the user's
    /// account credential and device key packages, builds the invite commit,
    /// sends commit to the group and welcome to the invited user.
    pub async fn invite(&mut self, group_id: &GroupId, user_id: u64) -> Result<(), GroupError> {
        let config = self.get_group_config(group_id).await?;
        if config.banned.contains(&user_id) {
            return Err(GroupError::ConfigError(
                "User is banned from this group".to_string(),
            ));
        }
        if config.members.contains(&user_id) {
            return Err(GroupError::ConfigError(
                "User is already a member of this group".to_string(),
            ));
        }

        let user_credential = self.get_contact(user_id).await?;

        let devices = self
            .backend
            .as_mut()
            .ok_or(GroupError::BackendError("Client is offline".to_string()))?
            .get_user_key_packages(user_id)
            .await
            .map_err(|e| {
                GroupError::BackendError(format!("Failed to fetch user devices: {}", e))
            })?;

        let group_arc = self.groups.get(group_id).await?;
        let mut group = group_arc.write().await;

        let commit = self
            .build_invite_commit(&mut group, user_credential, devices)
            .await?;

        self.send_commit_to_group(&group, group_id, &commit).await?;
        self.send_welcome_message(user_id, &commit).await?;

        self.apply_and_store_commit(&mut group).await?;

        log::info!(
            "Successfully invited user {} to group {:?}",
            user_id,
            group_id
        );
        Ok(())
    }

    /// Remove a user from the group
    ///
    /// Removes all devices belonging to `user_id` and updates membership
    /// in the group configuration, then sends and applies the commit.
    pub async fn remove_user(
        &mut self,
        group_id: &GroupId,
        user_id: u64,
    ) -> Result<(), GroupError> {
        let group_arc = self.groups.get(group_id).await?;
        let mut group = group_arc.write().await;

        let commit = self.build_remove_commit(&mut group, user_id).await?;

        self.send_commit_to_group(&group, group_id, &commit).await?;
        self.apply_and_store_commit(&mut group).await?;

        log::info!(
            "Successfully removed user {} from group {:?}",
            user_id,
            group_id
        );
        Ok(())
    }

    /// Update group configuration
    ///
    /// Builds a commit that updates the `GroupConfig` via custom proposal,
    /// sends it to the group, and persists the updated state.
    pub async fn update_group_config(
        &self,
        group_id: &GroupId,
        new_config: &GroupConfig,
    ) -> Result<(), GroupError> {
        let group_arc = self.groups.get(group_id).await?;
        let mut group = group_arc.write().await;

        let update_proposal = UpdateGroupConfigProposal {
            new_config: new_config.clone(),
        };

        let commit = group
            .commit_builder()
            .custom_proposal(update_proposal.to_custom_proposal()?)
            .build()
            .await
            .map_err(|e| {
                GroupError::MlsError(format!("Failed to build config update commit: {}", e))
            })?;

        self.send_commit_to_group(&group, group_id, &commit).await?;

        self.apply_and_store_commit(&mut group).await?;

        log::info!("Updated group config for group {:?}", group_id);
        Ok(())
    }

    /// Derive a symmetric key for display/preview purposes
    ///
    /// Uses MLS `export_secret` to derive a 32-byte key scoped to `group_id`.
    pub async fn get_group_display_key(&self, group_id: &GroupId) -> Result<Vec<u8>, GroupError> {
        let group_arc = self.groups.get(group_id).await?;
        let group = group_arc.read().await;
        let display_key = group
            .export_secret("Display Key".as_bytes(), group_id.as_bytes(), 32)
            .await
            .map_err(|e| GroupError::CryptoError(format!("Failed to export secret: {}", e)))?;
        let display_key = display_key.to_vec();
        Ok(display_key)
    }
}

impl Device {
    /// Send a message to the group
    ///
    /// Checks `send_messages` permission, encrypts an application message,
    /// delivers it to all current members, and stores a local copy.
    pub async fn send_message(
        &self,
        group_id: &GroupId,
        message: UserGroupMessage,
    ) -> Result<(), GroupError> {
        let group_arc = self.groups.get(group_id).await?;
        let mut group = group_arc.write().await;
        let group_config = self.extract_group_config(&group)?;
        if !group_config.has_permission(self.user_id(), "send_messages") {
            return Err(GroupError::ConfigError(
                "User is not allowed to send messages".to_string(),
            ));
        }
        let encrypted_message = group
            .encrypt_application_message(&message.to_bytes(), Default::default())
            .await
            .map_err(|e| GroupError::MlsError(format!("Message encryption failed: {}", e)))?;

        let members = self.extract_group_members(&group)?;
        let message_bytes = encrypted_message.mls_encode_to_vec().map_err(|e| {
            GroupError::EncodingError(format!("Failed to encode encrypted message: {}", e))
        })?;

        group.write_to_storage().await.map_err(|e| {
            GroupError::StorageError(format!("Failed to write group to storage: {}", e))
        })?;

        let message_id = Self::generate_message_id();
        log::debug!("Sending message to group {:?}", group_id);
        self.backend
            .as_ref()
            .ok_or(GroupError::BackendError("Client is offline".to_string()))?
            .send_group_message(message_id, group_id.to_vec(), members, message_bytes)
            .await
            .map_err(|e| {
                GroupError::BackendError(format!("Failed to send group message: {}", e))
            })?;
        self.groups
            .messages
            .save_message(&message, group_id.as_bytes())
            .await
            .map_err(|e| GroupError::StorageError(e.to_string()))?;
        log::debug!("Sent message to group {:?}", group_id);
        Ok(())
    }
}
