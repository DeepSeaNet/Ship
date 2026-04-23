use mls_rs::error::MlsError;
use mls_rs_codec::Error as CodecError;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AccountError {
    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("MLS error: {0}")]
    Mls(#[from] MlsError),

    #[error("Codec error: {0}")]
    Codec(#[from] CodecError),

    #[error("Account not found: {0}")]
    AccountNotFound(String),

    #[error("Internal error: {0}")]
    Internal(String),
}

pub type AccountResult<T> = Result<T, AccountError>;
