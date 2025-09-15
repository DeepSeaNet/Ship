use mls_rs_codec::{MlsDecode, MlsEncode, MlsSize};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// DateTime структура
#[derive(Debug, Clone, Serialize, Deserialize, MlsSize, MlsDecode, MlsEncode, Copy)]
pub struct DateTime {
    pub timestamp: u64,
}

// Видимость группы
#[derive(Debug, Clone, Serialize, Deserialize, MlsSize, MlsDecode, MlsEncode)]
#[repr(u8)]
pub enum Visibility {
    Public = 1,
    Private = 2,
    Hidden = 3,
}

// Режим входа
#[derive(Debug, Clone, Serialize, Deserialize, MlsSize, MlsDecode, MlsEncode)]
#[repr(u8)]
pub enum JoinMode {
    Open = 1,
    InviteOnly = 2,
    RequestToJoin = 3,
}

// Права участника
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, MlsSize, MlsDecode, MlsEncode)]
pub struct Permissions {
    pub manage_members: bool,
    pub send_messages: bool,
    pub delete_messages: bool,
    pub rename_group: bool,
    pub manage_permissions: bool,
    pub pin_messages: bool,
    pub manage_admins: bool,
}

impl Permissions {
    pub fn default() -> Self {
        Self {
            manage_members: true,
            send_messages: true,
            delete_messages: false,
            rename_group: false,
            manage_permissions: false,
            pin_messages: false,
            manage_admins: false,
        }
    }

    pub fn admin() -> Self {
        Self {
            manage_members: true,
            send_messages: true,
            delete_messages: true,
            rename_group: true,
            manage_permissions: true,
            pin_messages: true,
            manage_admins: true,
        }
    }

    pub fn moderator() -> Self {
        Self {
            manage_members: true,
            send_messages: true,
            delete_messages: true,
            rename_group: false,
            manage_permissions: false,
            pin_messages: true,
            manage_admins: false,
        }
    }

    pub fn member() -> Self {
        Self {
            manage_members: false,
            send_messages: true,
            delete_messages: false,
            rename_group: false,
            manage_permissions: false,
            pin_messages: false,
            manage_admins: false,
        }
    }

    pub fn reader() -> Self {
        Self {
            manage_members: false,
            send_messages: false,
            delete_messages: false,
            rename_group: false,
            manage_permissions: false,
            pin_messages: false,
            manage_admins: false,
        }
    }

    pub fn with_manage_members(mut self, value: bool) -> Self {
        self.manage_members = value;
        self
    }

    pub fn with_send_messages(mut self, value: bool) -> Self {
        self.send_messages = value;
        self
    }

    pub fn with_delete_messages(mut self, value: bool) -> Self {
        self.delete_messages = value;
        self
    }

    pub fn with_rename_group(mut self, value: bool) -> Self {
        self.rename_group = value;
        self
    }

    pub fn with_manage_permissions(mut self, value: bool) -> Self {
        self.manage_permissions = value;
        self
    }

    pub fn with_pin_messages(mut self, value: bool) -> Self {
        self.pin_messages = value;
        self
    }

    pub fn with_manage_admins(mut self, value: bool) -> Self {
        self.manage_admins = value;
        self
    }

    pub fn has_permission(&self, permission: &str) -> bool {
        match permission {
            "manage_members" => self.manage_members,
            "send_messages" => self.send_messages,
            "delete_messages" => self.delete_messages,
            "rename_group" => self.rename_group,
            "manage_permissions" => self.manage_permissions,
            "pin_messages" => self.pin_messages,
            "manage_admins" => self.manage_admins,
            _ => false,
        }
    }
}

// Основная структура GroupConfig
#[derive(Debug, Clone, Serialize, Deserialize, MlsSize, MlsDecode, MlsEncode)]
pub struct GroupConfig {
    // Basic identification
    // add group config epoch to prevent non valid commits
    pub id: u64,
    pub name: String,
    pub created_at: DateTime,
    pub updated_at: DateTime,

