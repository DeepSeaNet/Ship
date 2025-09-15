//! Error types for the MLS User Access Control system

use mls_rs::error::MlsError;
use mls_rs_core::{error::IntoAnyError, extension::ExtensionError};
use tonic::Status;

use super::group::GroupId;

// Enhanced error types with more specific information
#[derive(Debug, thiserror::Error)]
pub enum GroupError {
    #[error("Group not found: {0:?}")]
    GroupNotFound(GroupId),

    #[error("Crypto error: {0}")]
    CryptoError(String),

    #[error("Encoding error: {0}")]
    EncodingError(String),

    #[error("Credential error: {0}")]
    CredentialError(String),

    #[error("Storage error: {0}")]
    StorageError(String),

    #[error("Client builder error: {0}")]
    ClientBuilderError(String),

    #[error("Extension error: {0}")]
    ExtensionError(String),

    #[error("Invalid message: {0}")]
    InvalidMessage(String),

    #[error("Message processing error: {0}")]
    MessageProcessingError(String),

    #[error("Message decoding error: {0}")]
    MessageDecodingError(String),

    #[error("Codec error: {0}")]
    CodecError(String),

    #[error("Mls error: {0}")]
    MlsError(String),

    #[error("Configuration not found")]
    ConfigurationNotFound,

    #[error("Roster not found")]
    RosterNotFound,

    #[error("User is not in roster")]
    UserIsNotInRoster,

    #[error("Credential type miss match")]
    CredentialMissmatch,

    #[error("Status error: {0}")]
    StatusError(String),

    #[error("Connection error: {0}")]
    ConnectionError(String),

    #[error("Config validation error: {0}")]
    ConfigValidationError(String),

    #[error("Backend error: {0}")]
    BackendError(String),

    #[error("System time error: {0}")]
    SystemTimeError(String),

    #[error("Event error: {0}")]
    EventError(String),

    #[error("Config error: {0}")]
    ConfigError(String),

    #[error("Database error: {0}")]
    DatabaseError(String),
}

impl IntoAnyError for GroupError {
    fn into_dyn_error(self) -> Result<Box<dyn std::error::Error + Send + Sync>, Self> {
        Ok(Box::new(self))
    }
}

impl From<MlsError> for GroupError {
    fn from(e: MlsError) -> Self {
        Self::MlsError(e.to_string())
    }
}

impl From<mls_rs_codec::Error> for GroupError {
    fn from(e: mls_rs_codec::Error) -> Self {
        Self::CodecError(e.to_string())
    }
}

impl From<ExtensionError> for GroupError {
    fn from(e: ExtensionError) -> Self {
        Self::ExtensionError(e.to_string())
    }
}

impl From<Status> for GroupError {
    fn from(e: Status) -> Self {
        Self::StatusError(e.to_string())
    }
}

impl From<sqlx::Error> for GroupError {
    fn from(e: sqlx::Error) -> Self {
        Self::DatabaseError(e.to_string())
    }
}

impl From<sqlx::migrate::MigrateError> for GroupError {
    fn from(e: sqlx::migrate::MigrateError) -> Self {
        Self::DatabaseError(e.to_string())
    }
}
