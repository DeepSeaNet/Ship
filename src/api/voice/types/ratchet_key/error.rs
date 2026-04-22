use thiserror::Error;

#[derive(Debug, Error)]
pub enum RatchetError {
    #[error("DecryptError: {0}")]
    DecryptError(String),
    #[error("ExportError: {0}")]
    ExportError(String),
    #[error("MissingSharedSecret")]
    MissingSharedSecret,
}
