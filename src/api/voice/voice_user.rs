use log;
use mls_rs::{
    CipherSuite, CipherSuiteProvider, CryptoProvider, ExtensionList, Group, MlsMessage,
    client::Client,
    client_builder::{BaseConfig, ClientBuilder, WithCryptoProvider, WithIdentityProvider},
    crypto::SignatureSecretKey,
    extension::built_in::ExternalSendersExt,
    identity::{
        SigningIdentity,
        basic::{BasicCredential, BasicIdentityProvider},
    },
};
use mls_rs_codec::{MlsDecode, MlsEncode};
use std::sync::Arc;
use tokio::{
    fs::File,
    io::{AsyncReadExt, AsyncWriteExt},
    sync::RwLock,
};

use anyhow::Error;

use crate::api::voice::types::ratchet_key::GroupRatchetManager;
use crate::api::voice::types::ratchet_key::RatchetConfig;
use crate::api::voice::voice_handler::VoiceHandler;
use crate::api::voice::{
    connection::echolocator,
    types::basic_types::{EXPORT_SECRET_LABEL, EXPORT_SECRET_LENGTH, Voice, VoiceId},
};
use crate::api::voice::{connection::voice_connection::Backend, types::basic_types::VoiceUserData};
use mls_rs_crypto_awslc::AwsLcCryptoProvider;
use std::path::PathBuf;
use tauri::AppHandle;

const CIPHERSUITE: CipherSuite = CipherSuite::CURVE25519_AES128;

pub type MlsClient = Client<
    WithIdentityProvider<
        BasicIdentityProvider,
        WithCryptoProvider<AwsLcCryptoProvider, BaseConfig>,
    >,
>;
pub type MlsGroup = Group<
    WithIdentityProvider<
        BasicIdentityProvider,
        WithCryptoProvider<AwsLcCryptoProvider, BaseConfig>,
    >,
>;

pub struct VoiceUser {
    current_voice: Arc<RwLock<Option<Voice>>>,
    identity: SigningIdentity,
    signer: SignatureSecretKey,
    backend: Backend,
    client: MlsClient,
    app_handle: Option<AppHandle>,
    user_id: u64,
}

impl VoiceUser {
    pub async fn new(user_id: u64, app_handle: Option<AppHandle>) -> Result<Self, anyhow::Error> {
        let crypto_provider = AwsLcCryptoProvider::default();
        let cipher_suite = crypto_provider
            .cipher_suite_provider(CIPHERSUITE)
            .ok_or_else(|| anyhow::anyhow!("Cipher suite not supported"))?;
        let (secret, public) = cipher_suite.signature_key_generate()?;
        let basic_identity = BasicCredential::new(user_id.to_le_bytes().to_vec());
        let signing_identity = SigningIdentity::new(basic_identity.into_credential(), public);

        let client = ClientBuilder::new()
            .identity_provider(BasicIdentityProvider)
            .crypto_provider(crypto_provider.clone())
            .signing_identity(signing_identity.clone(), secret.clone(), CIPHERSUITE)
            .build();

        let backend = if let Some(app_handle) = &app_handle {
            Backend::with_app_handle(app_handle.clone())
        } else {
            Backend::new()
        };

        let voice_user = Self {
            current_voice: Arc::new(RwLock::new(None)),
            identity: signing_identity,
            signer: secret,
            backend,
            client,
            user_id,
            app_handle,
        };
        voice_user.save().await;
        Ok(voice_user)
    }

    pub async fn save(&self) {
        let output_path = VoiceUser::get_file_path(self.user_id);

        let data = VoiceUserData {
            identity: self.identity.clone(),
            user_id: self.user_id,
            signer: self.signer.clone(),
        };

        let mut file = File::create(output_path)
            .await
            .map_err(|e| log::error!("Failed to create file: {}", e))
            .ok();
        if let Some(file) = file.as_mut() {
            let data_bytes = data
                .mls_encode_to_vec()
                .map_err(|e| log::error!("Failed to encode voice user data: {}", e))
                .ok();
            if let Some(data_bytes) = data_bytes {
                if let Err(e) = file.write_all(&data_bytes).await {
                    log::error!("Failed to save voice user data: {}", e);
                } else {
                    log::info!("Voice user data saved successfully");
                }
            }
        }
    }

