//! Configuration constants and types for the MLS User Access Control system

use mls_rs::{CipherSuite, CipherSuiteProvider, CryptoProvider};
use mls_rs_core::identity::CredentialType;
use mls_rs_crypto_rustcrypto::RustCryptoProvider;

/// The cipher suite used throughout the application
pub const CIPHER_SUITE: CipherSuite = CipherSuite::CURVE25519_AES128;

/// Credential type for our custom member credentials
pub const CREDENTIAL_V1: CredentialType = CredentialType::new(65002);

/// Creates a crypto provider instance
pub fn crypto() -> RustCryptoProvider {
    mls_rs_crypto_rustcrypto::RustCryptoProvider::default()
}

/// Creates a cipher suite provider for the configured cipher suite
pub fn cipher_suite() -> impl CipherSuiteProvider {
    crypto().cipher_suite_provider(CIPHER_SUITE).unwrap()
}
