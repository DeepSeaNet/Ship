use tauri::AppHandle;

use crate::api::device::types::{
    errors::GroupError, extensions::group_config::group_config::Permissions,
};

#[derive(serde::Serialize, Clone)]
struct SystemEvent<'a, T: Clone> {
    #[serde(rename = "type")]
    event_type: &'a str,
    data: T,
}

#[derive(serde::Serialize, Clone)]
struct JoinGroupData<'a> {
    group_name: &'a str,
    group_id: String,
    description: &'a Option<String>,
    avatar: &'a Option<Vec<u8>>,
    member_count: usize,
    members: &'a [u64],
    user_permissions: &'a Permissions,
    users_permisions: &'a std::collections::HashMap<u64, Permissions>,
    owner_id: u64,
    admins: &'a [u64],
    date: u64,
    default_permissions: &'a Permissions,
}

#[derive(serde::Serialize, Clone)]
struct NewGroupMessageData<'a> {
    group_id: String,
    group_name: &'a str,
    sender_id: String,
    text: &'a str,
    timestamp: i64,
    media: &'a Option<Vec<u8>>,
    media_name: &'a Option<String>,
    message_id: String,
    reply_message_id: Option<String>,
    edit_date: Option<String>,
    is_edit: bool,
    expires: Option<String>,
}

#[derive(serde::Serialize, Clone)]
struct MessageDeliveryData {
    message_id: String,
    success: bool,
}

#[derive(serde::Serialize, Clone)]
struct WelcomeMessageData {
    message_id: String,
    success: bool,
}

#[derive(serde::Serialize, Clone)]
struct GroupConfigUpdatedData<'a> {
    group_id: String,
    group_name: &'a str,
    description: &'a Option<String>,
    avatar: &'a Option<Vec<u8>>,
    owner_id: u64,
    admins: &'a [u64],
    members: &'a [u64],
    created_at: u64,
    user_permissions: &'a Permissions,
    users_permisions: &'a std::collections::HashMap<u64, Permissions>,
    default_permissions: &'a Permissions,
}
