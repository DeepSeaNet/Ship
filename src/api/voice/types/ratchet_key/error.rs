#[derive(Debug)]
pub enum RatchetError {
    EncryptError(String),
    DecryptError(String),
    ExportError(String),
    InvalidFormat,
    TooManySkippedMessages,
    EpochNotFound,
    MissingSharedSecret,
}
