use base64::{Engine as _, engine::general_purpose};
use rand::RngExt;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::AppHandle;
use tauri::Emitter;
use tokio::sync::RwLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupActionResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupMessageResponse {
    pub id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chat_id: Option<String>,
    pub sender_id: i64,
    pub content: String,
    pub timestamp: i64,
    pub media: bool,
    pub media_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub media_data: Option<String>,
    pub reply_to: Option<String>,
    pub edit_date: Option<String>,
    pub is_edit: bool,
    pub expires: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateGroupResponse {
    pub group_id: String,
    pub group_config: GroupConfig,
    pub avatar: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupResponse {
    pub group_id: String,
    pub group_config: GroupConfig,
    pub avatar: Option<String>,
    pub last_message: Option<GroupMessageResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MessagesListResponse {
    pub messages: Vec<GroupMessageResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaResponse {
    pub media_id: String,
    pub filename: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaListResponse {
    pub media: Vec<MediaResponse>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheSizeResponse {
    pub size: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdatePermissions {
    pub manage_members: Option<bool>,
    pub send_messages: Option<bool>,
    pub delete_messages: Option<bool>,
    pub rename_group: Option<bool>,
    pub manage_permissions: Option<bool>,
    pub pin_messages: Option<bool>,
    pub manage_admins: Option<bool>,
}

use crate::api::device::Device;
use crate::api::device::types::extensions::group_config::group_config::GroupConfig;
use crate::api::device::types::{
    extensions::group_config::{group_config, group_config_builder},
    group::GroupId,
    message::UserGroupMessage,
    message_builder::MessageBuilder,
};

type SafeGroupUser = Arc<RwLock<Option<Device>>>;

pub fn format_group_config(
    group_config: &GroupConfig,
    group_id: GroupId,
    user_id: u64,
) -> serde_json::Value {
    let avatar = group_config
        .avatar
        .clone()
        .map(|avatar| general_purpose::STANDARD.encode(avatar));

    let users_permisions = &group_config.permissions;
    let default_permissions = &group_config.default_permissions;
    let user_permissions = users_permisions
        .get(&user_id)
        .unwrap_or(default_permissions);

    serde_json::json!({
        "type": "group_config_updated",
        "data": {
            "group_id": group_id.to_string(),
            "group_name": group_config.name,
            "description": group_config.description,
            "avatar": avatar,
            "owner_id": group_config.creator_id,
            "admins": group_config.admins,
            "members": group_config.members,
            "created_at": group_config.created_at.timestamp,
            "user_permissions": user_permissions,
            "users_permisions": users_permisions,
            "default_permissions": default_permissions,
        }
    })
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn create_group(
    _app_handle: AppHandle,
    group_name: String,
    group_user_state: tauri::State<'_, SafeGroupUser>,
    visibility: Option<String>,
    join_mode: Option<String>,
    description: Option<String>,
    max_members: Option<u32>,
    slow_mode_delay: Option<u32>,
    allow_stickers: Option<bool>,
    allow_gifs: Option<bool>,
    allow_voice_messages: Option<bool>,
    allow_video_messages: Option<bool>,
    allow_links: Option<bool>,
) -> Result<CreateGroupResponse, String> {
    let mut group_user = group_user_state.write().await;
    log::info!("Creating group: {}", group_name);
    if let Some(user) = group_user.as_mut() {
        let visibility_enum = match visibility.as_deref() {
            Some("public") => Some(group_config::Visibility::Public),
            Some("private") => Some(group_config::Visibility::Private),
            _ => None,
        };

        let join_mode_enum = match join_mode.as_deref() {
            Some("invite_only") => Some(group_config::JoinMode::InviteOnly),
            Some("request_to_join") => Some(group_config::JoinMode::RequestToJoin),
            Some("open") => Some(group_config::JoinMode::Open),
            _ => None,
        };

        let group_id = rand::rng().random_range(100_000_000_000_u64..1_000_000_000_000_u64);
        let user_id = user.user_id();
        let mut builder =
            group_config_builder::GroupConfigBuilder::new(group_id, group_name.clone(), user_id);

        if let Some(visibility) = visibility_enum {
            builder = builder.with_visibility(visibility);
        }

        if let Some(join_mode) = join_mode_enum {
            builder = builder.with_join_mode(join_mode);
        }

        if let Some(desc) = description {
            builder = builder.with_description(desc);
        }

        if let Some(max) = max_members {
            builder = builder.with_max_members(max);
        }

        if let Some(delay) = slow_mode_delay {
            builder = builder.with_slow_mode_delay(delay);
        }

        if let Some(allow) = allow_stickers {
            builder = builder.allow_stickers(allow);
        }

        if let Some(allow) = allow_gifs {
            builder = builder.allow_gifs(allow);
        }

        if let Some(allow) = allow_voice_messages {
            builder = builder.allow_voice_messages(allow);
        }

        if let Some(allow) = allow_video_messages {
            builder = builder.allow_video_messages(allow);
        }

        if let Some(allow) = allow_links {
            builder = builder.allow_links(allow);
        }

        let group_config = builder.build().map_err(|e| e.to_string())?;

        let group_id = user
            .create_group(group_config.clone())
            .await
            .map_err(|e| e.to_string())?;

        let avatar = group_config
            .avatar
            .clone()
            .map(|avatar| general_purpose::STANDARD.encode(avatar));

        Ok(CreateGroupResponse {
            group_id: group_id.to_string(),
            group_config,
            avatar,
        })
    } else {
        Err("Group user not initialized. Call init_group_user first.".to_string())
    }
}

#[tauri::command]
pub async fn leave_group(
    app_handle: AppHandle,
    group_name: String,
    group_user_state: tauri::State<'_, SafeGroupUser>,
) -> Result<GroupActionResponse, String> {
    let mut group_user = group_user_state.write().await;
    let group_id = GroupId::from_string(&group_name).map_err(|e| e.to_string())?;
    if let Some(user) = group_user.as_mut() {
        user.leave_group(&group_id)
            .await
            .map_err(|e| e.to_string())?;

        let event_payload = serde_json::json!({
            "type": "leave_group",
            "data": {
                "group_id": group_id.to_string()
            }
        });
        app_handle.emit("server-event", event_payload).unwrap();
    }
    Ok(GroupActionResponse {
        success: true,
        message: "Group left successfully".to_string(),
    })
}

#[tauri::command]
pub async fn get_groups(
    group_user_state: tauri::State<'_, SafeGroupUser>,
) -> Result<Vec<GroupResponse>, String> {
    let group_user = group_user_state.read().await;
    if let Some(user) = group_user.as_ref() {
        let groups = user.groups.list_groups().await;
        let mut groups_list = Vec::new();

        for group_id in groups.iter() {
            let group_config = user
                .get_group_config(group_id)
                .await
                .map_err(|e| e.to_string())?;
            let last_message = user
                .groups
                .messages
                .get_last_message(group_id)
                .await
                .map_err(|e| e.to_string())?;

            let last_message: Option<GroupMessageResponse> = if let Some(message) = last_message {
                let media_data = message
                    .media
                    .as_ref()
                    .map(|data| general_purpose::STANDARD.encode(data));
                Some(GroupMessageResponse {
                    id: message.message_id.to_string(),
                    chat_id: None,
                    content: message.text,
                    timestamp: message.date,
                    sender_id: message.sender_id,
                    media: message.media.is_some(),
                    media_name: message.media_name,
                    media_data,
                    reply_to: message.reply_message_id.map(|id| id.to_string()),
                    edit_date: message.edit_date.map(|date| date.to_string()),
                    is_edit: message.edit_date.is_some(),
                    expires: message.expires.map(|date| date.to_string()),
                })
            } else {
                None
            };

            let avatar = group_config
                .avatar
                .clone()
                .map(|avatar| general_purpose::STANDARD.encode(avatar));

            groups_list.push(GroupResponse {
                group_id: group_id.to_string(),
                group_config,
                avatar,
                last_message,
            });
        }

        Ok(groups_list)
    } else {
        Err("Group user not initialized. Call init_group_user first.".to_string())
    }
}

#[tauri::command]
pub async fn invite_to_group(
    app_handle: AppHandle,
    user_id: u64,
    group_id: String,
    group_user_state: tauri::State<'_, SafeGroupUser>,
) -> Result<GroupActionResponse, String> {
    let mut group_user = group_user_state.write().await;
    let group_id = GroupId::from_string(&group_id).map_err(|e| e.to_string())?;
    if let Some(user) = group_user.as_mut() {
        match user.invite(&group_id, user_id).await {
            Ok(_) => {
                // Emit updated config
                if let Ok(group_config) = user.get_group_config(&group_id).await {
                    app_handle
                        .emit(
                            "server-event",
                            format_group_config(&group_config, group_id, user.user_id()),
                        )
                        .unwrap();
                }

                Ok(GroupActionResponse {
                    success: true,
                    message: format!("User {} invited to group", user_id),
                })
            }
            Err(e) => Ok(GroupActionResponse {
                success: false,
                message: format!("Failed to invite user: {}", e),
            }),
        }
    } else {
        Err("Group user not initialized. Call init_group_user first.".to_string())
    }
}

#[tauri::command]
pub async fn remove_from_group(
    app_handle: AppHandle,
    user_id: u64,
    group_id: String,
    group_user_state: tauri::State<'_, SafeGroupUser>,
) -> Result<GroupActionResponse, String> {
    log::info!("Removing user from group: {}", user_id);
    let mut group_user = group_user_state.write().await;
    let group_id_str = group_id.clone();
    let group_id = GroupId::from_string(&group_id).map_err(|e| e.to_string())?;

    if let Some(user) = group_user.as_mut() {
        if user.user_id() == user_id {
            user.leave_group(&group_id)
                .await
                .map_err(|e| e.to_string())?;

            let event_payload = serde_json::json!({
                "type": "leave_group",
                "data": {
                    "group_id": group_id_str.clone()
                }
            });
            app_handle.emit("server-event", event_payload).unwrap();

            Ok(GroupActionResponse {
                success: true,
                message: format!("User {} left group {}", user_id, group_id_str),
            })
        } else {
            match user.remove_user(&group_id, user_id).await {
                Ok(_) => {
                    // Emit updated config
                    if let Ok(group_config) = user.get_group_config(&group_id).await {
                        app_handle
                            .emit(
                                "server-event",
                                format_group_config(&group_config, group_id, user_id),
                            )
                            .unwrap();
                    }

                    Ok(GroupActionResponse {
                        success: true,
                        message: format!("User {} removed from group {}", user_id, group_id_str),
                    })
                }
                Err(e) => {
                    log::error!("Failed to remove user: {}", e);
                    Ok(GroupActionResponse {
                        success: false,
                        message: format!("Failed to remove user: {}", e),
                    })
                }
            }
        }
    } else {
        Err("Group user not initialized. Call init_group_user first.".to_string())
    }
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn send_group_message(
    app_handle: AppHandle,
    group_id: String,
    message_id: u64,
    text: String,
    file: Option<String>,
    reply_message_id: Option<String>,
    edit_message_id: Option<String>,
    expires: Option<i64>,
    group_user_state: tauri::State<'_, SafeGroupUser>,
) -> Result<String, String> {
    let group_user = group_user_state.inner().clone();
    tauri::async_runtime::spawn(async move {
        if let Some(user) = group_user.read().await.as_ref() {
            let mut builder = MessageBuilder::new(group_id.clone(), text);

            if let Some(file) = file {
                builder = builder.with_file(file);
            }

            if let Some(reply) = reply_message_id.clone() {
                builder = builder.reply_to(reply);
            }

            if let Some(edit_id) = edit_message_id {
                builder = builder.edit_message(edit_id);
            }

            if let Some(expires) = expires {
                builder = builder.expires_at(expires);
            }
            let group_id = match GroupId::from_string(&group_id) {
                Ok(id) => id,
                Err(e) => {
                    log::error!("Failed to parse group ID: {}", e);
                    return;
                }
            };
            let message = match builder.build(message_id as i64, &app_handle, user.user_id() as i64) {
                Ok(msg) => msg,
                Err(e) => {
                    log::error!("Failed to build message: {}", e);
                    return;
                }
            };

            user.send_message(
                &group_id,
                message_id,
                UserGroupMessage::TextMessage(message.clone()),
            )
            .await
            .map_err(|e| {
                log::error!("Failed to send message: {}", e);
                e.to_string()
            })
            .ok();

            let success_payload = {
                serde_json::json!({
                "type": "group_message_sent",
                "data": {
                    "message_id": message.message_id.to_string(),
                    "text": message.text,
                    "group_name": group_id.to_string(),
                    "media_data": message.media.clone(),
                    "media_name": message.media_name,
                    "reply_message_id": reply_message_id.clone().map(|id| id.to_string()),
                    "edit_date": message.edit_date.map(|date| date.to_string()),
                    "expires": expires.map(|date| date.to_string()),
                }
                })
            };

            if let Err(e) = app_handle.emit("server-event", success_payload) {
                log::error!("Failed to emit group message success event: {}", e);
            }
        }
    });

    Ok((message_id as i64).to_string())
}

#[tauri::command]
pub async fn get_group_messages(
    group_id: String,
    group_user_state: tauri::State<'_, SafeGroupUser>,
) -> Result<MessagesListResponse, String> {
    let group_user = group_user_state.read().await;
    let group_id = GroupId::from_string(&group_id).map_err(|e| e.to_string())?;
    if let Some(user) = group_user.as_ref() {
        match user
            .groups
            .messages
            .get_group_messages(group_id.as_bytes())
            .await
        {
            Ok(messages) => {
                let msg_json: Vec<GroupMessageResponse> = messages
                    .into_iter()
                    .map(|message| match message {
                        UserGroupMessage::TextMessage(text_message) => {
                            let media_data = text_message
                                .media
                                .as_ref()
                                .map(|data| general_purpose::STANDARD.encode(data));
                            GroupMessageResponse {
                                id: text_message.message_id.to_string(),
                                chat_id: Some(group_id.to_string()),
                                sender_id: text_message.sender_id,
                                content: text_message.text,
                                timestamp: text_message.date,
                                media: text_message.media.is_some(),
                                media_name: text_message.media_name,
                                media_data,
                                reply_to: text_message.reply_message_id.map(|id| id.to_string()),
                                edit_date: text_message.edit_date.map(|date| date.to_string()),
                                is_edit: text_message.edit_date.is_some(),
                                expires: text_message.expires.map(|date| date.to_string()),
                            }
                        }
                    })
                    .collect();

                Ok(MessagesListResponse { messages: msg_json })
            }
            Err(e) => Err(format!("Failed to read messages from database: {}", e)),
        }
    } else {
        Err("Group user not initialized. Call init_group_user first.".to_string())
    }
}

#[tauri::command]
pub async fn delete_group_message(
    group_name: String,
    message_id: i64,
    group_user_state: tauri::State<'_, SafeGroupUser>,
) -> Result<GroupActionResponse, String> {
    let group_user = group_user_state.read().await;

    if let Some(user) = group_user.as_ref() {
        match user
            .groups
            .messages
            .delete_message(message_id, group_name.as_bytes())
            .await
        {
            Ok(_) => Ok(GroupActionResponse {
                success: true,
                message: "Message deleted successfully".to_string(),
            }),
            Err(e) => Ok(GroupActionResponse {
                success: false,
                message: format!("Failed to delete message: {}", e),
            }),
        }
    } else {
        Err("Group user not initialized. Call init_group_user first.".to_string())
    }
}

#[tauri::command]
pub async fn get_group_media(
    media_id: String,
    group_user_state: tauri::State<'_, SafeGroupUser>,
) -> Result<Vec<u8>, String> {
    let group_user = group_user_state.read().await;
    log::info!("Getting media with ID: {}", media_id);
    if let Some(user) = group_user.as_ref() {
        match user.groups.messages.get_media_data(&media_id).await {
            Ok(Some((media_data, _, _))) => {
                log::info!("Found media in cache, size: {}", media_data.len());
                Ok(media_data)
            }
            Ok(None) => match user.groups.messages.get_media_data(&media_id).await {
                Ok(Some((data, name, size))) => {
                    log::info!("Found media in DB: {} ({}), size: {}", media_id, name, size);
                    Ok(data)
                }
                Ok(None) => {
                    log::error!("Media not found in database: {}", media_id);
                    Err("Media not found".to_string())
                }
                Err(e) => {
                    log::error!("Failed to get media from database: {}", e);
                    Err(format!("Failed to get media from database: {}", e))
                }
            },
            Err(e) => {
                log::error!("Failed to get media: {}", e);
                Err(format!("Failed to get media: {}", e))
            }
        }
    } else {
        Err("Group user not initialized. Call init_group_user first.".to_string())
    }
}

#[tauri::command]
pub async fn get_all_group_media(
    group_name: String,
    group_user_state: tauri::State<'_, SafeGroupUser>,
) -> Result<MediaListResponse, String> {
    let group_user = group_user_state.read().await;

    if let Some(user) = group_user.as_ref() {
        match user
            .groups
            .messages
            .get_group_media(group_name.as_bytes())
            .await
        {
            Ok(media_list) => {
                let media_json: Vec<MediaResponse> = media_list
                    .into_iter()
                    .map(|(media_id, filename, timestamp)| MediaResponse {
                        media_id,
                        filename,
                        timestamp,
                    })
                    .collect();

                Ok(MediaListResponse { media: media_json })
            }
            Err(e) => Err(format!("Failed to get group media: {}", e)),
        }
    } else {
        Err("Group user not initialized. Call init_group_user first.".to_string())
    }
}

#[tauri::command]
pub async fn clear_group_media_cache(
    group_user_state: tauri::State<'_, SafeGroupUser>,
) -> Result<GroupActionResponse, String> {
    let group_user = group_user_state.read().await;

    if let Some(user) = group_user.as_ref() {
        match user.groups.messages.clear_media_cache().await {
            Ok(_) => Ok(GroupActionResponse {
                success: true,
                message: "Media cache cleared successfully".to_string(),
            }),
            Err(e) => Ok(GroupActionResponse {
                success: false,
                message: format!("Failed to clear media cache: {}", e),
            }),
        }
    } else {
        Err("Group user not initialized. Call init_group_user first.".to_string())
    }
}

#[tauri::command]
pub async fn get_group_media_cache_size(
    group_user_state: tauri::State<'_, SafeGroupUser>,
) -> Result<CacheSizeResponse, String> {
    let group_user = group_user_state.read().await;

    if let Some(user) = group_user.as_ref() {
        match user.groups.messages.get_media_cache_size().await {
            Ok(size) => Ok(CacheSizeResponse { size }),
            Err(e) => Err(format!("Failed to get media cache size: {}", e)),
        }
    } else {
        Err("Group user not initialized. Call init_group_user first.".to_string())
    }
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn update_member_permissions(
    app_handle: AppHandle,
    group_id: String,
    member_id: u64,
    permissions: UpdatePermissions,
    role: Option<String>,
    group_user_state: tauri::State<'_, SafeGroupUser>,
) -> Result<GroupActionResponse, String> {
    let group_user = group_user_state.read().await;
    let group_id = GroupId::from_string(&group_id).map_err(|e| e.to_string())?;
    if let Some(user) = group_user.as_ref() {
        let group_config = user.get_group_config(&group_id).await.map_err(|e| e.to_string())?;
        // Проверка прав текущего пользователя на изменение прав
        let user_id = user.user_id();
        let can_edit = group_config.has_permission(user_id, "manage_permissions");

        if !can_edit {
            return Err("You don't have permission to edit user permissions".to_string());
        }

        // Проверяем, что член группы существует и создаем новую конфигурацию
        let mut new_config = group_config.clone();
        if !new_config.is_member(member_id) {
            return Err(format!(
                "User with ID {} is not a member of the group",
                member_id
            ));
        }

        // Если указана роль, устанавливаем соответствующие права
        if let Some(role_name) = role {
            new_config.set_member_role(member_id, &role_name);
        } else {
            // Иначе устанавливаем индивидуальные права
            let mut member_permissions = new_config
                .get_member_permissions(member_id)
                .cloned()
                .unwrap_or_else(group_config::Permissions::default);

            // Обновляем каждое право, если оно указано в переданном JSON
            if let Some(val) = permissions.manage_members {
                member_permissions = member_permissions.with_manage_members(val);
            }

            if let Some(val) = permissions.send_messages {
                member_permissions = member_permissions.with_send_messages(val);
            }

            if let Some(val) = permissions.delete_messages {
                member_permissions = member_permissions.with_delete_messages(val);
            }

            if let Some(val) = permissions.rename_group {
                member_permissions = member_permissions.with_rename_group(val);
            }

            if let Some(val) = permissions.manage_permissions {
                member_permissions = member_permissions.with_manage_permissions(val);
            }

            if let Some(val) = permissions.pin_messages {
                member_permissions = member_permissions.with_pin_messages(val);
            }

            if let Some(val) = permissions.manage_admins {
                member_permissions = member_permissions.with_manage_admins(val);
            }

            // Устанавливаем обновленные права используя метод GroupConfig
            new_config.update_permissions(member_id, |p| {
                *p = member_permissions;
            });
        }

        user.update_group_config(&group_id, &new_config)
            .await
            .map_err(|e| e.to_string())?;

        let event_payload = format_group_config(&group_config, group_id, user_id);
        app_handle.emit("server-event", event_payload).unwrap();

        Ok(GroupActionResponse {
            success: true,
            message: "User permissions updated successfully".to_string(),
        })
    } else {
        Err("Group has no configuration".to_string())
    }
}

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn update_group_config(
    group_id: String,
    app_handle: AppHandle,
    group_user_state: tauri::State<'_, SafeGroupUser>,
    group_name: Option<String>,
    visibility: Option<String>,
    join_mode: Option<String>,
    description: Option<String>,
    avatar: Option<Vec<u8>>,
    max_members: Option<u32>,
    slow_mode_delay: Option<u32>,
    allow_stickers: Option<bool>,
    allow_gifs: Option<bool>,
    allow_voice_messages: Option<bool>,
    allow_video_messages: Option<bool>,
    allow_links: Option<bool>,
    allow_messages: Option<bool>,
) -> Result<GroupActionResponse, String> {
    let group_user = group_user_state.read().await;
    let group_id = GroupId::from_string(&group_id).map_err(|e| e.to_string())?;
    if let Some(user) = group_user.as_ref() {
        let group_config = user.get_group_config(&group_id).await.map_err(|e| e.to_string())?;

        // Проверка прав пользователя на редактирование группы
        let user_id = user.user_id();
        let can_edit = group_config.has_permission(user_id, "rename_group")
            || group_config.has_permission(user_id, "manage_permissions");

        if !can_edit {
            return Err("You don't have permission to edit group configuration".to_string());
        }

        // Получаем текущую конфигурацию и модифицируем её
        let mut new_config = group_config.clone();
        // Обновляем поля конфигурации используя методы GroupConfig
        if let Some(vis) = visibility {
            match vis.as_str() {
                "public" => new_config.set_visibility(group_config::Visibility::Public),
                "private" => new_config.set_visibility(group_config::Visibility::Private),
                _ => {}
            }
        }

        if let Some(mode) = join_mode {
            match mode.as_str() {
                "invite_only" => new_config.set_join_mode(group_config::JoinMode::InviteOnly),
                "request_to_join" => {
                    new_config.set_join_mode(group_config::JoinMode::RequestToJoin)
                }
                "open" => new_config.set_join_mode(group_config::JoinMode::Open),
                _ => {}
            }
        }

        if let Some(name) = group_name {
            new_config.set_name(name);
        }

        if let Some(desc) = description {
            new_config.set_description(desc);
        }

        if let Some(max) = max_members {
            new_config.set_max_members(Some(max));
        }

        if let Some(delay) = slow_mode_delay {
            new_config.set_slow_mode_delay(delay);
        }

        if let Some(stickers) = allow_stickers {
            new_config.set_allow_stickers(stickers);
        }

        if let Some(gifs) = allow_gifs {
            new_config.set_allow_gifs(gifs);
        }

        if let Some(voice) = allow_voice_messages {
            new_config.set_allow_voice_messages(voice);
        }

        if let Some(video) = allow_video_messages {
            new_config.set_allow_video_messages(video);
        }

        if let Some(links) = allow_links {
            new_config.set_allow_links(links);
        }

        if let Some(allow_messages) = allow_messages {
            new_config.set_allow_messages(allow_messages);
        }
        log::info!("Allow messages: {:?}", allow_messages);
        if let Some(avatar_data) = avatar {
            if avatar_data.len() > 5 * 1024 * 1024 {
                return Err("Avatar size must be less than 5MB".to_string());
            }

            new_config.set_avatar(avatar_data);
        }

        // Валидация изменений используя встроенный метод
        let old_config = user.get_group_config(&group_id).await.map_err(|e| e.to_string())?;
        let validation_result = old_config.validate_changes(&new_config, user_id);
        if !validation_result.valid {
            return Err(format!(
                "Error validating group configuration: {}",
                validation_result
                    .changes
                    .iter()
                    .map(|c| c.field.clone())
                    .collect::<Vec<String>>()
                    .join(", ")
            ));
        }

        // Используем существующий метод update_group_config
        user.update_group_config(&group_id, &new_config)
            .await
            .map_err(|e| e.to_string())?;

        let avatar = new_config
            .avatar
            .clone()
            .map(|avatar| general_purpose::STANDARD.encode(avatar));

        let users_permisions = &new_config.permissions;
        let default_permissions = &new_config.default_permissions;
        let user_permissions = users_permisions
            .get(&user_id)
            .unwrap_or(default_permissions);
        let event_payload = serde_json::json!({
            "type": "group_config_updated",
            "data": {
                "group_id": group_id.to_string(),
                "group_name": new_config.name,
                "description": new_config.description,
                "avatar": avatar,
                "owner_id": new_config.creator_id,
                "admins": new_config.admins,
                "members": new_config.members,
                "created_at": new_config.created_at.timestamp,
                "user_permissions": user_permissions,
                "users_permisions": users_permisions,
                "default_permissions": default_permissions,
            }
        });
        app_handle.emit("server-event", event_payload).unwrap();

        Ok(GroupActionResponse {
            success: true,
            message: "Group configuration updated successfully".to_string(),
        })
    } else {
        Err("Group user not initialized. Call init_group_user first.".to_string())
    }
}

#[tauri::command]
pub async fn get_group_display_key(
    group_id: String,
    group_user_state: tauri::State<'_, SafeGroupUser>,
) -> Result<Vec<u8>, String> {
    let group_user = group_user_state.read().await;
    if let Some(user) = group_user.as_ref() {
        let group_id = GroupId::from_string(&group_id).map_err(|e| e.to_string())?;
        let display_key = user
            .get_group_display_key(&group_id)
            .await
            .map_err(|e| e.to_string())?;
        Ok(display_key)
    } else {
        Err("Group user not initialized. Call init_group_user first.".to_string())
    }
}
