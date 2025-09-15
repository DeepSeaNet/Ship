//! MLS extensions for user roster management

use mls_rs_codec::{MlsDecode, MlsEncode, MlsSize};
use mls_rs_core::extension::{ExtensionType, MlsCodecExtension};
use mls_rs_core::group::ProposalType;

use crate::api::device::types::custom_mls::credentials::AccountCredential;

/// Extension type for the roster extension
pub const ROSTER_EXTENSION_V1: ExtensionType = ExtensionType::new(65000);

/// Proposal type for adding users
pub const ADD_USER_PROPOSAL_V1: ProposalType = ProposalType::new(65001);

/// Proposal type for removing users
pub const REMOVE_USER_PROPOSAL_V1: ProposalType = ProposalType::new(65002);

/// Extension that stores the current list of authorized users in the MLS GroupContext
/// This ensures all group members have a consistent view of who is allowed to join
#[derive(Debug, Clone, MlsSize, MlsDecode, MlsEncode)]
pub struct RosterExtension {
    pub roster: Vec<AccountCredential>,
}

impl MlsCodecExtension for RosterExtension {
    fn extension_type() -> ExtensionType {
        ROSTER_EXTENSION_V1
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::api::device::types::config::cipher_suite;
    use crate::api::device::types::custom_mls::credentials::{AccountCredential, AccountId};
    use mls_rs::CipherSuiteProvider;
    use mls_rs_core::extension::ExtensionList;

    // Helper function to create a test user credential
    async fn create_test_user_credential(name: &str) -> AccountCredential {
        let (_signer, public_key) = cipher_suite()
            .signature_key_generate()
            .await
            .expect("Failed to generate signature key");

        AccountCredential {
            account_id: AccountId {
                user_id: 1,
                public_address: name.to_string(),
            },
            public_key,
            cert: vec![],
        }
    }

    #[tokio::test]
    async fn test_roster_extension_with_multiple_users() {
        // Test roster extension with multiple users
        let user1 = create_test_user_credential("Alice").await;
        let user2 = create_test_user_credential("Bob").await;
        let user3 = create_test_user_credential("Charlie").await;

        let roster_ext = RosterExtension {
            roster: vec![user1.clone(), user2.clone(), user3.clone()],
        };

        let mut extensions = ExtensionList::new();
        extensions.set_from(roster_ext).unwrap();

        let retrieved: Option<RosterExtension> = extensions.get_as().ok().flatten();
        assert!(retrieved.is_some());

        let retrieved_roster = retrieved.unwrap();
        assert_eq!(retrieved_roster.roster.len(), 3);

        // Verify all users are present
        let user_names: Vec<&String> = retrieved_roster
            .roster
            .iter()
            .map(|u| &u.account_id.public_address)
            .collect();
        assert!(user_names.contains(&&"Alice".to_string()));
        assert!(user_names.contains(&&"Bob".to_string()));
        assert!(user_names.contains(&&"Charlie".to_string()));
    }

    #[tokio::test]
    async fn test_roster_extension_codec_roundtrip() {
        // Test MLS codec encode/decode roundtrip
        let user1 = create_test_user_credential("Test User").await;
        let original_roster = RosterExtension {
            roster: vec![user1],
        };

        // Encode the roster extension
        let encoded = original_roster.mls_encode_to_vec().unwrap();

        // Decode it back
        let decoded = RosterExtension::mls_decode(&mut encoded.as_slice()).unwrap();

        // Verify the data is preserved
        assert_eq!(decoded.roster.len(), 1);
        assert_eq!(decoded.roster[0].account_id.public_address, "Test User");
        // Note: We can't directly compare public keys, but we can verify the name
    }

    #[tokio::test]
    async fn test_roster_extension_in_group_context() {
        // Test using roster extension in an MLS group context scenario
        let admin_user = create_test_user_credential("Admin").await;
        let regular_user1 = create_test_user_credential("User1").await;
        let regular_user2 = create_test_user_credential("User2").await;

        let mut roster_ext = RosterExtension {
            roster: vec![admin_user],
        };

        // Simulate adding users to roster
        roster_ext.roster.push(regular_user1);
        roster_ext.roster.push(regular_user2);

        // Test that we can store and retrieve from extension list
        let mut extensions = ExtensionList::new();
        extensions.set_from(roster_ext).unwrap();

        let retrieved: Option<RosterExtension> = extensions.get_as().ok().flatten();
        assert!(retrieved.is_some());

        let retrieved_roster = retrieved.unwrap();
        assert_eq!(retrieved_roster.roster.len(), 3);

        // Verify we have the admin and regular users
        let user_names: Vec<&String> = retrieved_roster
            .roster
            .iter()
            .map(|u| &u.account_id.public_address)
            .collect();
        assert!(user_names.contains(&&"Admin".to_string()));
        assert!(user_names.contains(&&"User1".to_string()));
        assert!(user_names.contains(&&"User2".to_string()));

        println!("Roster extension test completed: {:?}", retrieved_roster);
    }

    #[tokio::test]
    async fn test_roster_extension_public_key_encoding() {
        // Test that public keys are properly encoded/decoded
        let user1 = create_test_user_credential("KeyTest").await;
        let original_key = user1.public_key.clone();

        let roster_ext = RosterExtension {
            roster: vec![user1],
        };

        // Encode and decode
        let encoded = roster_ext.mls_encode_to_vec().unwrap();
        let decoded = RosterExtension::mls_decode(&mut encoded.as_slice()).unwrap();

        // Verify the key is preserved (compare the encoded bytes)
        let original_key_bytes = original_key.mls_encode_to_vec().unwrap();
        let decoded_key_bytes = decoded.roster[0].public_key.mls_encode_to_vec().unwrap();
        assert_eq!(original_key_bytes, decoded_key_bytes);
    }
}
