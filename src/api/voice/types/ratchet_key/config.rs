use super::constants::DEFAULT_MAX_EPOCHS;

#[derive(Debug, Clone)]
pub struct RatchetConfig {
    pub max_previous_epochs: usize,
}

impl Default for RatchetConfig {
    fn default() -> Self {
        Self {
            max_previous_epochs: DEFAULT_MAX_EPOCHS,
        }
    }
}
