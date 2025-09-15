use std::collections::HashMap;

use mls_rs::{
    ExtensionList, MlsMessage,
    group::{CommitOutput, proposal::MlsCustomProposal},
};
use mls_rs_codec::{MlsDecode, MlsEncode};

use crate::api::device::{
    device::Device,
    types::{
        config::CREDENTIAL_V1,
        custom_mls::credentials::{AccountCredential, DeviceCredential},
        errors::GroupError,
        extensions::{
            group_config::{
                group_config::GroupConfig,
                group_extension::{GroupConfigExtension, UpdateGroupConfigProposal},
            },
            roster::{
                proposals::{AddUserProposal, RemoveUserProposal},
                roster_extension::RosterExtension,
            },
        },
        group::{GroupId, MlsGroup},
    },
};

impl Device {
    /// Extract group members from MLS group
    ///
    /// - group: The `MlsGroup` whose roster will be inspected
    /// - Returns: A list of user IDs for all accounts in the roster
    /// - Errors: If the roster extension is missing or cannot be decoded
    pub(super) fn extract_group_members(&self, group: &MlsGroup) -> Result<Vec<u64>, GroupError> {
        let roster = group
            .context()
            .extensions
            .get_as::<RosterExtension>()
            .map_err(|e| {
                GroupError::ExtensionError(format!("Failed to get roster extension: {}", e))
            })?
            .ok_or(GroupError::RosterNotFound)?;

        Ok(roster.roster.iter().map(|m| m.account_id.user_id).collect())
    }

    /// Get user IDs of all members for a group by its `group_id`
    ///
    /// - Returns: A list of user IDs for the group
    /// - Errors: If the group cannot be loaded or the roster extension is missing
    pub async fn get_group_members(&self, group_id: &GroupId) -> Result<Vec<u64>, GroupError> {
        let group_arc = self.groups.get(group_id).await?;
        let group = group_arc.read().await;
        self.extract_group_members(&group)
    }
}

impl Device {
    /// Extract group configuration from MLS group
    ///
    /// - group: The `MlsGroup` to read configuration from
    /// - Returns: The current `GroupConfig` stored in the group's extensions
    /// - Errors: If the group config extension is missing or cannot be decoded
    pub(super) fn extract_group_config(&self, group: &MlsGroup) -> Result<GroupConfig, GroupError> {
        let current_context = group.context();
        let current_config: Option<GroupConfigExtension> =
            current_context.extensions.get_as().map_err(|e| {
                GroupError::ExtensionError(format!("Failed to get group config extension: {}", e))
            })?;

        let config_extension = current_config.ok_or(GroupError::ConfigurationNotFound)?;
        Ok(config_extension.config)
    }

    /// Get current group configuration
    ///
    /// - Returns: The `GroupConfig` for the specified `group_id`
    /// - Errors: If the group cannot be loaded or the config extension is missing
    pub async fn get_group_config(&self, group_id: &GroupId) -> Result<GroupConfig, GroupError> {
        let group_arc = self.groups.get(group_id).await?;
        let group = group_arc.read().await;
        self.extract_group_config(&group)
    }
}

impl Device {
    /// Build context extensions for group creation
    ///
    /// Adds `GroupConfigExtension` and `RosterExtension` to the new group's context
    /// so these settings are available to all members from creation time.
    pub(super) fn build_context_extensions(
        &self,
        group_config: GroupConfig,
    ) -> Result<ExtensionList, GroupError> {
        let mut context_extensions = ExtensionList::new();

        context_extensions
            .set_from(GroupConfigExtension {
                config: group_config,
            })
            .map_err(|e| {
                GroupError::ExtensionError(format!("Failed to set group config extension: {}", e))
            })?;

        let roster = vec![self.account.credential.clone()];
        context_extensions
            .set_from(RosterExtension { roster })
            .map_err(|e| {
                GroupError::ExtensionError(format!("Failed to set roster extension: {}", e))
            })?;

        Ok(context_extensions)
    }
}

impl Device {
    /// Apply commit and store group state
    ///
    /// Applies any pending commit on the group, then persists the state
    /// to the storage engine associated with this device.
    pub(super) async fn apply_and_store_commit(
        &self,
        group: &mut MlsGroup,
    ) -> Result<(), GroupError> {
        group
            .apply_pending_commit()
            .await
            .map_err(|e| GroupError::MlsError(format!("Failed to apply commit: {}", e)))?;

        group.write_to_storage().await.map_err(|e| {
            GroupError::StorageError(format!("Failed to write group to storage: {}", e))
        })?;

        Ok(())
    }

