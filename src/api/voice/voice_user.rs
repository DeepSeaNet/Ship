use log;
use mls_rs::{
    CipherSuite, CipherSuiteProvider, CryptoProvider, ExtensionList, Group, MlsMessage,
    client::Client,
    client_builder::{BaseConfig, ClientBuilder, WithCryptoProvider, WithIdentityProvider},
    crypto::SignatureSecretKey,
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

use crate::api::voice::types::basic_types::{
    EXPORT_SECRET_LABEL, EXPORT_SECRET_LENGTH, Voice, VoiceId,
};
use crate::api::voice::types::ratchet_key::GroupRatchetManager;
use crate::api::voice::types::ratchet_key::RatchetConfig;
use crate::api::voice::voice_handler::VoiceHandler;
use crate::api::voice::{connection::voice_connection::Backend, types::basic_types::VoiceUserData};
use mls_rs_crypto_rustcrypto::RustCryptoProvider;
use std::path::PathBuf;

const CIPHERSUITE: CipherSuite = CipherSuite::CURVE25519_AES128;

pub type MlsClient = Client<
    WithIdentityProvider<BasicIdentityProvider, WithCryptoProvider<RustCryptoProvider, BaseConfig>>,
>;
pub type MlsGroup = Group<
    WithIdentityProvider<BasicIdentityProvider, WithCryptoProvider<RustCryptoProvider, BaseConfig>>,
>;

pub struct VoiceUser {
    current_voice: Arc<RwLock<Option<Voice>>>,
    identity: SigningIdentity,
    signer: SignatureSecretKey,
    backend: Backend,
    client: MlsClient,
    app_handle: Option<tauri::AppHandle>,
    user_id: u64,
}

impl VoiceUser {
    pub async fn new(user_id: i64) -> Self {
        let crypto_provider = RustCryptoProvider::default();
        let cipher_suite = crypto_provider.cipher_suite_provider(CIPHERSUITE).unwrap();
        let (secret, public) = cipher_suite.signature_key_generate().await.unwrap();
        let basic_identity = BasicCredential::new(user_id.to_le_bytes().to_vec());
        let signing_identity = SigningIdentity::new(basic_identity.into_credential(), public);

        let client = ClientBuilder::new()
            .identity_provider(BasicIdentityProvider)
            .crypto_provider(crypto_provider.clone())
            .signing_identity(signing_identity.clone(), secret.clone(), CIPHERSUITE)
            .build();
        let voice_user = Self {
            current_voice: Arc::new(RwLock::new(None)),
            identity: signing_identity,
            signer: secret,
            backend: Backend::new(),
            client,
            user_id: user_id as u64,
            app_handle: None,
        };
        voice_user.save().await;
        voice_user
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

    pub async fn load(user_id: u64) -> Result<Self, anyhow::Error> {
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

        let crypto_provider = RustCryptoProvider::default();

        let client = ClientBuilder::new()
            .identity_provider(BasicIdentityProvider)
            .crypto_provider(crypto_provider.clone())
            .signing_identity(data.identity.clone(), data.signer.clone(), CIPHERSUITE)
            .build();

        let voice_user = Self {
            current_voice: Arc::new(RwLock::new(None)),
            identity: data.identity,
            signer: data.signer,
            backend: Backend::new(),
            client,
            user_id: data.user_id,
            app_handle: None,
        };
        Ok(voice_user)
    }

    fn get_file_path(user_id: u64) -> PathBuf {
        #[cfg(not(target_os = "ios"))]
        {
            let mut path = dirs::home_dir().expect("Could not find home directory");
            path.push(".anongram");
            std::fs::create_dir_all(&path).expect("Could not create .anongram directory");
            path.push(format!("voice_{}.json", user_id));
            path
        }
        #[cfg(target_os = "ios")]
        {
            let mut path = dirs::document_dir().expect("Could not find home directory");
            path.push(".anongram");
            std::fs::create_dir_all(&path).expect("Could not create .anongram directory");
            path.push(format!("voice_{}.json", user_id));
            path
        }
    }

    pub async fn create_voice_channel(&self, voice_id: String) -> Result<Vec<u8>, anyhow::Error> {
        let group_id = VoiceId::from_string(&voice_id);
        let group = self
            .client
            .create_group_with_id(
                group_id.to_vec(),
                ExtensionList::default(),
                Default::default(),
                None,
            )
            .await
            .map_err(|e| anyhow::anyhow!("Failed to create MLS group: {}", e))?;

        let group_info = group.group_info_message_allowing_ext_commit(true).await?;
        let group_info_bytes = group_info.mls_encode_to_vec()?;

        let secret = group
            .export_secret(
                EXPORT_SECRET_LABEL.as_bytes(),
                self.user_id.to_le_bytes().as_slice(),
                EXPORT_SECRET_LENGTH,
            )
            .await?;
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

        Ok(group_info_bytes)
    }

    // Обработка полученной групповой информации
    pub async fn process_received_group_info(
        &self,
        voice_id: &str,
        group_info: Vec<u8>,
    ) -> Result<(), Error> {
        if group_info.is_empty() {
            log::info!("No group info received for voice {}", voice_id);
            return Ok(());
        }

        log::info!(
            "Processing received group info for voice {}, size: {}",
            voice_id,
            group_info.len()
        );
        let group_info = MlsMessage::from_bytes(&group_info)
            .map_err(|e| anyhow::anyhow!("Failed to deserialize group info: {}", e))?;
        // Присоединяемся к группе по информации о группе
        let (mut group, welcome) = self
            .client
            .commit_external(group_info)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to join by external commit: {}", e))?;

        group
            .write_to_storage()
            .await
            .map_err(|e| anyhow::anyhow!("Failed to write to storage: {}", e))?;
        // Получаем сообщение для отправки другим участникам
        let message = welcome
            .to_bytes()
            .map_err(|e| anyhow::anyhow!("Failed to serialize welcome message: {}", e))?;

        // Экспортируем обновленную информацию о группе
        let updated_group_info = group
            .group_info_message(true)
            .await
            .map_err(|e| anyhow::anyhow!("Cannot export updated group info: {}", e))?;

        // Экспортируем секрет для рачет-менеджера
        let secret = group
            .export_secret(
                EXPORT_SECRET_LABEL.as_bytes(),
                self.user_id.to_le_bytes().as_slice(),
                EXPORT_SECRET_LENGTH,
            )
            .await
            .map_err(|e| anyhow::anyhow!("Failed to export secret: {}", e))?;

        let secret_array: [u8; EXPORT_SECRET_LENGTH] = secret
            .as_bytes()
            .try_into()
            .map_err(|e| anyhow::anyhow!("Secret must be exactly 16 bytes: {}", e))?;

        let group_epoch = group.context().epoch;

        // Создаем рачет-менеджер с обновленными данными
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

        // Сериализуем обновленную информацию о группе
        let group_info_bytes = updated_group_info
            .mls_encode_to_vec()
            .map_err(|e| anyhow::anyhow!("Failed to serialize updated group info: {}", e))?;

        // Сохраняем группу и рачет-менеджер
        let _ = self.current_voice.write().await.insert(Voice {
            voice_id: voice_id.to_string(),
            voice_name: "".to_string(),
            mls_group: Arc::new(RwLock::new(group)),
            voice_ratchet_manager: Arc::new(RwLock::new(voice_ratchet_manager)),
        });

        // Отправляем сообщение для присоединения к группе
        self.send_voice_message(message).await?;
        log::info!("Successfully joined by external commit: {}", voice_id);

        // Обновляем информацию о группе на сервере
        self.backend
            .update_group_info(voice_id.to_string(), group_info_bytes)
            .await?;

        Ok(())
    }

    pub async fn encrypt_voice(&self, bytes: Vec<u8>) -> Result<Vec<u8>, anyhow::Error> {
        let lock = self.current_voice.read().await;
        let voice = lock
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("No active voice session"))?;
        voice
            .voice_ratchet_manager
            .read()
            .await
            .encrypt(&bytes)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to encrypt message: {:?}", e))
    }

    pub async fn decrypt_voice(&self, bytes: Vec<u8>) -> Result<Vec<u8>, anyhow::Error> {
        let lock = self.current_voice.read().await;
        let voice = lock
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("No active voice session"))?;
        voice
            .voice_ratchet_manager
            .read()
            .await
            .decrypt(&bytes)
            .await
            .map_err(|e| anyhow::anyhow!("Failed to decrypt message: {:?}", e))
    }

    pub async fn initialize(&self) -> Result<(), anyhow::Error> {
        self.backend.initialize().await
    }

    pub async fn join(&self, session_id: String) -> Result<(), anyhow::Error> {
        log::info!("join: session_id={:?}", session_id);
        self.init_voice_stream().await?;

        let session_exists = self.backend.try_get_room(session_id.clone()).await?;

        if let Some(session_exists) = session_exists {
            log::info!("Session {} exists, joining with group info", session_id);
            if let Err(e) = self
                .process_received_group_info(&session_id, session_exists)
                .await
            {
                log::error!("Failed to process received group info: {}", e);
                return Err(anyhow::anyhow!(
                    "Failed to process received group info: {}",
                    e
                ));
            }
        } else {
            log::info!(
                "Session {} does not exist, creating new voice channel",
                session_id
            );
            let voice_id = session_id.clone();

            let group_info_bytes = self.create_voice_channel(voice_id.clone()).await?;
            self.backend
                .update_group_info(voice_id, group_info_bytes)
                .await?;
            log::info!("Created new voice channel");
        };

        let voice_id = session_id.clone();

        self.init_voice_stream_for_channel(&voice_id).await?;

        Ok(())
    }

    pub async fn init_voice_stream(&self) -> Result<(), anyhow::Error> {
        log::info!(
            "Initializing general voice stream for user {}",
            self.user_id
        );

        let voice_handler = VoiceHandler::new(
            self.current_voice.clone(),
            self.user_id,
            self.identity.clone(),
            self.backend.clone(),
        );
        let handler = voice_handler.create_handler();

        self.backend
            .init_voice_stream(self.user_id, Arc::new(handler))
            .await?;

        log::info!("General voice stream initialized successfully");
        Ok(())
    }

    pub async fn init_voice_stream_for_channel(&self, voice_id: &str) -> Result<(), anyhow::Error> {
        log::info!(
            "Initializing voice stream for user {} in channel {}",
            self.user_id,
            voice_id
        );

        let voice_handler = VoiceHandler::new(
            self.current_voice.clone(),
            self.user_id,
            self.identity.clone(),
            self.backend.clone(),
        );
        let handler = voice_handler.create_handler();

        self.backend
            .init_voice_stream_for_channel(self.user_id, voice_id.to_string(), Arc::new(handler))
            .await?;

        log::info!(
            "Voice stream initialized successfully for channel {}",
            voice_id
        );
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

        match self
            .backend
            .send_voice_message(self.user_id, voice_id.clone(), message.clone())
            .await
        {
            Ok(_) => Ok(()),
            Err(e) => {
                if e.to_string().contains("Voice stream not initialized") {
                    self.init_voice_stream_for_channel(&voice_id).await?;
                    self.backend
                        .send_voice_message(self.user_id, voice_id, message.clone())
                        .await?;
                    return Ok(());
                }
                Err(anyhow::anyhow!("Failed to send voice message: {}", e))
            }
        }
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
                .await
                .map_err(|e| anyhow::anyhow!("Failed to propose self remove: {}", e))?;

            // Сериализуем сообщение для отправки
            let leave_message_bytes = leave_message
                .mls_encode_to_vec()
                .map_err(|e| anyhow::anyhow!("Failed to serialize leave message: {}", e))?;

            // Отправляем сообщение о выходе из группы
            self.send_voice_message(leave_message_bytes).await?;
        }

        // Удаляем информацию о группе из локального хранилища
        let mut lock = self.current_voice.write().await;
        *lock = None;
        Ok(())
    }
}
