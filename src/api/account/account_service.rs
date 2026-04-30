use crate::api::{
    account::{AccountError, AccountResult, types::UserId},
    device::types::custom_mls::credentials::AccountId,
};
use std::str::FromStr;
use tauri::http::Uri;
use tonic_h3::H3Channel;
use tonic_h3::quinn::H3QuinnConnector;

use crate::api::{
    account::{
        Account,
        account_service::auth::{RegisterRequest, auth_service_client::AuthServiceClient},
    },
    connection::endpoint::create_client_endpoint,
};

#[allow(clippy::all, clippy::pedantic, clippy::restriction, clippy::nursery)]
pub mod auth {
    tonic::include_proto!("auth");
}

fn generate_nonce() -> i64 {
    1i64 // after we need to make normal function
}

impl Account {
    pub async fn register(
        username: String,
        avatar_url: Option<String>,
        server_address: String,
    ) -> AccountResult<Account> {
        use crate::api::device::types::custom_mls::credentials::AccountCredential;

        let (signer, public_key) = Account::create_keys()
            .await
            .map_err(|e| AccountError::Internal(format!("Failed to generate MLS keys: {:?}", e)))?;
        log::debug!("Generated MLS keypair:");
        log::debug!("Public key length: {} bytes", public_key.as_bytes().len());
        log::debug!("Private key length: {} bytes", signer.as_bytes().len());
        let user_id = UserId::from_pubkey(public_key.clone());

        let request = RegisterRequest {
            username: username.clone(),
            user_id: user_id.to_bytes(),
            public_key: public_key.as_bytes().to_vec(),
            avatar_url: avatar_url.clone(),
            nonce: generate_nonce(),
        };

        log::debug!("Sending registration request for user: {}", username);
        let uri = Uri::from_str(&server_address.clone())
            .map_err(|e| AccountError::Internal(e.to_string()))?;

        let endpoint = create_client_endpoint().map_err(|e| {
            AccountError::Internal(format!("Failed to create client endpoint: {:?}", e))
        })?;
        let connector = H3QuinnConnector::new(uri.clone(), "sea_auth".to_string(), endpoint);

        let channel = H3Channel::new(connector, uri);
        let mut client = AuthServiceClient::new(channel);

        let register_response = client
            .register(request)
            .await
            .map_err(|e| AccountError::Internal(e.to_string()))?
            .into_inner();

        if register_response.success {
            log::debug!("Registration successful!");
            log::debug!("User ID: {:?}", register_response.user_id);
            log::debug!(
                "Certificate length: {:?} bytes",
                register_response.certificate.len()
            );
        } else {
            log::error!("Registration failed: {}", register_response.message);
        }

        let account_id = AccountId { user_id };

        let credential = AccountCredential {
            account_id,
            public_key,
            cert: register_response.certificate,
        };

        let account = Account {
            user_id,
            username: register_response.username,
            server_address,
            server_public_key: Some(register_response.server_public_key),
            avatar_url,
            credential,
            signer,
        };

        account.save_to_db().await?;

        Ok(account)
    }
}