    pub async fn load(user_id: u64, app_handle: Option<AppHandle>) -> Result<Self, anyhow::Error> {
        let input_path = VoiceUser::get_file_path(user_id);
        let mut file = File::open(input_path)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to open file: {}", e))?;
        let mut file_bytes = Vec::new();
        file.read_to_end(&mut file_bytes)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to read file: {}", e))?;
        let data = VoiceUserData::mls_decode(&mut &*file_bytes)
            .map_err(|e| anyhow::anyhow!("Failed to decode voice user data: {}", e))?;

        let crypto_provider = AwsLcCryptoProvider::default();

        let client = ClientBuilder::new()
            .identity_provider(BasicIdentityProvider)
            .crypto_provider(crypto_provider.clone())
            .signing_identity(data.identity.clone(), data.signer.clone(), CIPHERSUITE)
            .build();

        let backend = if let Some(app_handle) = &app_handle {
            Backend::with_app_handle(app_handle.clone())
        } else {
            Backend::new()
        };

        let voice_user = Self {
            current_voice: Arc::new(RwLock::new(None)),
            identity: data.identity,
            signer: data.signer,
            backend,
            client,
            user_id: data.user_id,
            app_handle,
        };
        Ok(voice_user)
    }

    fn get_file_path(user_id: u64) -> PathBuf {
        #[cfg(not(target_os = "ios"))]
        {
            let mut path = dirs::home_dir().expect("Could not find home directory");
            path.push(".ship");
            std::fs::create_dir_all(&path).expect("Could not create .ship directory");
            path.push(format!("voice_{}.json", user_id));
            path
        }
        #[cfg(target_os = "ios")]
        {
            let mut path = dirs::document_dir().expect("Could not find home directory");
            path.push(".ship");
            std::fs::create_dir_all(&path).expect("Could not create .ship directory");
            path.push(format!("voice_{}.json", user_id));
            path
        }
    }

    pub async fn create_voice_channel(&self, voice_id: String) -> Result<Vec<u8>, anyhow::Error> {
        let group_id = VoiceId::from_string(&voice_id);

        let server_identity_bytes = self.backend.get_server_info().await?;
        let server_identity = SigningIdentity::mls_decode(&mut &*server_identity_bytes)?;

        let mut extension_list = ExtensionList::new();
        extension_list.set_from(ExternalSendersExt::new(vec![server_identity]))?;

        let group = self
            .client
            .create_group_with_id(group_id.to_vec(), extension_list, Default::default(), None)
            .map_err(|e| anyhow::anyhow!("Failed to create MLS group: {}", e))?;

        // Get group_info for server to observe
        let group_info = group.group_info_message_allowing_ext_commit(true)?;
        let group_info_bytes = group_info.mls_encode_to_vec()?;

        let secret = group.export_secret(
            EXPORT_SECRET_LABEL.as_bytes(),
            self.user_id.to_le_bytes().as_slice(),
            EXPORT_SECRET_LENGTH,
        )?;
        let secret_array: [u8; EXPORT_SECRET_LENGTH] = secret.as_bytes().try_into()?;

        let signature_key = group
            .current_member_signing_identity()?
            .signature_key
            .to_vec();
        let public_key = signature_key;
        let config = RatchetConfig::default();
        let voice_ratchet_manager = GroupRatchetManager::new(
            secret_array,
            public_key,
            self.user_id,
            Some(config),
            group.context().epoch,
        );

        let voice = Voice {
            voice_id: voice_id.clone(),
            voice_name: "".to_string(),
            mls_group: Arc::new(RwLock::new(group)),
            voice_ratchet_manager: Arc::new(RwLock::new(voice_ratchet_manager)),
        };

        let mut lock = self.current_voice.write().await;
        *lock = Some(voice);

        // Send group_info to server for observation
        self.backend
            .send_group_info_to_server(voice_id, group_info_bytes.clone())
            .await?;

        Ok(group_info_bytes)
    }