    // Visibility and join settings
    pub visibility: Visibility,
    pub join_mode: JoinMode,
    pub invite_link: Option<String>,
    pub max_members: Option<u32>,

    // Member management
    pub creator_id: u64, // Например, идентификатор владельца группы
    pub members: Vec<u64>,
    pub admins: Vec<u64>,
    pub permissions: HashMap<u64, Permissions>, // member_id -> Permissions
    pub default_permissions: Permissions,
    pub banned: Vec<u64>,              // Список ID забаненных пользователей
    pub muted: HashMap<u64, DateTime>, // member_id -> mute_until

    // Content and media
    pub description: Option<String>, // Опциональное описание
    #[serde(with = "serde_bytes")]
    pub avatar: Option<Vec<u8>>, // Опциональный аватар как байты
    #[serde(with = "serde_bytes")]
    pub banner: Option<Vec<u8>>, // Опциональный баннер как байты

    // Group settings
    pub pinned_message_id: Option<u64>,
    pub slow_mode_delay: Option<u32>, // in seconds

    // Additional settings
    pub allow_stickers: bool,
    pub allow_gifs: bool,
    pub allow_voice_messages: bool,
    pub allow_video_messages: bool,
    pub allow_links: bool,
}

impl GroupConfig {
    pub fn new(group_id: u64, group_name: String, creator_id: u64) -> Self {
        let permissions = Permissions::admin();
        let mut permissions_map = HashMap::new();
        permissions_map.insert(creator_id, permissions);
        let default_permissions = Permissions::member();
        let now = DateTime {
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };
        Self {
            id: group_id,
            name: group_name,
            created_at: now,
            updated_at: now,
            visibility: Visibility::Private,
            join_mode: JoinMode::InviteOnly,
            invite_link: None,
            max_members: None,
            creator_id,
            members: vec![creator_id],
            admins: vec![creator_id],
            permissions: permissions_map,
            default_permissions,
            banned: Vec::new(),
            muted: HashMap::new(),
            description: None,
            avatar: None,
            banner: None,
            pinned_message_id: None,
            slow_mode_delay: None,
            allow_stickers: true,
            allow_gifs: true,
            allow_voice_messages: true,
            allow_video_messages: true,
            allow_links: true,
        }
    }

    pub fn add_member(&mut self, member_id: u64) {
        self.members.push(member_id);
        self.permissions
            .insert(member_id, self.default_permissions.clone());
        self.update_timestamp();
    }

    pub fn remove_member(&mut self, member_id: u64) {
        self.members
            .remove(self.members.iter().position(|id| *id == member_id).unwrap());
        self.permissions.remove(&member_id);
        self.update_timestamp();
    }

    pub fn add_admin(&mut self, admin_id: u64) {
        self.admins.push(admin_id);
        self.permissions.insert(admin_id, Permissions::admin());
        self.update_timestamp();
    }

    pub fn remove_admin(&mut self, admin_id: u64) {
        self.admins
            .remove(self.admins.iter().position(|id| *id == admin_id).unwrap());
        self.update_timestamp();
    }

    pub fn add_banned(&mut self, banned_id: u64) {
        self.banned.push(banned_id);
        self.update_timestamp();
    }

    pub fn remove_banned(&mut self, banned_id: u64) {
        self.banned
            .remove(self.banned.iter().position(|id| *id == banned_id).unwrap());
        self.update_timestamp();
    }

    pub fn add_muted(&mut self, muted_id: u64, muted_until: DateTime) {
        self.muted.insert(muted_id, muted_until);
        self.update_timestamp();
    }

    pub fn remove_muted(&mut self, muted_id: u64) {
        self.muted.remove(&muted_id);
        self.update_timestamp();
    }

    pub fn set_name(&mut self, group_name: String) {
        self.name = group_name;
        self.update_timestamp();
    }

    pub fn set_description(&mut self, description: String) {
        self.description = Some(description);
        self.update_timestamp();
    }

    pub fn set_avatar(&mut self, avatar: Vec<u8>) {
        self.avatar = Some(avatar);
        self.update_timestamp();
    }

