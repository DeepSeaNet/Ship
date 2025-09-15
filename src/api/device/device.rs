use mls_rs::{
    ExtensionList, MlsMessage,
    client_builder::ClientBuilder,
    extension::{MlsExtension, recommended::LastResortKeyPackageExt},
    identity::MlsCredential,
};
use mls_rs_codec::{MlsDecode, MlsEncode};
use mls_rs_core::identity::SigningIdentity;
use mls_rs_provider_sqlite::{
    SqLiteDataStorageEngine, connection_strategy::FileConnectionStrategy,
};
use moka::future::{Cache, CacheBuilder};
use rand::Rng;
use std::time::Duration;
use std::{sync::Arc, time::SystemTime};
use tauri::AppHandle;

use crate::api::{
    account::Account,
    connection::get_group_servers,
    device::{
        connection::Backend,
        db::{self},
        handler::GroupHandler,
        mls_client::MlsClient,
        types::{
            config::{CIPHER_SUITE, crypto},
            custom_mls::{
                credentials::AccountCredential, identity::CustomIdentityProvider,
                rules::CustomMlsRules,
            },
            errors::GroupError,
            extensions::{
                group_config::group_extension::{
                    GROUP_CONFIG_EXTENSION_V1, UPDATE_GROUP_CONFIG_PROPOSAL_V1,
                },
                roster::roster_extension::{
                    ADD_USER_PROPOSAL_V1, REMOVE_USER_PROPOSAL_V1, ROSTER_EXTENSION_V1,
                },
            },
            group::GroupStorage,
            identity_keypair::IdentityKeypair,
            signature_bytes::{InitGroupStreamTBS, RegisterGroupDeviceTBS, UploadKeyPackagesTBS},
        },
    },
};

pub struct Device {
    pub identity: IdentityKeypair,
    pub device_id: String,
    pub client: MlsClient,
    pub account: Arc<Account>,
    pub groups: GroupStorage,
    pub backend: Option<Backend>,
    pub app_handle: Option<AppHandle>,
    pub(super) contacts_parsed_cache: Cache<u64, AccountCredential>,
    pub(super) display_key_cache: Cache<Vec<u8>, Vec<u8>>,
}

impl Device {
    /// Creates a new group device account
    ///
    /// - Generates a device identity bound to the provided `account`
    /// - Builds an MLS client with custom providers and extensions
    /// - Initializes local storage and optionally the backend connection
    pub async fn new(
        device_id: &str,
        account: Arc<Account>,
        app_handle: Option<AppHandle>,
    ) -> Result<Self, GroupError> {
        let identity = IdentityKeypair::new(device_id, &account).await?;
        let client = Self::create_client(&identity)?;
        let db_path = db::get_default_db_path(account.credential.account_id.user_id);
        let groups = GroupStorage::new(db_path).await?;
        let backend = Backend::new(get_group_servers()).await.ok();
        let contacts_parsed_cache = CacheBuilder::new(10_000)
            .time_to_live(Duration::from_secs(60 * 30))
            .build();
        let display_key_cache = CacheBuilder::new(2_000)
            .time_to_live(Duration::from_secs(60 * 10))
            .build();
        Ok(Self {
            identity,
            device_id: device_id.to_string(),
            client,
            account,
            groups,
            backend,
            app_handle,
            contacts_parsed_cache,
            display_key_cache,
        })
    }

    /// Initialize backend connection if not already present
    ///
    /// Establishes the stream and installs the group message handler.
    pub async fn init_backend(&mut self) -> Result<(), GroupError> {
        if self.backend.is_none() {
            let backend = Backend::new(get_group_servers()).await.ok();
            self.init_stream().await?;
            self.backend = backend;
        }
        Ok(())
    }