    // Process welcome message after joining room
    async fn process_welcome_message(
        &self,
        voice_id: String,
        welcome_message: Vec<u8>,
    ) -> Result<(), Error> {
        log::info!("Processing welcome message for voice {}", voice_id);

        let welcome = MlsMessage::from_bytes(&welcome_message)
            .map_err(|e| anyhow::anyhow!("Failed to deserialize welcome message: {}", e))?;

        let (mut group, _) = self
            .client
            .join_group(None, &welcome, None)
            .map_err(|e| anyhow::anyhow!("Failed to join group: {}", e))?;

        group
            .write_to_storage()
            .map_err(|e| anyhow::anyhow!("Failed to write to storage: {}", e))?;

        // Export secret for ratchet manager
        let secret = group
            .export_secret(
                EXPORT_SECRET_LABEL.as_bytes(),
                self.user_id.to_le_bytes().as_slice(),
                EXPORT_SECRET_LENGTH,
            )
            .map_err(|e| anyhow::anyhow!("Failed to export secret: {}", e))?;

        let secret_array: [u8; EXPORT_SECRET_LENGTH] = secret
            .as_bytes()
            .try_into()
            .map_err(|e| anyhow::anyhow!("Secret must be exactly 16 bytes: {}", e))?;

        let group_epoch = group.context().epoch;

        // Create ratchet manager
        let signature_key = group
            .current_member_signing_identity()?
            .signature_key
            .to_vec();
        let public_key = signature_key.as_slice().to_vec();
        let config = RatchetConfig::default();
        let mut voice_ratchet_manager = GroupRatchetManager::new(
            secret_array,
            public_key,
            self.user_id,
            Some(config),
            group_epoch,
        );

        let _ = voice_ratchet_manager
            .update_voice_ratchet(&group, self.user_id)
            .await;

        // Save group and ratchet manager
        let _ = self.current_voice.write().await.insert(Voice {
            voice_id: voice_id.clone(),
            voice_name: "".to_string(),
            mls_group: Arc::new(RwLock::new(group)),
            voice_ratchet_manager: Arc::new(RwLock::new(voice_ratchet_manager)),
        });

        log::info!("Successfully joined group: {}", voice_id);
        Ok(())
    }

    pub async fn initialize(&self) -> Result<(), anyhow::Error> {
        self.backend.initialize().await
    }

    pub async fn join(&self, session_id: String) -> Result<(), anyhow::Error> {
        log::info!("join: session_id={:?}", session_id);

        let session_exists = self.backend.try_get_room(session_id.clone()).await?;

        if session_exists {
            log::info!("Session {} exists, joining room", session_id);

            // Create key package for joining
            let key_package = self
                .client
                .generate_key_package_message(Default::default(), Default::default(), None)
                .map_err(|e| anyhow::anyhow!("Failed to generate key package: {}", e))?;

            let key_package_bytes = key_package
                .mls_encode_to_vec()
                .map_err(|e| anyhow::anyhow!("Failed to serialize key package: {}", e))?;

            // Send join request to server and wait for welcome message
            let welcome_message = self
                .backend
                .join_room(session_id.clone(), key_package_bytes)
                .await?;

            // Process welcome message to join the group
            self.process_welcome_message(session_id, welcome_message)
                .await?;

            log::info!("Successfully joined existing session");
        } else {
            log::info!(
                "Session {} does not exist, creating new voice channel",
                session_id
            );

            let _group_info_bytes = self.create_voice_channel(session_id.clone()).await?;
            log::info!("Created new voice channel");
        };

        Ok(())
    }

