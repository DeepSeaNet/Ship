use mls_rs::group::proposal::{MlsCustomProposal, ProposalType};
use mls_rs_codec::{MlsDecode, MlsEncode, MlsSize};
use mls_rs_core::extension::{ExtensionType, MlsCodecExtension};

use crate::api::device::types::extensions::group_config::GroupConfig;

pub const GROUP_CONFIG_EXTENSION_V1: ExtensionType = ExtensionType::new(65003);

pub const UPDATE_GROUP_CONFIG_PROPOSAL_V1: ProposalType = ProposalType::new(65004);

#[derive(Debug, Clone, MlsSize, MlsDecode, MlsEncode)]
pub struct GroupConfigExtension {
    pub config: GroupConfig,
}

impl MlsCodecExtension for GroupConfigExtension {
    fn extension_type() -> ExtensionType {
        GROUP_CONFIG_EXTENSION_V1
    }
}

#[derive(MlsSize, MlsDecode, MlsEncode)]
pub struct UpdateGroupConfigProposal {
    pub new_config: GroupConfig,
}

impl MlsCustomProposal for UpdateGroupConfigProposal {
    fn proposal_type() -> ProposalType {
        UPDATE_GROUP_CONFIG_PROPOSAL_V1
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::account::UserId;
    use crate::api::device::types::extensions::group_config::GroupConfig;
    use mls_rs_core::extension::ExtensionList;

    #[test]
    fn test_group_config_extension() {
        let creator_id = UserId::from_bytes(&[0u8; 32]);
        let mut config = GroupConfig::new(1, "Test Group".to_string(), creator_id);
        let member_id = UserId::from_bytes(&[1u8; 32]);
        config.add_member(member_id);
        let member_id_2 = UserId::from_bytes(&[2u8; 32]);
        config.add_member(member_id_2);
        let extension = GroupConfigExtension { config };
        let mut extensions = ExtensionList::new();
        extensions.set_from(extension).unwrap();

        let retrieved: Option<GroupConfigExtension> = extensions.get_as().ok().flatten();
        assert!(retrieved.is_some());

        let retrieved_config = retrieved.unwrap().config;
        assert_eq!(retrieved_config.name, "Test Group");
        assert_eq!(retrieved_config.creator_id, creator_id);
        let member_config = retrieved_config.permissions.get(&member_id);
        println!("{:?}", retrieved_config);
        assert!(member_config.is_some());
    }
}
