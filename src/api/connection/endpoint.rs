use quinn::crypto::rustls::QuicClientConfig;
use quinn::{ClientConfig as QuinnClientConfig, Endpoint, TransportConfig};
use rustls::ClientConfig as RustlsClientConfig;
use rustls_platform_verifier::BuilderVerifierExt;
use std::sync::Arc;

pub fn create_client_endpoint() -> Result<Endpoint, Box<dyn std::error::Error>> {
    let provider = Arc::new(rustls::crypto::aws_lc_rs::default_provider());
    let mut rustls_config = RustlsClientConfig::builder_with_provider(provider)
        .with_safe_default_protocol_versions()?
        .with_platform_verifier()?
        .with_no_client_auth();

    rustls_config.alpn_protocols = vec![b"h3".to_vec(), b"h3-29".to_vec()];
    rustls_config.enable_early_data = true;

    let mut endpoint = Endpoint::client("[::]:0".parse()?)?;
    let mut client_config =
        QuinnClientConfig::new(Arc::new(QuicClientConfig::try_from(rustls_config)?));

    let mut transport_config = TransportConfig::default();
    transport_config.max_idle_timeout(Some(std::time::Duration::from_secs(30).try_into().unwrap()));
    transport_config.keep_alive_interval(Some(std::time::Duration::from_secs(5)));
    client_config.transport_config(Arc::new(transport_config));

    endpoint.set_default_client_config(client_config);

    Ok(endpoint)
}
