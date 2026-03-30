use base64::{Engine, engine::general_purpose};
use tauri::{AppHandle, Emitter};

use crate::api::device::types::{
    errors::GroupError, extensions::group_config::group_config::GroupConfig, group::GroupId,
    message::UserGroupMessage,
};
use crate::api::status::{DisplayUserStatus, DisplayUserTypingStatus};

#[derive(serde::Serialize, Clone)]
#[serde(tag = "type", content = "data")]
pub enum SystemEvent<'a> {
    #[serde(rename = "join_group")]
    JoinGroup(JoinGroupData<'a>),
    #[serde(rename = "new_group_message")]
    NewGroupMessage(NewGroupMessageData<'a>),
    #[serde(rename = "message_delivery")]
    MessageDelivery(MessageDeliveryData),
    #[serde(rename = "welcome_message")]
    WelcomeMessage(WelcomeMessageData),
    #[serde(rename = "group_config_updated")]
    GroupConfigUpdated(GroupConfigUpdatedData<'a>),
    #[serde(rename = "user_status_changed")]
    UserStatusChanged(DisplayUserStatus),
    #[serde(rename = "user_typing_status_changed")]
    UserTypingStatusChanged(DisplayUserTypingStatus),
}

#[derive(serde::Serialize, Clone)]
pub struct JoinGroupData<'a> {
    pub group_id: String,
    pub group_config: &'a GroupConfig,
    pub avatar: &'a Option<String>,
}

#[derive(serde::Serialize, Clone)]
pub struct NewGroupMessageData<'a> {
    pub group_id: String,
    pub group_name: &'a str,
    pub sender_id: String,
    pub text: &'a str,
    pub timestamp: i64,
    pub media: &'a Option<String>,
    pub media_name: &'a Option<String>,
    pub message_id: String,
    pub reply_message_id: Option<String>,
    pub edit_date: Option<String>,
    pub is_edit: bool,
    pub expires: Option<String>,
}

#[derive(serde::Serialize, Clone)]
pub struct MessageDeliveryData {
    pub message_id: String,
    pub success: bool,
}

#[derive(serde::Serialize, Clone)]
pub struct WelcomeMessageData {
    pub message_id: String,
    pub success: bool,
}

#[derive(serde::Serialize, Clone)]
pub struct GroupConfigUpdatedData<'a> {
    pub group_id: String,
    pub group_config: &'a GroupConfig,
    pub avatar: &'a Option<String>,
}

pub async fn emit_text_message_event(
    app: &AppHandle,
    text_msg: &UserGroupMessage,
    group_id: &GroupId,
    group_config: &GroupConfig,
) -> Result<(), GroupError> {
    match text_msg {
        UserGroupMessage::TextMessage(text_msg) => {
            //if media is image or video encode it to base64
            let media = text_msg
                .media
                .as_ref()
                .map(|media| general_purpose::STANDARD.encode(media));

            let event_payload = SystemEvent::NewGroupMessage(NewGroupMessageData {
                group_id: group_id.to_string(),
                group_name: &group_config.name,
                sender_id: text_msg.sender_id.to_string(),
                text: &text_msg.text,
                timestamp: text_msg.date,
                media: &media,
                media_name: &text_msg.media_name,
                message_id: text_msg.message_id.to_string(),
                reply_message_id: text_msg.reply_message_id.map(|id| id.to_string()),
                edit_date: text_msg.edit_date.map(|date| date.to_string()),
                is_edit: text_msg.edit_date.is_some(),
                expires: text_msg.expires.map(|date| date.to_string()),
            });

            app.emit("server-event", event_payload)
                .map_err(|e| GroupError::EventError(e.to_string()))?;
        }
    }
    Ok(())
}

pub async fn emit_join_group_event(
    app: &AppHandle,
    group_config: &GroupConfig,
    group_id: &GroupId,
) -> Result<(), GroupError> {
    let avatar = group_config
        .avatar
        .clone()
        .map(|avatar| general_purpose::STANDARD.encode(avatar));
    let event_payload = SystemEvent::JoinGroup(JoinGroupData {
        group_id: group_id.to_string(),
        group_config,
        avatar: &avatar,
    });

    app.emit("server-event", event_payload)
        .map_err(|e| GroupError::EventError(e.to_string()))?;
    Ok(())
}

pub async fn emit_message_delivery_event(
    app: &AppHandle,
    message_id: u64,
    success: bool,
) -> Result<(), GroupError> {
    let event_payload = SystemEvent::MessageDelivery(MessageDeliveryData {
        message_id: (message_id as i64).to_string(),
        success,
    });

    app.emit("server-event", event_payload)
        .map_err(|e| GroupError::EventError(e.to_string()))?;
    Ok(())
}

pub async fn emit_welcome_message_event(
    app: &AppHandle,
    message_id: u64,
    success: bool,
) -> Result<(), GroupError> {
    let event_payload = SystemEvent::WelcomeMessage(WelcomeMessageData {
        message_id: message_id.to_string(),
        success,
    });

    app.emit("server-event", event_payload)
        .map_err(|e| GroupError::EventError(e.to_string()))?;
    Ok(())
}

pub async fn emit_new_group_config(
    app: &AppHandle,
    group_id: &GroupId,
    group_config: &GroupConfig,
) -> Result<(), GroupError> {
    let avatar = group_config
        .avatar
        .clone()
        .map(|avatar| general_purpose::STANDARD.encode(avatar));
    let event_payload = SystemEvent::GroupConfigUpdated(GroupConfigUpdatedData {
        group_id: group_id.to_string(),
        group_config,
        avatar: &avatar,
    });

    app.emit("server-event", event_payload)
        .map_err(|e| GroupError::EventError(e.to_string()))?;
    Ok(())
}

pub async fn emit_user_status_event(
    app: &AppHandle,
    data: DisplayUserStatus,
) -> Result<(), tauri::Error> {
    app.emit("server-event", SystemEvent::UserStatusChanged(data))
}

pub async fn emit_user_typing_status_event(
    app: &AppHandle,
    data: DisplayUserTypingStatus,
) -> Result<(), tauri::Error> {
    app.emit("server-event", SystemEvent::UserTypingStatusChanged(data))
}
