use crate::api::device::types::extensions::group_config::group_config::{
    DateTime, GroupConfig, JoinMode, Permissions, Visibility,
};
use std::collections::BTreeMap;

/// Builder pattern for creating GroupConfig instances
/// Provides a fluent interface for configuring group settings
#[derive(Debug, Clone)]
pub struct GroupConfigBuilder {
    // Required fields
    group_id: u64,
    group_name: String,
    creator_id: u64,

    // Optional configuration fields
    visibility: Option<Visibility>,
    join_mode: Option<JoinMode>,
    description: Option<String>,
    avatar: Option<Vec<u8>>,
    banner: Option<Vec<u8>>,
    max_members: Option<u32>,
    slow_mode_delay: Option<u32>,
    invite_link: Option<String>,
    pinned_message_id: Option<u64>,

    // Content settings
    allow_stickers: Option<bool>,
    allow_gifs: Option<bool>,
    allow_voice_messages: Option<bool>,
    allow_video_messages: Option<bool>,
    allow_links: Option<bool>,

    // Member management
    additional_members: Vec<u64>,
    additional_admins: Vec<u64>,
    custom_permissions: BTreeMap<u64, Permissions>,
    default_member_permissions: Option<Permissions>,
    banned_users: Vec<u64>,
    muted_users: BTreeMap<u64, DateTime>,
}

impl GroupConfigBuilder {
    /// Create a new GroupConfigBuilder with required parameters
    ///
    /// # Arguments
    /// * `group_id` - Unique identifier for the group
    /// * `group_name` - Display name for the group
    /// * `creator_id` - User ID of the group creator
    pub fn new(group_id: u64, group_name: String, creator_id: u64) -> Self {
        Self {
            group_id,
            group_name,
            creator_id,
            visibility: None,
            join_mode: None,
            description: None,
            avatar: None,
            banner: None,
            max_members: None,
            slow_mode_delay: None,
            invite_link: None,
            pinned_message_id: None,
            allow_stickers: None,
            allow_gifs: None,
            allow_voice_messages: None,
            allow_video_messages: None,
            allow_links: None,
            additional_members: Vec::new(),
            additional_admins: Vec::new(),
            custom_permissions: BTreeMap::new(),
            default_member_permissions: None,
            banned_users: Vec::new(),
            muted_users: BTreeMap::new(),
        }
    }

    /// Set the visibility of the group
    pub fn with_visibility(mut self, visibility: Visibility) -> Self {
        self.visibility = Some(visibility);
        self
    }

    /// Set the join mode of the group
    pub fn with_join_mode(mut self, join_mode: JoinMode) -> Self {
        self.join_mode = Some(join_mode);
        self
    }

    /// Set the group description
    pub fn with_description<S: Into<String>>(mut self, description: S) -> Self {
        self.description = Some(description.into());
        self
    }

    /// Set the group avatar
    pub fn with_avatar(mut self, avatar: Vec<u8>) -> Self {
        self.avatar = Some(avatar);
        self
    }

    /// Set the group banner
    pub fn with_banner(mut self, banner: Vec<u8>) -> Self {
        self.banner = Some(banner);
        self
    }

    /// Set the maximum number of members
    pub fn with_max_members(mut self, max_members: u32) -> Self {
        self.max_members = Some(max_members);
        self
    }

    /// Set the slow mode delay in seconds
    pub fn with_slow_mode_delay(mut self, delay: u32) -> Self {
        self.slow_mode_delay = Some(delay);
        self
    }

    /// Set the invite link
    pub fn with_invite_link<S: Into<String>>(mut self, link: S) -> Self {
        self.invite_link = Some(link.into());
        self
    }

    /// Set the pinned message ID
    pub fn with_pinned_message(mut self, message_id: u64) -> Self {
        self.pinned_message_id = Some(message_id);
        self
    }

    /// Configure whether stickers are allowed
    pub fn allow_stickers(mut self, allow: bool) -> Self {
        self.allow_stickers = Some(allow);
        self
    }

    /// Configure whether GIFs are allowed
    pub fn allow_gifs(mut self, allow: bool) -> Self {
        self.allow_gifs = Some(allow);
        self
    }

    /// Configure whether voice messages are allowed
    pub fn allow_voice_messages(mut self, allow: bool) -> Self {
        self.allow_voice_messages = Some(allow);
        self
    }

    /// Configure whether video messages are allowed
    pub fn allow_video_messages(mut self, allow: bool) -> Self {
        self.allow_video_messages = Some(allow);
        self
    }

    /// Configure whether links are allowed
    pub fn allow_links(mut self, allow: bool) -> Self {
        self.allow_links = Some(allow);
        self
    }

    /// Add additional members to the group (beyond the creator)
    pub fn with_members(mut self, member_ids: Vec<u64>) -> Self {
        self.additional_members = member_ids;
        self
    }

    /// Add a single member to the group
    pub fn add_member(mut self, member_id: u64) -> Self {
        self.additional_members.push(member_id);
        self
    }

    /// Add additional admins to the group (beyond the creator)
    pub fn with_admins(mut self, admin_ids: Vec<u64>) -> Self {
        self.additional_admins = admin_ids;
        self
    }

    /// Add a single admin to the group
    pub fn add_admin(mut self, admin_id: u64) -> Self {
        self.additional_admins.push(admin_id);
        self
    }

    /// Set custom permissions for a specific user
    pub fn with_user_permissions(mut self, user_id: u64, permissions: Permissions) -> Self {
        self.custom_permissions.insert(user_id, permissions);
        self
    }

    /// Set the default permissions for new members
    pub fn with_default_permissions(mut self, permissions: Permissions) -> Self {
        self.default_member_permissions = Some(permissions);
        self
    }