    /// Reconstruct a device from serialized identity bytes and existing storage
    async fn from_bytes(
        identity: &mut &[u8],
        account: Arc<Account>,
        device_id: &str,
        groups: GroupStorage,
        app_handle: Option<AppHandle>,
    ) -> Result<Self, GroupError> {
        let identity = IdentityKeypair::from_bytes(identity)?;
        let client = Self::create_client(&identity)?;
        let backend = Backend::new(get_group_servers()).await.ok();
        groups.load_groups(&client).await?;
        let contacts_parsed_cache = CacheBuilder::new(10_000)
            .time_to_live(Duration::from_secs(60 * 30))
            .build();
        let display_key_cache = CacheBuilder::new(2_000)
            .time_to_live(Duration::from_secs(60 * 10))
            .build();
        Ok(Self {
            identity,
            device_id: device_id.to_string(),
            client,
            account,
            groups,
            backend,
            app_handle,
            contacts_parsed_cache,
            display_key_cache,
        })
    }

    /// Persist device identity metadata into the message store
    pub async fn save_to_db(&self) -> Result<(), GroupError> {
        let identity_bytes = self.identity.mls_encode_to_vec()?;
        self.groups
            .messages
            .save_user(
                self.user_id() as i64,
                &self.device_id.clone(),
                &identity_bytes,
            )
            .await
            .map_err(|e| GroupError::StorageError(format!("Failed to save user to db: {}", e)))?;

        Ok(())
    }

    /// Load device state from database, bootstrap stream, ensure key packages
    pub async fn load_from_db(
        account: Arc<Account>,
        app_handle: Option<AppHandle>,
    ) -> Result<Self, GroupError> {
        let db_path = db::get_default_db_path(account.credential.account_id.user_id);
        let groups = GroupStorage::new(db_path).await?;
        let (device_id, identity_bytes) = groups
            .messages
            .load_user(account.credential.account_id.user_id as i64)
            .await
            .map_err(|e| GroupError::StorageError(format!("Failed to load user from db: {}", e)))?;
        let mut group_user = Self::from_bytes(
            &mut &*identity_bytes,
            account.clone(),
            &device_id,
            groups,
            app_handle,
        )
        .await?;

        if let Err(e) = group_user.init_stream().await {
            log::warn!("Failed to init stream: {}", e);
        }

        if group_user.client.key_package_store().count().unwrap() < 3 {
            for _ in 0..3 {
                if let Err(e) = group_user.upload_key_packages().await {
                    log::warn!("Failed to upload key packages: {}", e);
                    break;
                }
            }
        }

        Ok(group_user)
    }

    /// Get the user ID for this account
    #[inline]
    pub fn user_id(&self) -> u64 {
        self.account.credential.account_id.user_id
    }

    /// Register a brand new device with the backend and persist it locally
    pub async fn register_new_device(
        account: Arc<Account>,
        device_id: &str,
        app_handle: Option<AppHandle>,
    ) -> Result<Self, GroupError> {
        let mut device_account = Self::new(device_id, account, app_handle).await?;
        device_account.register_device().await?;
        device_account.save_to_db().await?;
        Ok(device_account)
    }

    /// Register device with backend
    ///
    /// Uploads a last-resort key package and proof-of-ownership signature.
    async fn register_device(&mut self) -> Result<(), GroupError> {
        let last_resort_key_package = self.create_last_resort_key_package().await?;
        let last_resort_key_package = last_resort_key_package.mls_encode_to_vec().map_err(|e| {
            GroupError::EncodingError(format!("Failed to encode key package: {}", e))
        })?;

        let tbs = RegisterGroupDeviceTBS {
            user_id: self.user_id(),
            device_id: self.device_id.clone(),
        };

        let signature = self.sign_tbs(&tbs).await?;
        let user_id = self.user_id();
        self.backend
            .as_mut()
            .ok_or(GroupError::BackendError("Client is offline".to_string()))?
            .register_device(
                user_id,
                self.device_id.clone(),
                Some(last_resort_key_package),
                signature,
            )
            .await
            .map_err(|e| GroupError::BackendError(format!("Device registration failed: {}", e)))
    }

