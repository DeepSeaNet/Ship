use mls_rs::error::MlsError;
use mls_rs_codec::Error as CodecError;
use mls_rs_crypto_awslc::AwsLcCryptoError;
use thiserror::Error;
use tonic::Status;

#[derive(Debug, Error)]
pub enum VoiceError {
    #[error("MLS error: {0}")]
    Mls(#[from] MlsError),

    #[error("Codec error: {0}")]
    Codec(#[from] CodecError),

    #[error("gRPC status error: {0}")]
    Grpc(#[from] Status),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),

    #[error("Backend error: {0}")]
    Backend(String),

    #[error("Cipher suite not supported")]
    CipherSuiteNotSupported,

    #[error("No active voice session")]
    NoActiveSession,

    #[error("Failed to deserialise {0}: {1}")]
    DeserializationError(String, String),

    #[error("Secret must be exactly {expected} bytes, got {got}")]
    InvalidSecretSize { expected: usize, got: usize },

    #[error("Transport error: {0}")]
    Transport(#[from] tonic::transport::Error),

    #[error("Crypto error: {0}")]
    Crypto(#[from] AwsLcCryptoError),

    #[error("Extension error: {0}")]
    Extension(#[from] mls_rs_core::extension::ExtensionError),

    #[error("Slice conversion error: {0}")]
    SliceConversion(#[from] std::array::TryFromSliceError),
}

pub type VoiceResult<T> = Result<T, VoiceError>;
