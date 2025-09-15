//! Custom MLS proposals for user management

use crate::api::device::types::custom_mls::credentials::AccountCredential;
use mls_rs::group::proposal::MlsCustomProposal;
use mls_rs_codec::{MlsDecode, MlsEncode, MlsSize};
use mls_rs_core::group::ProposalType;

use super::roster_extension::{ADD_USER_PROPOSAL_V1, REMOVE_USER_PROPOSAL_V1};

/// Custom proposal to add a new user to the authorized user roster
/// This proposal will be processed by our MLS rules to update the RosterExtension
#[derive(Debug, Clone, MlsSize, MlsDecode, MlsEncode)]
pub struct AddUserProposal {
    pub new_user: AccountCredential,
}

impl MlsCustomProposal for AddUserProposal {
    fn proposal_type() -> ProposalType {
        ADD_USER_PROPOSAL_V1
    }
}

/// Custom proposal to remove a user from the authorized user roster
/// This proposal will be processed by our MLS rules to update the RosterExtension
#[derive(Debug, Clone, MlsSize, MlsDecode, MlsEncode)]
pub struct RemoveUserProposal {
    pub user_id: u64,
}

impl MlsCustomProposal for RemoveUserProposal {
    fn proposal_type() -> ProposalType {
        REMOVE_USER_PROPOSAL_V1
    }
}