    /// Upload key packages to backend
    ///
    /// Generates and uploads a fresh key package and signs the request.
    async fn upload_key_packages(&mut self) -> Result<(), GroupError> {
        let key_package = self.create_key_package().await?;
        let key_package_bytes = key_package.mls_encode_to_vec().map_err(|e| {
            GroupError::EncodingError(format!("Failed to encode key package: {}", e))
        })?;

        let tbs = UploadKeyPackagesTBS {
            user_id: self.user_id(),
            device_id: self.device_id.clone(),
            key_packages: vec![key_package_bytes.clone()],
        };

        let signature = self.sign_tbs(&tbs).await?;
        let user_id = self.user_id();
        self.backend
            .as_mut()
            .ok_or(GroupError::BackendError("Client is offline".to_string()))?
            .upload_key_packages(
                user_id,
                self.device_id.clone(),
                vec![key_package_bytes],
                signature,
            )
            .await
            .map_err(|e| GroupError::BackendError(format!("Key package upload failed: {}", e)))
    }

    /// Initialize message stream with backend
    ///
    /// Signs and opens a stream; registers group IDs for delivery and
    /// starts the background handler.
    pub async fn init_stream(&mut self) -> Result<(), GroupError> {
        let current_time = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .map_err(|_| GroupError::SystemTimeError("Failed to get current time:".to_string()))?
            .as_secs();

        let tbs = InitGroupStreamTBS {
            user_id: self.user_id(),
            device_id: self.device_id.clone(),
            date: current_time,
        };

        let signature = self.sign_tbs(&tbs).await?;
        let user_id = self.user_id();
        let group_ids = self.groups.list_groups().await;
        self.backend
            .as_mut()
            .ok_or(GroupError::BackendError("Client is offline".to_string()))?
            .init_stream(
                user_id,
                self.device_id.clone(),
                signature,
                tbs.date,
                group_ids,
            )
            .await
            .map_err(|e| {
                GroupError::ConnectionError(format!("Stream initialization failed: {}", e))
            })?;

        self.init_group_handler().await
    }

    /// Initialize group message handler
    ///
    /// Spawns an async task that processes inbound group events.
    async fn init_group_handler(&mut self) -> Result<(), GroupError> {
        let backend = self
            .backend
            .as_ref()
            .ok_or(GroupError::BackendError("Client is offline".to_string()))?;

        let mut handler = GroupHandler::new(
            self.user_id(),
            self.client.clone(),
            self.groups.clone(),
            backend.clone(),
            self.app_handle.clone(),
            self.device_id.clone(),
            self.account.clone(),
        );

        tokio::spawn(async move {
            if let Err(e) = handler.process_stream().await {
                log::error!("Group handler error: {}", e);
            }
        });

        Ok(())
    }

    /// Create MLS client with proper configuration
    ///
    /// Configures storage, identity provider, rules, extensions and crypto.
    fn create_client(identity: &IdentityKeypair) -> Result<MlsClient, GroupError> {
        let mls_credential = identity.credential.clone().into_credential().map_err(|e| {
            GroupError::CredentialError(format!("Credential conversion failed: {}", e))
        })?;

        let signing_identity = SigningIdentity::new(mls_credential, identity.public_key.clone());
        let path = get_default_db_path(
            identity.credential.device_id.user_id,
            &identity.credential.device_id.device_id,
        );
        let sqlite_storage = SqLiteDataStorageEngine::new(FileConnectionStrategy::new(&path))
            .map_err(|e| {
                GroupError::StorageError(format!("Storage engine creation failed: {}", e))
            })?;
        Ok(ClientBuilder::new_sqlite(sqlite_storage)
            .map_err(|e| {
                GroupError::ClientBuilderError(format!("Client builder creation failed: {}", e))
            })?
            .identity_provider(CustomIdentityProvider)
            .mls_rules(CustomMlsRules)
            .custom_proposal_type(ADD_USER_PROPOSAL_V1)
            .custom_proposal_type(REMOVE_USER_PROPOSAL_V1)
            .custom_proposal_type(UPDATE_GROUP_CONFIG_PROPOSAL_V1)
            .extension_type(ROSTER_EXTENSION_V1)
            .extension_type(GROUP_CONFIG_EXTENSION_V1)
            .crypto_provider(crypto())
            .signing_identity(signing_identity, identity.signer.clone(), CIPHER_SUITE)
            .build())
    }

