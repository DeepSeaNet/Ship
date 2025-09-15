//! MLS rules implementation for user access control

use mls_rs::{
    MlsRules,
    client_builder::PaddingMode,
    group::{GroupContext, Roster, Sender, proposal::MlsCustomProposal, proposal::Proposal},
    mls_rs_codec::MlsDecode,
    mls_rules::{
        CommitDirection, CommitOptions, CommitSource, EncryptionOptions, ProposalBundle,
        ProposalSource,
    },
};
use tonic::async_trait;

use crate::api::device::types::{
    config::CREDENTIAL_V1, custom_mls::credentials::DeviceCredential, errors::GroupError,
};

use crate::api::device::types::extensions::group_config::group_extension::{
    GroupConfigExtension, UPDATE_GROUP_CONFIG_PROPOSAL_V1, UpdateGroupConfigProposal,
};
use crate::api::device::types::extensions::roster::{
    proposals::{AddUserProposal, RemoveUserProposal},
    roster_extension::{ADD_USER_PROPOSAL_V1, REMOVE_USER_PROPOSAL_V1, RosterExtension},
};

/// Custom MLS rules that handle our AddUser proposals and maintain the user roster
#[derive(Debug, Clone, Copy)]
pub struct CustomMlsRules;

#[async_trait]
impl MlsRules for CustomMlsRules {
    type Error = GroupError;

    async fn filter_proposals(
        &self,
        _: CommitDirection,
        commit_source: CommitSource,
        _: &Roster,
        context: &GroupContext,
        mut proposals: ProposalBundle,
    ) -> Result<ProposalBundle, Self::Error> {
        let mut extensions_modified = false;
        let mut new_extensions = context.extensions.clone();

        // Получаем информацию об отправителе в начале функции
        let sender_user_id = match commit_source {
            CommitSource::ExistingMember(ref member) => {
                let sender_credential = member.signing_identity.credential.clone();
                if sender_credential.credential_type() != CREDENTIAL_V1 {
                    return Err(GroupError::CredentialMissmatch);
                }
                let sender_credential = sender_credential.as_custom().unwrap();
                let sender_credential =
                    DeviceCredential::mls_decode(&mut &*sender_credential.data)?;
                sender_credential.device_id.user_id
            }
            CommitSource::NewMember(ref member) => {
                let sender_credential = member.credential.clone();
                if sender_credential.credential_type() != CREDENTIAL_V1 {
                    return Err(GroupError::CredentialMissmatch);
                }
                log::info!("For now we dont validate external commits");
                return Ok(proposals);
            }
        };

        let config_extension: Option<GroupConfigExtension> =
            context.extensions.get_as().ok().flatten();

        let mut roster: RosterExtension = context
            .extensions
            .get_as()
            .ok()
            .flatten()
            .ok_or(GroupError::RosterNotFound)?;

        let add_user_proposals = proposals
            .custom_proposals()
            .iter()
            .filter(|p| p.proposal.proposal_type() == ADD_USER_PROPOSAL_V1);

        for add_user_info in add_user_proposals {
            if let Some(ref config_extension) = config_extension {
                if !config_extension
                    .config
                    .has_permission(sender_user_id, "manage_members")
                {
                    return Err(GroupError::ConfigError(
                        "User is not allowed to manage members".to_string(),
                    ));
                }

                let add_user = AddUserProposal::from_custom_proposal(&add_user_info.proposal)?;
                if config_extension
                    .config
                    .is_banned(add_user.new_user.account_id.user_id)
                {
                    return Err(GroupError::ConfigError(
                        "User is banned from this group".to_string(),
                    ));
                }
                if config_extension.config.is_full() {
                    return Err(GroupError::ConfigError("Group is full".to_string()));
                }
                roster.roster.push(add_user.new_user);
                extensions_modified = true;
            }
        }

        let remove_user_proposals = proposals
            .custom_proposals()
            .iter()
            .filter(|p| p.proposal.proposal_type() == REMOVE_USER_PROPOSAL_V1);

        for remove_user_info in remove_user_proposals {
            let remove_user = RemoveUserProposal::from_custom_proposal(&remove_user_info.proposal)?;

            if remove_user.user_id != sender_user_id
                && let Some(ref config_extension) = config_extension
                && !config_extension
                    .config
                    .has_permission(sender_user_id, "manage_members")
            {
                return Err(GroupError::ConfigError(
                    "User is not allowed to manage members".to_string(),
                ));
            }

            roster
                .roster
                .retain(|user| user.account_id.user_id != remove_user.user_id);
            extensions_modified = true;
        }

        if extensions_modified {
            new_extensions.set_from(roster)?;
        }

        // Обрабатываем GroupConfigExtension
        let mut group_config_updated = config_extension.clone();

        let update_config_proposals = proposals
            .custom_proposals()
            .iter()
            .filter(|p| p.proposal.proposal_type() == UPDATE_GROUP_CONFIG_PROPOSAL_V1);

        for update_info in update_config_proposals {
            let update_config =
                UpdateGroupConfigProposal::from_custom_proposal(&update_info.proposal)?;

            if let Some(ref current_config) = group_config_updated {
                let validation_result = current_config
                    .config
                    .validate_changes(&update_config.new_config, sender_user_id);
                if !validation_result.valid {
                    return Err(GroupError::ConfigValidationError(
                        "Invalid config changes".to_string(),
                    ));
                }
            }

            group_config_updated = Some(GroupConfigExtension {
                config: update_config.new_config,
            });
            extensions_modified = true;
        }

        if let Some(config) = group_config_updated {
            new_extensions.set_from(config)?;
            extensions_modified = true;
        }

        // Создаем GroupContextExtensions proposal только если были изменения
        if extensions_modified {
            let gce_proposal = Proposal::GroupContextExtensions(new_extensions);
            let sender = match commit_source {
                CommitSource::ExistingMember(ref member) => Sender::Member(member.index),
                CommitSource::NewMember(_) => Sender::Member(0),
            };
            proposals.add(gce_proposal, sender, ProposalSource::Local);
        }

        Ok(proposals)
    }

    fn commit_options(
        &self,
        _: &Roster,
        _: &GroupContext,
        _: &ProposalBundle,
    ) -> Result<CommitOptions, Self::Error> {
        Ok(CommitOptions::new())
    }

    fn encryption_options(
        &self,
        _: &Roster,
        _: &GroupContext,
    ) -> Result<EncryptionOptions, Self::Error> {
        Ok(EncryptionOptions::new(false, PaddingMode::None))
    }
}
