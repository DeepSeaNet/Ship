use base64::{Engine as _, engine::general_purpose};
use rand::Rng;
use std::str::FromStr;
use std::sync::Arc;
use tauri::AppHandle;
use tauri::Emitter;
use tauri_plugin_fs::FilePath;
use tauri_plugin_fs::FsExt;
use tokio::sync::RwLock;

use crate::api::device::Device;
use crate::api::device::types::{
    extensions::group_config::{group_config, group_config_builder},
    group::GroupId,
    message::UserGroupMessage,
    message_builder::MessageBuilder,
};

type SafeGroupUser = Arc<RwLock<Option<Device>>>;

#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub async fn create_group(
    app_handle: AppHandle,
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
) -> Result<serde_json::Value, String> {
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

        let event_payload = serde_json::json!(
            {
                "type": "create_group",
                "data": {
                    "group_name": group_config.name,
                    "group_id": group_id.to_string(),
                    "group_config": group_config,
                    "members_count": group_config.members.len(),
                    "members": group_config.members,
                    "user_permission": group_config.permissions.get(&user.user_id()).unwrap(),
                    "users_permisions": group_config.permissions,
                    "description": group_config.description,
                    "owner_id": group_config.creator_id,
                    "admins": group_config.admins,
                    "date": std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs() as i64
                }
            }
        );
        app_handle.emit("server-event", event_payload).unwrap();
        Ok(serde_json::json!({
            "success": true,
            "message": "Group created successfully"
        }))
    } else {
        Err("Group user not initialized. Call init_group_user first.".to_string())
    }
}

#[tauri::command]
pub async fn leave_group(
    group_name: String,
    group_user_state: tauri::State<'_, SafeGroupUser>,
) -> Result<serde_json::Value, String> {
    let mut group_user = group_user_state.write().await;
    let group_id = GroupId::from_string(&group_name).map_err(|e| e.to_string())?;
    if let Some(user) = group_user.as_mut() {
        user.leave_group(&group_id)
            .await
            .map_err(|e| e.to_string())?;
    }
    Ok(serde_json::json!({
        "success": true,
        "message": "Group left successfully"
    }))
}

#[tauri::command]
pub async fn get_groups(
    group_user_state: tauri::State<'_, SafeGroupUser>,
) -> Result<Vec<serde_json::Value>, String> {
    let group_user = group_user_state.read().await;
    if let Some(user) = group_user.as_ref() {
        let groups = user.groups.list_groups().await;
        let mut groups_list = Vec::new();

        for group_id in groups.iter() {
            let members = user
                .get_group_members(group_id)
                .await
                .map_err(|e| e.to_string())?;

            let group_config = user
                .get_group_config(group_id)
                .await
                .map_err(|e| e.to_string())?;
            let users_permisions = group_config.permissions;
            let default_permissions = group_config.default_permissions;
            let user_permissions = users_permisions
                .get(&user.user_id())
                .unwrap_or(&default_permissions);
            let avatar = group_config
                .avatar
                .map(|avatar| general_purpose::STANDARD.encode(avatar));
            let last_message = user
                .groups
                .messages
                .get_last_message(group_id)
                .await
                .map_err(|e| e.to_string())?;

            let last_message: Option<serde_json::Value> = if let Some(message) = last_message {
                Some(serde_json::json!({
                    "message_id": message.message_id,
                    "text": message.text,
                    "timestamp": message.date,
                    "sender_id": message.sender_id,
                    "media_name": message.media_name,
                    "media": message.media,
                    "reply_to": message.reply_message_id,
                    "edited": message.edit_date,
                    "expires": message.expires,
                }))
            } else {
                None
            };

            groups_list.push(serde_json::json!({
                "group_name": group_config.name,
                "group_id": group_id.to_string(),
                "description": group_config.description,
                "avatar": avatar,
                "member_count": members.len(),
                "members": members,
                "user_permissions": user_permissions,
                "users_permisions": users_permisions,
                "owner_id": group_config.creator_id,
                "admins": group_config.admins,
                "date": group_config.created_at.timestamp,
                "default_permissions": default_permissions,
                "last_message": last_message
            }));
        }

        Ok(groups_list)
    } else {
        Err("Group user not initialized. Call init_group_user first.".to_string())
    }
}

