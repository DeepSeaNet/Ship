//! MLS client type definition

use mls_rs::Client;
use mls_rs::client_builder::{
    BaseSqlConfig, WithCryptoProvider, WithIdentityProvider, WithMlsRules,
};
use mls_rs_crypto_rustcrypto::RustCryptoProvider;

use crate::api::device::types::custom_mls::{
    identity::CustomIdentityProvider, rules::CustomMlsRules,
};

pub type MlsClient = Client<
    WithIdentityProvider<
        CustomIdentityProvider,
        WithCryptoProvider<RustCryptoProvider, WithMlsRules<CustomMlsRules, BaseSqlConfig>>,
    >,
>;
