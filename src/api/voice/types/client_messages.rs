use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoveUserMessage {
    pub user_id: u64,
    pub voice_id: String,
    pub reason: String,
}
