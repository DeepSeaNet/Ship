use thiserror::Error;
use tonic::Status;

#[derive(Debug, Error)]
pub enum StatusError {
    #[error("gRPC status error: {0}")]
    Grpc(#[from] Status),

    #[error("Database error: {0}")]
    Database(String),

    #[error("Failed to update avatar")]
    AvatarUpdateFailed,

    #[error("Internal error: {0}")]
    Internal(String),

    #[error("System time error: {0}")]
    SystemTime(#[from] std::time::SystemTimeError),

    #[error("User not found")]
    UserNotFound,

    #[error("Account error: {0}")]
    Account(#[from] crate::api::account::AccountError),
}

impl From<sqlx::Error> for StatusError {
    fn from(e: sqlx::Error) -> Self {
        Self::Database(e.to_string())
    }
}

pub type StatusResult<T> = Result<T, StatusError>;