    pub fn set_banner(&mut self, banner: Vec<u8>) {
        self.banner = Some(banner);
        self.update_timestamp();
    }

    pub fn set_pinned_message_id(&mut self, pinned_message_id: u64) {
        self.pinned_message_id = Some(pinned_message_id);
        self.update_timestamp();
    }

    pub fn set_slow_mode_delay(&mut self, slow_mode_delay: u32) {
        self.slow_mode_delay = Some(slow_mode_delay);
        self.update_timestamp();
    }

    pub fn set_allow_stickers(&mut self, allow_stickers: bool) {
        self.allow_stickers = allow_stickers;
        self.update_timestamp();
    }

    pub fn set_allow_gifs(&mut self, allow_gifs: bool) {
        self.allow_gifs = allow_gifs;
        self.update_timestamp();
    }

    pub fn set_allow_voice_messages(&mut self, allow_voice_messages: bool) {
        self.allow_voice_messages = allow_voice_messages;
        self.update_timestamp();
    }

    pub fn set_allow_video_messages(&mut self, allow_video_messages: bool) {
        self.allow_video_messages = allow_video_messages;
        self.update_timestamp();
    }

    pub fn set_allow_links(&mut self, allow_links: bool) {
        self.allow_links = allow_links;
        self.update_timestamp();
    }

    pub fn set_permissions(&mut self, member_id: u64, permissions: Permissions) {
        self.permissions.insert(member_id, permissions);
        self.update_timestamp();
    }

    pub fn is_admin(&self, user_id: u64) -> bool {
        self.admins.contains(&user_id)
    }

    pub fn get_regular_members(&self) -> Vec<u64> {
        self.permissions
            .iter()
            .filter(|(_, permissions)| *permissions == &self.default_permissions)
            .map(|(member_id, _)| *member_id)
            .collect()
    }

    pub fn set_allow_messages(&mut self, allow_messages: bool) {
        let mut permissions = self.default_permissions.clone();
        permissions = permissions.with_send_messages(allow_messages);
        self.default_permissions = permissions;
        for member_id in self.get_regular_members() {
            self.permissions
                .insert(member_id, self.default_permissions.clone());
        }
        self.update_timestamp();
    }

    pub fn is_member(&self, user_id: u64) -> bool {
        self.members.contains(&user_id)
    }

    pub fn is_banned(&self, user_id: u64) -> bool {
        self.banned.contains(&user_id)
    }

    pub fn is_muted(&self, user_id: u64) -> bool {
        self.muted.contains_key(&user_id)
    }

    pub fn get_member_permissions(&self, user_id: u64) -> Option<&Permissions> {
        self.permissions.get(&user_id)
    }

    pub fn has_permission(&self, user_id: u64, permission: &str) -> bool {
        if self.is_admin(user_id) {
            return true;
        }

        if let Some(perms) = self.get_member_permissions(user_id) {
            perms.has_permission(permission)
        } else {
            false
        }
    }

    pub fn set_member_role(&mut self, user_id: u64, role: &str) {
        let permissions = match role {
            "admin" => Permissions::admin(),
            "moderator" => Permissions::moderator(),
            "member" => Permissions::member(),
            "reader" => Permissions::reader(),
            _ => Permissions::member(),
        };

        self.update_permissions(user_id, |p| {
            *p = permissions;
        });

        match role {
            "admin" => {
                if !self.is_admin(user_id) {
                    self.add_admin(user_id);
                }
            }
            _ => {
                if self.is_admin(user_id) {
                    self.remove_admin(user_id);
                }
            }
        }
        self.update_timestamp();
    }

    pub fn update_permissions(&mut self, user_id: u64, f: impl FnOnce(&mut Permissions)) {
        if let Some(perms) = self.permissions.get_mut(&user_id) {
            log::info!("Updating permissions for user: {}", user_id);
            f(perms);
        }
        log::info!("Permissions after update: {:#?}", self.permissions);
        self.update_timestamp();
    }

    pub fn set_visibility(&mut self, visibility: Visibility) {
        self.visibility = visibility;
        self.update_timestamp();
    }