#[tauri::command]
pub async fn invite_to_group(
    client_id: u64,
    group_name: String,
    group_user_state: tauri::State<'_, SafeGroupUser>,
) -> Result<serde_json::Value, String> {
    let mut group_user = group_user_state.write().await;
    let group_id = GroupId::from_string(&group_name).map_err(|e| e.to_string())?;
    if let Some(user) = group_user.as_mut() {
        match user.invite(&group_id, client_id).await {
            Ok(_) => Ok(serde_json::json!({
                "success": true,
                "message": format!("User {} invited to group {}", client_id, group_name)
            })),
            Err(e) => Ok(serde_json::json!({
                "success": false,
                "message": format!("Failed to invite user: {}", e)
            })),
        }
    } else {
        Err("Group user not initialized. Call init_group_user first.".to_string())
    }
}

#[tauri::command]
pub async fn remove_from_group(
    user_id: u64,
    group_id: String,
    group_user_state: tauri::State<'_, SafeGroupUser>,
) -> Result<serde_json::Value, String> {
    log::info!("Removing user from group: {}", user_id);
    let mut group_user = group_user_state.write().await;
    let group_id = GroupId::from_string(&group_id).map_err(|e| e.to_string())?;
    if let Some(user) = group_user.as_mut() {
        if user.user_id() == user_id {
            user.leave_group(&group_id)
                .await
                .map_err(|e| e.to_string())?;
            // TODO: add emit updating group config

            Ok(serde_json::json!({
                "success": true,
                "message": format!("User {} left group {}", user_id, group_id)
            }))
        } else {
            match user.remove_user(&group_id, user_id).await {
                Ok(_) => Ok(serde_json::json!({
                    "success": true,
                    "message": format!("User {} removed from group {}", user_id, group_id)
                })),
                Err(e) => {
                    log::error!("Failed to remove user: {}", e);
                    Ok(serde_json::json!({
                        "success": false,
                        "message": format!("Failed to remove user: {}", e)
                    }))
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
    text: String,
    file: Option<String>,
    reply_message_id: Option<String>,
    edit_message_id: Option<String>,
    expires: Option<i64>,
    group_user_state: tauri::State<'_, SafeGroupUser>,
) -> Result<String, String> {
    let group_user = group_user_state.inner().clone();
    let message_id = Device::generate_message_id(); // replace with actual generation of message_Id
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
            let group_id = GroupId::from_string(&group_id)
                .map_err(|e| e.to_string())
                .unwrap();
            let message = builder
                .build(message_id as i64, &app_handle, user.user_id() as i64)
                .unwrap();

            user.send_message(&group_id, UserGroupMessage::TextMessage(message.clone()))
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

    Ok(message_id.to_string())
}

#[tauri::command]
pub async fn get_group_messages(
    group_id: String,
    group_user_state: tauri::State<'_, SafeGroupUser>,
) -> Result<serde_json::Value, String> {
    log::debug!("Get group messages called");
    let group_user = group_user_state.read().await;
    let group_id = GroupId::from_string(&group_id).map_err(|e| e.to_string())?;
    log::info!("Getting group messages for: {:?}", group_id);
    if let Some(user) = group_user.as_ref() {
        match user
            .groups
            .messages
            .get_group_messages(group_id.as_bytes())
            .await
        {
            Ok(messages) => {
                let msg_json: Vec<serde_json::Value> = messages
                    .into_iter()
                    .map(|message| {
                        match message {
                            UserGroupMessage::TextMessage(text_message) => {
                                // Determine if this is a displayable media type or a file
                                let is_displayable_media = if let Some(name) = &text_message.media_name {
                                    let lower_name = name.to_lowercase();
                                    lower_name.ends_with(".jpg") || 
                                    lower_name.ends_with(".jpeg") || 
                                    lower_name.ends_with(".png") || 
                                    lower_name.ends_with(".gif") || 
                                    lower_name.ends_with(".webp") || 
                                    lower_name.ends_with(".svg")
                                } else {
                                    false
                                };

                                let mut json = serde_json::json!({
                                    "sender_id": text_message.sender_id,
                                    "text": text_message.text,
                                    "timestamp": text_message.date,
                                    "media": text_message.media.is_some(),
                                    "media_name": text_message.media_name,
                                    "message_id": text_message.message_id.to_string(),
                                    "reply_message_id": text_message.reply_message_id.map(|id| id.to_string()),
                                    "edit_date": text_message.edit_date.map(|date| date.to_string()),
                                    "is_edit": text_message.edit_date.is_some(),
                                    "expires": text_message.expires.map(|date| date.to_string()),
                                    "chat_id": group_id.to_string(),
                                    "is_file": !is_displayable_media,
                                });

                                if let Some(data) = text_message.media {
                                    let base64_data = general_purpose::STANDARD.encode(&data);
                                    json.as_object_mut().unwrap().insert(
                                        "media_data".to_string(),
                                        serde_json::Value::String(base64_data),
                                    );
                                }

                                json
                            }
                        }
                    })
                    .collect();

                Ok(serde_json::json!({
                    "messages": msg_json
                }))
            }
            Err(e) => Ok(serde_json::json!({
                "success": false,
                "message": format!("Failed to read messages from database: {}", e)
            })),
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
) -> Result<serde_json::Value, String> {
    let group_user = group_user_state.read().await;

    if let Some(user) = group_user.as_ref() {
        match user
            .groups
            .messages
            .delete_message(message_id, group_name.as_bytes())
            .await
        {
            Ok(_) => Ok(serde_json::json!({
                "success": true,
                "message": "Message deleted successfully"
            })),
            Err(e) => Ok(serde_json::json!({
                "success": false,
                "message": format!("Failed to delete message: {}", e)
            })),
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
) -> Result<serde_json::Value, String> {
    let group_user = group_user_state.read().await;

    if let Some(user) = group_user.as_ref() {
        match user
            .groups
            .messages
            .get_group_media(group_name.as_bytes())
            .await
        {
            Ok(media_list) => {
                let media_json: Vec<serde_json::Value> = media_list
                    .into_iter()
                    .map(|(media_id, filename, timestamp)| {
                        serde_json::json!({
                            "media_id": media_id,
                            "filename": filename,
                            "timestamp": timestamp,
                        })
                    })
                    .collect();

                Ok(serde_json::json!({
                    "media": media_json
                }))
            }
            Err(e) => Ok(serde_json::json!({
                "success": false,
                "message": format!("Failed to get group media: {}", e)
            })),
        }
    } else {
        Err("Group user not initialized. Call init_group_user first.".to_string())
    }
}

#[tauri::command]
pub async fn clear_group_media_cache(
    group_user_state: tauri::State<'_, SafeGroupUser>,
) -> Result<serde_json::Value, String> {
    let group_user = group_user_state.read().await;

    if let Some(user) = group_user.as_ref() {
        match user.groups.messages.clear_media_cache().await {
            Ok(_) => Ok(serde_json::json!({
                "success": true,
                "message": "Media cache cleared successfully"
            })),
            Err(e) => Ok(serde_json::json!({
                "success": false,
                "message": format!("Failed to clear media cache: {}", e)
            })),
        }
    } else {
        Err("Group user not initialized. Call init_group_user first.".to_string())
    }
}

#[tauri::command]
pub async fn get_group_media_cache_size(
    group_user_state: tauri::State<'_, SafeGroupUser>,
) -> Result<serde_json::Value, String> {
    let group_user = group_user_state.read().await;

    if let Some(user) = group_user.as_ref() {
        match user.groups.messages.get_media_cache_size().await {
            Ok(size) => Ok(serde_json::json!({
                "size": size
            })),
            Err(e) => Ok(serde_json::json!({
                "success": false,
                "message": format!("Failed to get media cache size: {}", e)
            })),
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
    permissions: serde_json::Value,
    role: Option<String>,
    group_user_state: tauri::State<'_, SafeGroupUser>,
) -> Result<serde_json::Value, String> {
    let group_user = group_user_state.read().await;
    let group_id = GroupId::from_string(&group_id).map_err(|e| e.to_string())?;
    if let Some(user) = group_user.as_ref() {
        let group_config = user.get_group_config(&group_id).await.unwrap();
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
            if let Some(value) = permissions.get("manage_members")
                && let Some(val) = value.as_bool()
            {
                member_permissions = member_permissions.with_manage_members(val);
            }

            if let Some(value) = permissions.get("send_messages")
                && let Some(val) = value.as_bool()
            {
                member_permissions = member_permissions.with_send_messages(val);
            }

            if let Some(value) = permissions.get("delete_messages")
                && let Some(val) = value.as_bool()
            {
                member_permissions = member_permissions.with_delete_messages(val);
            }

            if let Some(value) = permissions.get("rename_group")
                && let Some(val) = value.as_bool()
            {
                member_permissions = member_permissions.with_rename_group(val);
            }

            if let Some(value) = permissions.get("manage_permissions")
                && let Some(val) = value.as_bool()
            {
                member_permissions = member_permissions.with_manage_permissions(val);
            }

            if let Some(value) = permissions.get("pin_messages")
                && let Some(val) = value.as_bool()
            {
                member_permissions = member_permissions.with_pin_messages(val);
            }

            if let Some(value) = permissions.get("manage_admins")
                && let Some(val) = value.as_bool()
            {
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

        let users_permisions = &group_config.permissions;
        let default_permissions = &group_config.default_permissions;
        let user_permissions = users_permisions
            .get(&user_id)
            .unwrap_or(default_permissions);

        let event_payload = serde_json::json!({
            "type": "group_config_updated",
            "data": {
                "group_id": group_id.to_string(),
                "group_name": group_config.name,
                "description": group_config.description,
                "avatar": group_config.avatar,
                "owner_id": group_config.creator_id,
                "admins": group_config.admins,
                "members": group_config.members,
                "created_at": group_config.created_at.timestamp,
                "user_permissions": user_permissions,
                "users_permisions": users_permisions,
                "default_permissions": default_permissions,
            }
        });
        app_handle.emit("server-event", event_payload).unwrap();

        Ok(serde_json::json!({
            "success": true,
            "message": format!("User permissions updated successfully")
        }))
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
    avatar: Option<String>,
    max_members: Option<u32>,
    slow_mode_delay: Option<u32>,
    allow_stickers: Option<bool>,
    allow_gifs: Option<bool>,
    allow_voice_messages: Option<bool>,
    allow_video_messages: Option<bool>,
    allow_links: Option<bool>,
    allow_messages: Option<bool>,
) -> Result<serde_json::Value, String> {
    let group_user = group_user_state.read().await;
    let group_id = GroupId::from_string(&group_id).map_err(|e| e.to_string())?;
    if let Some(user) = group_user.as_ref() {
        let group_config = user.get_group_config(&group_id).await.unwrap();

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

        if let Some(avatar_path) = avatar {
            let avatar_data = {
                let file_path = FilePath::from_str(&avatar_path).unwrap();
                let media = app_handle.fs().read(file_path).unwrap();
                log::info!("Media size: {}", media.len());
                media
            };

            if avatar_data.len() > 5 * 1024 * 1024 {
                return Err("Avatar size must be less than 5MB".to_string());
            }

            new_config.set_avatar(avatar_data);
        }

        // Валидация изменений используя встроенный метод
        let old_config = user.get_group_config(&group_id).await.unwrap();
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

        let users_permisions = &group_config.permissions;
        let default_permissions = &group_config.default_permissions;
        let user_permissions = users_permisions
            .get(&user_id)
            .unwrap_or(default_permissions);

        let event_payload = serde_json::json!({
            "type": "group_config_updated",
            "data": {
                "group_id": group_id.to_string(),
                "group_name": group_config.name,
                "avatar": avatar,
                "description": group_config.description,
                "avatar": group_config.avatar,
                "owner_id": group_config.creator_id,
                "admins": group_config.admins,
                "members": group_config.members,
                "created_at": group_config.created_at.timestamp,
                "user_permissions": user_permissions,
                "users_permisions": users_permisions,
                "default_permissions": default_permissions,
            }
        });
        app_handle.emit("server-event", event_payload).unwrap();

        Ok(serde_json::json!({
            "success": true,
            "message": "Group configuration updated successfully"
        }))
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
    let group_user = group_user.as_ref().unwrap();
    let group_id = GroupId::from_string(&group_id).map_err(|e| e.to_string())?;
    let display_key = group_user
        .get_group_display_key(&group_id)
        .await
        .map_err(|e| e.to_string())?;
    Ok(display_key)
}
