use anyhow::Result;
use tonic::transport::Channel;

use crate::api::{
    account::{
        Account,
        account_service::auth::{RegisterRequest, auth_service_client::AuthServiceClient},
    },
    connection::get_avaliable_servers,
};

#[allow(clippy::all, clippy::pedantic, clippy::restriction, clippy::nursery)]
pub mod auth {
    tonic::include_proto!("auth");
}

fn generate_nonce() -> i64 {
    1i64 // after we need to make normal function
}

impl Account {
    pub async fn register(username: String, avatar_url: Option<String>) -> Result<Account> {
        use crate::api::device::types::custom_mls::credentials::{AccountCredential, AccountId};

        // Генерируем новую пару MLS ключей
        let (signer, public_key) = Account::create_keys()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to generate MLS keys: {:?}", e))?;
        let server_address = get_avaliable_servers();
        log::debug!("Generated MLS keypair:");
        log::debug!("Public key length: {} bytes", public_key.as_bytes().len());
        log::debug!("Private key length: {} bytes", signer.as_bytes().len());

        // Создаем запрос на регистрацию с MLS public key и credential
        let request = RegisterRequest {
            username: username.clone(),
            public_key: public_key.as_bytes().to_vec(),
            avatar_url: avatar_url.clone(),
            nonce: generate_nonce(),
        };

        log::debug!("Sending registration request for user: {}", username);
        let channel = Channel::from_shared(server_address.clone())?
            .connect()
            .await?;
        let mut client = AuthServiceClient::new(channel);

        let register_response = client.register(request).await?.into_inner();

        if register_response.success {
            log::debug!("Registration successful!");
            log::debug!("User ID: {:?}", register_response.user_id);
            log::debug!("Public Address: {:?}", register_response.public_address);
            log::debug!(
                "Certificate length: {:?} bytes",
                register_response.certificate.len()
            );
        } else {
            log::error!("Registration failed: {}", register_response.message);
        }

        // Создаем MLS credential
        let account_id = AccountId {
            user_id: register_response.user_id as u64,
            public_address: register_response.public_address.clone(),
        };

        let credential = AccountCredential {
            account_id,
            public_key,
            cert: register_response.certificate,
        };

        let account = Account::new_with_existing_keys(
            register_response.user_id,
            register_response.username,
            register_response.public_address,
            server_address,
            Some(register_response.server_public_key),
            avatar_url,
            credential,
            signer,
        );

        account.save_to_db().await?;

        Ok(account)
    }
}
