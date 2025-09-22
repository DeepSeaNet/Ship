use std::{sync::Arc, str::FromStr};
use quinn::{Endpoint, ClientConfig as QuinnClientConfig};
use quinn::crypto::rustls::QuicClientConfig;
use rustls::pki_types::ServerName;
use rustls::ClientConfig as RustlsClientConfig;
use tonic_h3::{H3Channel, quinn::H3QuinnConnector};
use tokio::sync::Mutex;

// --- Создание Quinn клиентского endpoint ---
pub fn create_client_endpoint() -> Result<Endpoint, Box<dyn std::error::Error>> {
    // Rustls клиент конфиг с отключенной проверкой сертификата
    let mut rustls_config = RustlsClientConfig::builder_with_provider(
        rustls::crypto::aws_lc_rs::default_provider().into()
    )
    .with_safe_default_protocol_versions()?
    .dangerous()
    .with_custom_certificate_verifier(Arc::new(danger::NoCertificateVerification::new(
        rustls::crypto::aws_lc_rs::default_provider(),
    )))
    .with_no_client_auth();

    rustls_config.alpn_protocols = vec![b"h3".to_vec()];
    rustls_config.enable_early_data = true;

    // Создаем Quinn endpoint
    let mut endpoint = Endpoint::client("[::]:0".parse()?)?;
    let client_config = QuinnClientConfig::new(Arc::new(QuicClientConfig::try_from(rustls_config)?));
    endpoint.set_default_client_config(client_config);

    Ok(endpoint)
}

// --- Модуль отключения проверки сертификата ---
mod danger {
    use rustls::client::danger::HandshakeSignatureValid;
    use rustls::pki_types::{CertificateDer, ServerName, UnixTime};
    use rustls::DigitallySignedStruct;
    use rustls::crypto::CryptoProvider;

    #[derive(Debug)]
    pub struct NoCertificateVerification(CryptoProvider);

    impl NoCertificateVerification {
        pub fn new(provider: CryptoProvider) -> Self {
            Self(provider)
        }
    }

    impl rustls::client::danger::ServerCertVerifier for NoCertificateVerification {
        fn verify_server_cert(
            &self,
            _end_entity: &CertificateDer<'_>,
            _intermediates: &[CertificateDer<'_>],
            _server_name: &ServerName<'_>,
            _ocsp: &[u8],
            _now: UnixTime,
        ) -> Result<rustls::client::danger::ServerCertVerified, rustls::Error> {
            Ok(rustls::client::danger::ServerCertVerified::assertion())
        }

        fn verify_tls12_signature(
            &self,
            message: &[u8],
            cert: &CertificateDer<'_>,
            dss: &DigitallySignedStruct,
        ) -> Result<HandshakeSignatureValid, rustls::Error> {
            rustls::crypto::verify_tls12_signature(message, cert, dss, &self.0.signature_verification_algorithms)
        }

        fn verify_tls13_signature(
            &self,
            message: &[u8],
            cert: &CertificateDer<'_>,
            dss: &DigitallySignedStruct,
        ) -> Result<HandshakeSignatureValid, rustls::Error> {
            rustls::crypto::verify_tls13_signature(message, cert, dss, &self.0.signature_verification_algorithms)
        }

        fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
            self.0.signature_verification_algorithms.supported_schemes()
        }
    }
}