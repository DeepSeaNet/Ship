use crate::api::device::types::message::GroupTextMessage;
use std::str::FromStr;
use tauri::AppHandle;
use tauri_plugin_fs::{FilePath, FsExt};

pub struct MessageBuilder {
    group_id: String,
    text: String,
    file_path: Option<String>,
    reply_to: Option<String>,
    edit_message_id: Option<String>,
    expires_at: Option<i64>,
}

impl MessageBuilder {
    pub fn new(group_id: String, text: String) -> Self {
        Self {
            group_id,
            text,
            file_path: None,
            reply_to: None,
            edit_message_id: None,
            expires_at: None,
        }
    }

    pub fn with_file(mut self, file_path: String) -> Self {
        self.file_path = Some(file_path);
        self
    }

    pub fn reply_to(mut self, message_id: String) -> Self {
        self.reply_to = Some(message_id);
        self
    }

    pub fn edit_message(mut self, message_id: String) -> Self {
        self.edit_message_id = Some(message_id);
        self
    }

    pub fn expires_at(mut self, timestamp: i64) -> Self {
        self.expires_at = Some(timestamp);
        self
    }

    // Теперь build принимает уже сгенерированный message_id
    pub fn build(
        self,
        message_id: i64,
        app_handle: &AppHandle,
        sender_id: i64,
    ) -> Result<GroupTextMessage, String> {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // Используем переданный message_id или edit_message_id если это редактирование
        let final_message_id = if let Some(edit_id) = self.edit_message_id.clone() {
            edit_id.parse::<i64>().unwrap_or(message_id)
        } else {
            message_id
        };

        let edit_date = if self.edit_message_id.is_some() {
            Some(timestamp as i64)
        } else {
            None
        };

        let (media, media_name) = if let Some(file_path) = self.file_path {
            let file_path_obj =
                FilePath::from_str(&file_path).map_err(|e| format!("Invalid file path: {}", e))?;

            let media = app_handle
                .fs()
                .read(file_path_obj.clone())
                .map_err(|e| format!("Failed to read file: {}", e))?;

            let media_name = file_path_obj
                .into_path()
                .unwrap()
                .file_name()
                .unwrap()
                .to_str()
                .unwrap()
                .to_string();

            (Some(media), Some(media_name))
        } else {
            (None, None)
        };

        Ok(GroupTextMessage {
            message_id: final_message_id,
            group_id: self.group_id,
            sender_id,
            date: timestamp as i64,
            text: self.text,
            media,
            media_name,
            reply_message_id: self
                .reply_to
                .map(|id| id.parse::<i64>())
                .transpose()
                .map_err(|e| format!("Invalid reply_message_id: {}", e))?,
            edit_date,
            expires: self.expires_at,
        })
    }
}