    /// Add banned users to the group
    pub fn with_banned_users(mut self, banned_ids: Vec<u64>) -> Self {
        self.banned_users = banned_ids;
        self
    }

    /// Add a single banned user
    pub fn ban_user(mut self, user_id: u64) -> Self {
        self.banned_users.push(user_id);
        self
    }

    /// Add muted users with their mute expiration times
    pub fn with_muted_users(mut self, muted: BTreeMap<u64, DateTime>) -> Self {
        self.muted_users = muted;
        self
    }

    /// Mute a single user until the specified time
    pub fn mute_user(mut self, user_id: u64, until: DateTime) -> Self {
        self.muted_users.insert(user_id, until);
        self
    }

    /// Build the final GroupConfig instance
    ///
    /// This method validates the configuration and creates the GroupConfig
    pub fn build(self) -> Result<GroupConfig, GroupConfigBuilderError> {
        // Validate required fields
        if self.group_name.trim().is_empty() {
            return Err(GroupConfigBuilderError::InvalidGroupName);
        }

        // Validate max members if set
        if let Some(max) = self.max_members {
            if max == 0 {
                return Err(GroupConfigBuilderError::InvalidMaxMembers);
            }

            let total_members = 1 + self.additional_members.len(); // +1 for creator
            if total_members > max as usize {
                return Err(GroupConfigBuilderError::TooManyMembers);
            }
        }

        // Create base configuration
        let mut config = GroupConfig::new(self.group_id, self.group_name, self.creator_id);

        // Apply optional settings
        if let Some(visibility) = self.visibility {
            config.set_visibility(visibility);
        }

        if let Some(join_mode) = self.join_mode {
            config.set_join_mode(join_mode);
        }

        if let Some(description) = self.description {
            config.set_description(description);
        }

        if let Some(avatar) = self.avatar {
            config.set_avatar(avatar);
        }

        if let Some(banner) = self.banner {
            config.set_banner(banner);
        }

        if let Some(max_members) = self.max_members {
            config.set_max_members(Some(max_members));
        }

        if let Some(delay) = self.slow_mode_delay {
            config.set_slow_mode_delay(delay);
        }

        if let Some(link) = self.invite_link {
            config.set_invite_link(Some(link));
        }

        if let Some(message_id) = self.pinned_message_id {
            config.set_pinned_message_id(message_id);
        }

        // Apply content settings
        if let Some(allow) = self.allow_stickers {
            config.set_allow_stickers(allow);
        }

        if let Some(allow) = self.allow_gifs {
            config.set_allow_gifs(allow);
        }

        if let Some(allow) = self.allow_voice_messages {
            config.set_allow_voice_messages(allow);
        }

        if let Some(allow) = self.allow_video_messages {
            config.set_allow_video_messages(allow);
        }

        if let Some(allow) = self.allow_links {
            config.set_allow_links(allow);
        }

        // Set default permissions if specified
        if let Some(default_perms) = self.default_member_permissions {
            config.default_permissions = default_perms;
        }

        // Add additional members
        for member_id in self.additional_members {
            config.add_member(member_id);
        }

        // Add additional admins
        for admin_id in self.additional_admins {
            config.add_admin(admin_id);
        }

        // Apply custom permissions
        for (user_id, permissions) in self.custom_permissions {
            config.set_permissions(user_id, permissions);
        }

        // Add banned users
        for banned_id in self.banned_users {
            config.add_banned(banned_id);
        }

        // Add muted users
        for (user_id, until) in self.muted_users {
            config.add_muted(user_id, until);
        }

        Ok(config)
    }
}

/// Predefined configurations for common group types
impl GroupConfigBuilder {
    /// Create a public group configuration
    pub fn public_group(group_id: u64, group_name: String, creator_id: u64) -> Self {
        Self::new(group_id, group_name, creator_id)
            .with_visibility(Visibility::Public)
            .with_join_mode(JoinMode::Open)
            .with_default_permissions(Permissions::member())
    }

    /// Create a private group configuration
    pub fn private_group(group_id: u64, group_name: String, creator_id: u64) -> Self {
        Self::new(group_id, group_name, creator_id)
            .with_visibility(Visibility::Private)
            .with_join_mode(JoinMode::InviteOnly)
            .with_default_permissions(Permissions::member())
    }

    /// Create a hidden group configuration
    pub fn hidden_group(group_id: u64, group_name: String, creator_id: u64) -> Self {
        Self::new(group_id, group_name, creator_id)
            .with_visibility(Visibility::Hidden)
            .with_join_mode(JoinMode::InviteOnly)
            .with_default_permissions(Permissions::member())
    }

    /// Create a read-only group configuration
    pub fn read_only_group(group_id: u64, group_name: String, creator_id: u64) -> Self {
        Self::new(group_id, group_name, creator_id)
            .with_visibility(Visibility::Public)
            .with_join_mode(JoinMode::RequestToJoin)
            .with_default_permissions(Permissions::reader())
    }

    /// Create a restricted content group (no media/links)
    pub fn restricted_content_group(group_id: u64, group_name: String, creator_id: u64) -> Self {
        Self::new(group_id, group_name, creator_id)
            .allow_stickers(false)
            .allow_gifs(false)
            .allow_voice_messages(false)
            .allow_video_messages(false)
            .allow_links(false)
    }
}

/// Errors that can occur during group configuration building
#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum GroupConfigBuilderError {
    #[error("Group name cannot be empty")]
    InvalidGroupName,
    #[error("Maximum members must be greater than 0")]
    InvalidMaxMembers,
    #[error("Number of initial members exceeds maximum limit")]
    TooManyMembers,
}