    pub fn set_join_mode(&mut self, join_mode: JoinMode) {
        self.join_mode = join_mode;
        self.update_timestamp();
    }

    pub fn set_invite_link(&mut self, link: Option<String>) {
        self.invite_link = link;
        self.update_timestamp();
    }

    pub fn set_max_members(&mut self, max: Option<u32>) {
        self.max_members = max;
        self.update_timestamp();
    }

    pub fn is_full(&self) -> bool {
        if let Some(max) = self.max_members {
            self.members.len() >= max as usize
        } else {
            false
        }
    }

    pub fn validate_changes(
        &self,
        new_config: &GroupConfig,
        user_id: u64,
    ) -> ConfigValidationResult {
        let mut changes = Vec::new();
        let mut valid = true;

        // Check name change
        if self.name != new_config.name {
            changes.push(ConfigChange {
                field: "name".to_string(),
                old_value: self.name.clone(),
                new_value: new_config.name.clone(),
            });

            if !self.has_permission(user_id, "rename_group") {
                valid = false;
            }
        }

        // Check visibility change
        if std::mem::discriminant(&self.visibility)
            != std::mem::discriminant(&new_config.visibility)
        {
            changes.push(ConfigChange {
                field: "visibility".to_string(),
                old_value: format!("{:?}", self.visibility),
                new_value: format!("{:?}", new_config.visibility),
            });

            if !self.has_permission(user_id, "manage_permissions") {
                valid = false;
            }
        }

        // Check join mode change
        if std::mem::discriminant(&self.join_mode) != std::mem::discriminant(&new_config.join_mode)
        {
            changes.push(ConfigChange {
                field: "join_mode".to_string(),
                old_value: format!("{:?}", self.join_mode),
                new_value: format!("{:?}", new_config.join_mode),
            });

            if !self.has_permission(user_id, "manage_permissions") {
                valid = false;
            }
        }

        // Check invite link change
        if self.invite_link != new_config.invite_link {
            changes.push(ConfigChange {
                field: "invite_link".to_string(),
                old_value: self.invite_link.clone().unwrap_or_default(),
                new_value: new_config.invite_link.clone().unwrap_or_default(),
            });

            if !self.has_permission(user_id, "manage_members") {
                valid = false;
            }
        }

        // Check max members change
        if self.max_members != new_config.max_members {
            changes.push(ConfigChange {
                field: "max_members".to_string(),
                old_value: self
                    .max_members
                    .map_or("None".to_string(), |v| v.to_string()),
                new_value: new_config
                    .max_members
                    .map_or("None".to_string(), |v| v.to_string()),
            });

            if !self.has_permission(user_id, "manage_permissions") {
                valid = false;
            }
        }

        // Check members changes
        if self.members != new_config.members {
            changes.push(ConfigChange {
                field: "members".to_string(),
                old_value: format!("{:?}", self.members),
                new_value: format!("{:?}", new_config.members),
            });

            // Если пользователь удаляет себя — разрешаем
            let removing_self = self.is_member(user_id) && !new_config.is_member(user_id);

            if !removing_self && !self.has_permission(user_id, "manage_members") {
                valid = false;
            }
        }

        // Check admins changes
        if self.admins != new_config.admins {
            changes.push(ConfigChange {
                field: "admins".to_string(),
                old_value: format!("{:?}", self.admins),
                new_value: format!("{:?}", new_config.admins),
            });

            if !self.has_permission(user_id, "manage_admins") {
                valid = false;
            }
        }

        // Check permissions changes
        if self.permissions.len() != new_config.permissions.len()
            || self
                .permissions
                .iter()
                .any(|(k, v)| !(new_config.permissions.get(k) == Some(v)))
        {
            changes.push(ConfigChange {
                field: "permissions".to_string(),
                old_value: "...".to_string(), // Simplified for readability
                new_value: "...".to_string(),
            });

            if !self.has_permission(user_id, "manage_permissions") {
                valid = false;
            }
        }

        // Check description change
        if self.description != new_config.description {
            changes.push(ConfigChange {
                field: "description".to_string(),
                old_value: self.description.clone().unwrap_or_default(),
                new_value: new_config.description.clone().unwrap_or_default(),
            });

            if !self.has_permission(user_id, "rename_group") {
                valid = false;
            }
        }

        // Check avatar change
        if self.avatar != new_config.avatar {
            changes.push(ConfigChange {
                field: "avatar".to_string(),
                old_value: "...".to_string(), // Simplified for readability
                new_value: "...".to_string(),
            });

            if !self.has_permission(user_id, "rename_group") {
                valid = false;
            }
        }

        // Check banner change
        if self.banner != new_config.banner {
            changes.push(ConfigChange {
                field: "banner".to_string(),
                old_value: "...".to_string(), // Simplified for readability
                new_value: "...".to_string(),
            });

            if !self.has_permission(user_id, "rename_group") {
                valid = false;
            }
        }

        // Check pinned message change
        if self.pinned_message_id != new_config.pinned_message_id {
            changes.push(ConfigChange {
                field: "pinned_message_id".to_string(),
                old_value: self
                    .pinned_message_id
                    .map_or("None".to_string(), |v| v.to_string()),
                new_value: new_config
                    .pinned_message_id
                    .map_or("None".to_string(), |v| v.to_string()),
            });

            if !self.has_permission(user_id, "pin_messages") {
                valid = false;
            }
        }

        // Check slow mode delay change
        if self.slow_mode_delay != new_config.slow_mode_delay {
            changes.push(ConfigChange {
                field: "slow_mode_delay".to_string(),
                old_value: self
                    .slow_mode_delay
                    .map_or("None".to_string(), |v| v.to_string()),
                new_value: new_config
                    .slow_mode_delay
                    .map_or("None".to_string(), |v| v.to_string()),
            });

            if !self.has_permission(user_id, "manage_permissions") {
                valid = false;
            }
        }

        // Check content settings changes
        if self.allow_stickers != new_config.allow_stickers {
            changes.push(ConfigChange {
                field: "allow_stickers".to_string(),
                old_value: self.allow_stickers.to_string(),
                new_value: new_config.allow_stickers.to_string(),
            });

            if !self.has_permission(user_id, "manage_permissions") {
                valid = false;
            }
        }

        if self.allow_gifs != new_config.allow_gifs {
            changes.push(ConfigChange {
                field: "allow_gifs".to_string(),
                old_value: self.allow_gifs.to_string(),
                new_value: new_config.allow_gifs.to_string(),
            });

            if !self.has_permission(user_id, "manage_permissions") {
                valid = false;
            }
        }

        if self.allow_voice_messages != new_config.allow_voice_messages {
            changes.push(ConfigChange {
                field: "allow_voice_messages".to_string(),
                old_value: self.allow_voice_messages.to_string(),
                new_value: new_config.allow_voice_messages.to_string(),
            });

            if !self.has_permission(user_id, "manage_permissions") {
                valid = false;
            }
        }

        if self.allow_video_messages != new_config.allow_video_messages {
            changes.push(ConfigChange {
                field: "allow_video_messages".to_string(),
                old_value: self.allow_video_messages.to_string(),
                new_value: new_config.allow_video_messages.to_string(),
            });

            if !self.has_permission(user_id, "manage_permissions") {
                valid = false;
            }
        }

        if self.allow_links != new_config.allow_links {
            changes.push(ConfigChange {
                field: "allow_links".to_string(),
                old_value: self.allow_links.to_string(),
                new_value: new_config.allow_links.to_string(),
            });

            if !self.has_permission(user_id, "manage_permissions") {
                valid = false;
            }
        }

        ConfigValidationResult { changes, valid }
    }
    fn update_timestamp(&mut self) {
        self.updated_at = DateTime {
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_secs(),
        };
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ConfigChange {
    pub field: String,
    pub old_value: String,
    pub new_value: String,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ConfigValidationResult {
    pub changes: Vec<ConfigChange>,
    pub valid: bool,
}
