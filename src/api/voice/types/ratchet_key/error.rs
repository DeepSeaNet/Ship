#[derive(Debug)]
pub enum RatchetError {
    EncryptError(String),
    DecryptError(String),
    InvalidFormat,
    TooManySkippedMessages,
    EpochNotFound,
    MissingSharedSecret,
}
