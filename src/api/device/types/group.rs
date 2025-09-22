use super::{
    custom_mls::{identity::CustomIdentityProvider, rules::CustomMlsRules},
    errors::GroupError,
};

use crate::api::device::{db::GroupManager, mls_client::MlsClient};
use base64::{Engine as _, engine::general_purpose};
use mls_rs::Group;
use mls_rs::client_builder::{
    BaseSqlConfig, WithCryptoProvider, WithIdentityProvider, WithMlsRules,
};
use mls_rs_crypto_awslc::AwsLcCryptoProvider;
use std::path::PathBuf;
use std::sync::Arc;
use std::{collections::HashMap, fmt::Display};
use tokio::sync::RwLock;
pub type MlsGroup = Group<
    WithCryptoProvider<
        AwsLcCryptoProvider,
        WithIdentityProvider<CustomIdentityProvider, WithMlsRules<CustomMlsRules, BaseSqlConfig>>,
    >,
>;

/// Represents a unique group identifier
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub struct GroupId(Vec<u8>);

impl GroupId {
    pub fn new(id: Vec<u8>) -> Self {
        Self(id)
    }

    pub fn as_bytes(&self) -> &[u8] {
        &self.0
    }

    pub fn to_vec(&self) -> Vec<u8> {
        self.0.clone()
    }

    pub fn from_string(s: &str) -> Result<Self, GroupError> {
        let id = general_purpose::STANDARD
            .decode(s)
            .map_err(|e| GroupError::StorageError(format!("Failed to decode group id: {}", e)))?;
        Ok(Self(id))
    }
}

impl Display for GroupId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", general_purpose::STANDARD.encode(&self.0))
    }
}

impl From<Vec<u8>> for GroupId {
    fn from(id: Vec<u8>) -> Self {
        Self(id)
    }
}

/// Thread-safe group storage
#[derive(Clone)]
pub struct GroupStorage {
    groups: Arc<RwLock<HashMap<GroupId, Arc<RwLock<MlsGroup>>>>>,
    pub messages: GroupManager,
}

impl GroupStorage {
    pub async fn new(db_path: PathBuf) -> Result<Self, GroupError> {
        let group_manager = GroupManager::new(db_path).await.map_err(|e| {
            GroupError::StorageError(format!("Failed to create group manager: {}", e))
        })?;
        Ok(Self {
            groups: Arc::new(RwLock::new(HashMap::new())),
            messages: group_manager,
        })
    }

    pub async fn insert(&self, group_id: GroupId, group: MlsGroup) {
        let mut groups = self.groups.write().await;
        groups.insert(group_id, Arc::new(RwLock::new(group)));
    }

    pub async fn get(&self, group_id: &GroupId) -> Result<Arc<RwLock<MlsGroup>>, GroupError> {
        let groups = self.groups.read().await;
        groups
            .get(group_id)
            .cloned()
            .ok_or_else(|| GroupError::GroupNotFound(group_id.clone()))
    }

    pub async fn remove(&self, group_id: &GroupId) -> Result<(), GroupError> {
        let mut groups = self.groups.write().await;
        groups
            .remove(group_id)
            .map(|_| ())
            .ok_or_else(|| GroupError::GroupNotFound(group_id.clone()))
    }

    pub async fn list_groups(&self) -> Vec<GroupId> {
        let groups = self.groups.read().await;
        groups.keys().cloned().collect()
    }

    pub async fn load_groups(&self, client: &MlsClient) -> Result<(), GroupError> {
        let group_ids = client
            .group_state_storage()
            .group_ids()
            .map_err(|e| GroupError::StorageError(format!("Failed to get group ids: {}", e)))?;
        for group_id in group_ids {
            let group = client.load_group(&group_id).await?;
            let group_id = GroupId(group_id);
            self.insert(group_id, group).await
        }
        Ok(())
    }
}