    /// Generate a key package for joining groups
    pub async fn create_key_package(&self) -> Result<MlsMessage, GroupError> {
        self.client
            .generate_key_package_message(Default::default(), Default::default(), None)
            .await
            .map_err(|e| GroupError::MlsError(format!("Key package generation failed: {}", e)))
    }

    /// Generate a last-resort key package for device recovery
    pub async fn create_last_resort_key_package(&self) -> Result<MlsMessage, GroupError> {
        let extension = LastResortKeyPackageExt::into_extension(LastResortKeyPackageExt)?;
        let extensions = ExtensionList::from(vec![extension]);

        self.client
            .generate_key_package_message(extensions, Default::default(), None)
            .await
            .map_err(|e| GroupError::MlsError(format!("Key package generation failed: {}", e)))
    }

    /// Retrieve and cache an account credential for a user
    pub(super) async fn get_contact(
        &mut self,
        user_id: u64,
    ) -> Result<AccountCredential, GroupError> {
        if let Some(cached) = self.contacts_parsed_cache.get(&user_id).await {
            return Ok(cached);
        }
        let contact = self.groups.messages.get_contact(user_id as i64).await?;
        let parsed = match contact {
            Some(user_credential) => AccountCredential::mls_decode(&mut &*user_credential)?,
            None => {
                let user_credential = self
                    .backend
                    .as_mut()
                    .ok_or(GroupError::BackendError("Client is offline".to_string()))?
                    .get_user_credential(user_id)
                    .await
                    .map_err(|e| {
                        GroupError::BackendError(format!("Failed to fetch user credential: {}", e))
                    })?;
                self.groups
                    .messages
                    .save_contact(user_id as i64, &user_credential)
                    .await?;
                AccountCredential::mls_decode(&mut &*user_credential)?
            }
        };
        self.contacts_parsed_cache
            .insert(user_id, parsed.clone())
            .await;
        Ok(parsed)
    }

    /// Sign TBS (To Be Signed) structure
    async fn sign_tbs<T: MlsEncode>(&self, tbs: &T) -> Result<Vec<u8>, GroupError> {
        let tbs_bytes = tbs
            .mls_encode_to_vec()
            .map_err(|e| GroupError::EncodingError(format!("TBS encoding failed: {}", e)))?;
        self.account.sign_message(&tbs_bytes).await
    }

    /// Generate a random message identifier
    pub fn generate_message_id() -> u64 {
        let mut rng = rand::rng();
        rng.random_range(0..u64::MAX)
    }
}

/// Build default path for the SQLite storage file for a device
pub fn get_default_db_path(account_id: u64, device_id: &str) -> std::path::PathBuf {
    #[cfg(not(target_os = "ios"))]
    {
        let mut path = dirs::home_dir().expect("Could not find home directory");
        path.push(".anongram/group");
        std::fs::create_dir_all(&path).expect("Could not create .anongram directory");
        path.push(format!("group_{}_{}.db", account_id, device_id));
        path
    }
    #[cfg(target_os = "ios")]
    {
        let mut path = dirs::document_dir().expect("Could not find home directory");
        path.push(".anongram/group");
        std::fs::create_dir_all(&path).expect("Could not create .anongram directory");
        path.push(format!("group_{}_{}.db", account_id, device_id));
        path
    }
}
