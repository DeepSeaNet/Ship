//! Identity provider implementation for validating member credentials

use crate::api::device::types::{
    config::{CREDENTIAL_V1, cipher_suite},
    custom_mls::credentials::{DeviceCredential, DeviceCredentialTBS},
    errors::GroupError,
    extensions::roster::roster_extension::RosterExtension,
};
use mls_rs::{CipherSuiteProvider, ExtensionList, IdentityProvider};
use mls_rs_codec::MlsDecode;
use mls_rs_codec::MlsEncode;
use mls_rs_core::{
    identity::{Credential, CredentialType, MemberValidationContext, SigningIdentity},
    time::MlsTime,
};
use tonic::async_trait;

/// Custom identity provider that validates member credentials against the user roster
#[derive(Debug, Clone, Copy)]
pub struct CustomIdentityProvider;

#[async_trait]
impl IdentityProvider for CustomIdentityProvider {
    type Error = GroupError;

    async fn validate_member(
        &self,
        signing_identity: &SigningIdentity,
        _timestamp: Option<MlsTime>,
        context: MemberValidationContext<'_>,
    ) -> Result<(), Self::Error> {
        // Get the updated extensions (including our roster)
        let Some(extensions) = context.new_extensions() else {
            return Ok(());
        };

        // Extract the user roster from the extensions
        let roster = extensions
            .get_as::<RosterExtension>()
            .ok()
            .flatten()
            .ok_or(GroupError::RosterNotFound)?;

        // Validate that we have a custom credential of the correct type
        let Credential::Custom(custom) = &signing_identity.credential else {
            return Err(GroupError::CredentialMissmatch);
        };

        if custom.credential_type != CREDENTIAL_V1 {
            return Err(GroupError::CredentialMissmatch);
        }

        // Decode the member credential
        let member = DeviceCredential::mls_decode(&mut &*custom.data)?;

        // Verify the member credential signature
        // This ensures the member was authorized by the user who owns them
        let tbs = DeviceCredentialTBS {
            user_id: member.device_id.user_id,
            user_public_key: &member.user_public_key,
            public_key: &signing_identity.signature_key,
        }
        .mls_encode_to_vec()?;

        cipher_suite()
            .verify(&member.user_public_key, &member.signature, &tbs)
            .await
            .map_err(|_| GroupError::MlsError("Verify error".to_string()))?;

        // Verify that the user who owns this member is in the authorized roster
        let user_in_roster = roster
            .roster
            .iter()
            .any(|u| u.public_key == member.user_public_key);

        if !user_in_roster {
            return Err(GroupError::UserIsNotInRoster);
        }

        Ok(())
    }

    async fn identity(
        &self,
        signing_identity: &SigningIdentity,
        _extensions: &ExtensionList,
    ) -> Result<Vec<u8>, Self::Error> {
        let Credential::Custom(custom) = &signing_identity.credential else {
            return Err(GroupError::CredentialMissmatch);
        };

        if custom.credential_type != CREDENTIAL_V1 {
            return Err(GroupError::CredentialMissmatch);
        }
        let member = DeviceCredential::mls_decode(&mut &*custom.data)?;
        Ok(member.device_id.mls_encode_to_vec()?)
    }

    fn supported_types(&self) -> Vec<CredentialType> {
        vec![CREDENTIAL_V1]
    }

    async fn valid_successor(
        &self,
        _predecessor: &SigningIdentity,
        _successor: &SigningIdentity,
        _extensions: &ExtensionList,
    ) -> Result<bool, Self::Error> {
        Ok(true)
    }

    async fn validate_external_sender(
        &self,
        _identity: &SigningIdentity,
        _timestamp: Option<MlsTime>,
        _extensions: Option<&ExtensionList>,
    ) -> Result<(), Self::Error> {
        Ok(())
    }
}
