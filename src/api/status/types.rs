use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplayUserStatus {
    pub status: String,
    pub user_id: i64,
    pub last_seen: i64,
    pub is_online: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplayUserInfo {
    pub user_id: i64,
    pub username: String,
    pub avatar: String,
    pub status: String,
    pub last_seen: i64,
    pub created_at: i64,
    pub trust_level: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DisplayUserTypingStatus {
    pub user_id: i64,
    pub chat_id: String,
    pub status: String,
}

pub struct Avatar {
    pub avatar_url: String,
    pub avatar_hash: String,
    pub file_size: i32,
    pub mime_type: String,
    pub width: i32,
    pub height: i32,
}
