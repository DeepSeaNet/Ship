use mls_rs::group::proposal::{MlsCustomProposal, ProposalType};
use mls_rs_codec::{MlsDecode, MlsEncode, MlsSize};
use mls_rs_core::extension::{ExtensionType, MlsCodecExtension};

use crate::api::device::types::extensions::group_config::group_config::GroupConfig;
// Новый ExtensionType
pub const GROUP_CONFIG_EXTENSION_V1: ExtensionType = ExtensionType::new(65003);

pub const UPDATE_GROUP_CONFIG_PROPOSAL_V1: ProposalType = ProposalType::new(65004);

// Расширение GroupConfig
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
    use crate::api::device::types::extensions::group_config::group_config::GroupConfig;
    use mls_rs_core::extension::ExtensionList;

    #[test]
    fn test_group_config_extension() {
        let mut config = GroupConfig::new(1, "Test Group".to_string(), 123);
        let member_id = 1_u64;
        config.add_member(member_id);
        let member_id_2 = 2_u64;
        config.add_member(member_id_2);
        let extension = GroupConfigExtension { config };
        let mut extensions = ExtensionList::new();
        extensions.set_from(extension).unwrap();

        let retrieved: Option<GroupConfigExtension> = extensions.get_as().ok().flatten();
        assert!(retrieved.is_some());

        let retrieved_config = retrieved.unwrap().config;
        assert_eq!(retrieved_config.name, "Test Group");
        assert_eq!(retrieved_config.creator_id, 123);
        let member_config = retrieved_config.permissions.get(&member_id);
        println!("{:?}", retrieved_config);
        assert!(member_config.is_some());
    }
}