    // Отправка голосового сообщения
    pub async fn send_voice_message(&self, message: Vec<u8>) -> Result<(), anyhow::Error> {
        let voice_id = {
            let lock = self.current_voice.read().await;
            lock.as_ref()
                .map(|v| v.voice_id.clone())
                .ok_or_else(|| anyhow::anyhow!("No active voice session"))?
        };

        self.backend
            .send_voice_message(voice_id, message)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to send voice message: {}", e))
    }

    pub async fn leave_voice_channel(&self) -> Result<(), anyhow::Error> {
        log::info!("Leaving voice channel");

        {
            let lock = self.current_voice.read().await;
            let voice = lock
                .as_ref()
                .ok_or_else(|| anyhow::anyhow!("No active voice session"))?;
            let mut voice_mls_group = voice.mls_group.write().await;
            let leave_message = voice_mls_group
                .propose_self_remove(Vec::new())
                .map_err(|e| anyhow::anyhow!("Failed to propose self remove: {}", e))?;

            // Сериализуем сообщение для отправки
            let leave_message_bytes = leave_message
                .mls_encode_to_vec()
                .map_err(|e| anyhow::anyhow!("Failed to serialize leave message: {}", e))?;

            // Отправляем сообщение о выходе из группы
            self.send_voice_message(leave_message_bytes).await?;
        }
        self.close_voice_channel().await?;
        Ok(())
    }

    pub async fn close_voice_channel(&self) -> Result<(), anyhow::Error> {
        log::info!("Closing voice channel");
        let mut lock = self.current_voice.write().await;
        *lock = None;
        self.backend
            .close_signaling_stream()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to close signaling stream: {}", e))
    }

    // Инициализация signaling stream для WebRTC
    pub async fn init_signaling_stream(
        &self,
        room_id: String,
        rtp_capabilities: Option<String>,
    ) -> Result<(), anyhow::Error> {
        log::info!("Initializing signaling stream for room {}", room_id);

        // Set voice data handler before initializing stream
        let voice_handler = VoiceHandler::new(
            self.current_voice.clone(),
            self.user_id,
            self.identity.clone(),
            self.backend.clone(),
        );

        let voice_data_handler = voice_handler.create_voice_data_handler();
        self.backend
            .set_voice_data_handler(voice_data_handler)
            .await;

        // Set MLS event handler for AddProposal and ServerCommit
        let mls_handler = VoiceHandler::create_mls_event_handler(
            self.current_voice.clone(),
            self.backend.clone(),
            self.user_id,
        );
        self.backend.set_mls_event_handler(mls_handler).await;

        // Set commit response handler for ServerCommitResponse
        let commit_response_handler =
            VoiceHandler::create_commit_response_handler(self.current_voice.clone(), self.user_id);
        self.backend
            .set_commit_response_handler(commit_response_handler)
            .await;

        self.backend
            .init_signaling_stream(room_id, rtp_capabilities)
            .await?;
        Ok(())
    }

    // Отправка signaling сообщения
    pub async fn send_signaling_message(
        &self,
        message: echolocator::ClientMessage,
    ) -> Result<(), anyhow::Error> {
        self.backend.send_signaling_message(message).await?;
        Ok(())
    }

    /// Export key material for TypeScript SubtleCrypto layer
    pub async fn get_voice_keys(
        &self,
    ) -> Result<crate::api::voice::types::ratchet_key::VoiceKeysPayload, anyhow::Error> {
        let lock = self.current_voice.read().await;
        let voice = lock
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("No active voice session"))?;
        let manager = voice.voice_ratchet_manager.read().await;
        Ok(manager.export_key_material().await)
    }

    pub async fn is_joined(&self) -> bool {
        self.current_voice.read().await.is_some()
    }
}
