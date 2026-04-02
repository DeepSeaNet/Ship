#[derive(Debug)]
pub enum RatchetError {
    DecryptError(String),
    ExportError(String),
    MissingSharedSecret,
}