    /// Build commit for user invitation
    ///
    /// Creates a commit that:
    /// - Registers a new user at the account level via `AddUserProposal`
    /// - Adds all of the user's devices by their key packages
    /// - Updates the `GroupConfig` membership list
    ///
    /// - Errors: If provided key packages cannot be decoded or MLS operations fail (e.g if account credential is not valid or already in the roster)
    pub(super) async fn build_invite_commit(
        &self,
        group: &mut MlsGroup,
        user_credential: AccountCredential,
        devices: HashMap<String, Vec<u8>>,
    ) -> Result<CommitOutput, GroupError> {
        if devices.is_empty() {
            return Err(GroupError::BackendError(
                "No devices found (User dont have key packages)".to_string(),
            ));
        }
        let add_user_proposal = AddUserProposal {
            new_user: user_credential.clone(),
        };

        let mut config = self.extract_group_config(group)?;
        config.add_member(user_credential.account_id.user_id);
        let update_config_proposal = UpdateGroupConfigProposal { new_config: config };

        let mut commit_builder = group
            .commit_builder()
            .custom_proposal(add_user_proposal.to_custom_proposal()?)
            .custom_proposal(update_config_proposal.to_custom_proposal()?);

        for (_, key_package_bytes) in devices {
            let key_package = MlsMessage::from_bytes(&key_package_bytes).map_err(|e| {
                GroupError::MessageDecodingError(format!("Failed to decode key package: {}", e))
            })?;

            commit_builder = commit_builder.add_member(key_package).map_err(|e| {
                GroupError::MlsError(format!("Failed to add member to commit: {}", e))
            })?;
        }

        commit_builder
            .build()
            .await
            .map_err(|e| GroupError::MlsError(format!("Failed to build invite commit: {}", e)))
    }

    /// Build commit for user removal
    ///
    /// Creates a commit that:
    /// - Removes all devices belonging to `user_id`
    /// - Updates the `GroupConfig` membership list
    ///
    /// - Errors: If MLS operations fail (e.g if you dont have permission [manage_members] to remove the user)
    pub(super) async fn build_remove_commit(
        &mut self,
        group: &mut MlsGroup,
        user_id: u64,
    ) -> Result<CommitOutput, GroupError> {
        let mut config = self.extract_group_config(group)?;
        config.remove_member(user_id);
        let update_config = UpdateGroupConfigProposal { new_config: config };

        let remove_user_proposal = RemoveUserProposal { user_id };

        let mut device_indexes = Vec::new();

        let members = group.roster().members();

        for member in members {
            if member.signing_identity.credential.credential_type() != CREDENTIAL_V1 {
                continue;
            }
            let device_credential = DeviceCredential::mls_decode(
                &mut &*member.signing_identity.credential.as_custom().unwrap().data,
            )?;
            if device_credential.device_id.user_id == user_id {
                device_indexes.push(member.index);
            }
        }

        let mut commit = group.commit_builder();
        for device_index in device_indexes {
            commit = commit.remove_member(device_index)?;
        }

        commit
            .custom_proposal(update_config.to_custom_proposal()?)
            .custom_proposal(remove_user_proposal.to_custom_proposal()?)
            .build()
            .await
            .map_err(|e| GroupError::MlsError(format!("Failed to build remove commit: {}", e)))
    }
}

impl Device {
    /// Send commit message to group members
    ///
    /// Serializes and forwards the commit to the backend for delivery
    /// to all current members of the group.
    pub(super) async fn send_commit_to_group(
        &self,
        group: &MlsGroup,
        group_id: &GroupId,
        commit: &CommitOutput,
    ) -> Result<(), GroupError> {
        let members = self.extract_group_members(group)?;
        let commit_bytes = commit.commit_message.mls_encode_to_vec().map_err(|e| {
            GroupError::EncodingError(format!("Failed to encode commit message: {}", e))
        })?;

        let message_id = Self::generate_message_id();
        self.backend
            .as_ref()
            .ok_or(GroupError::BackendError("Client is offline".to_string()))?
            .send_group_message(message_id, group_id.to_vec(), members, commit_bytes)
            .await
            .map_err(|e| GroupError::BackendError(format!("Failed to send commit to group: {}", e)))
    }

    /// Send welcome message to new user
    ///
    /// If a welcome message exists in the `CommitOutput`, send it
    /// to the newly invited user so they can join the group.
    pub(super) async fn send_welcome_message(
        &self,
        user_id: u64,
        commit: &CommitOutput,
    ) -> Result<(), GroupError> {
        log::info!("Sending welcome message to user {:?}", user_id);
        if let Some(welcome_message) = commit.welcome_messages.first() {
            log::info!("Welcome message found: {:?}", welcome_message);
            let welcome_bytes = welcome_message.mls_encode_to_vec().map_err(|e| {
                GroupError::EncodingError(format!("Failed to encode welcome message: {}", e))
            })?;
            let message_id = Self::generate_message_id();
            self.backend
                .as_ref()
                .ok_or(GroupError::BackendError("Client is offline".to_string()))?
                .send_welcome_message(message_id, user_id, welcome_bytes)
                .await
                .map_err(|e| {
                    GroupError::BackendError(format!("Failed to send welcome message: {}", e))
                })?;
        }
        Ok(())
    }
}
