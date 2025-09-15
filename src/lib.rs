mod api {
    pub mod account;
    pub mod connection;
    pub mod device;
    pub mod status;
    pub mod voice;
}

mod commands;

#[cfg(test)]
mod tests;

async fn init_client(_app_handle: tauri::AppHandle) -> Result<(), String> {
    log::info!("Client initialized");
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            tauri::async_runtime::spawn(init_client(app.handle().clone()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth::grpc_login,
            commands::auth::grpc_register,
            commands::auth::reconnect,
            commands::utils::save_media_file,
            commands::utils::save_file_from_memory,
            commands::auth::get_account_list,
            commands::auth::delete_account,
            commands::auth::log_out,
            commands::auth::export_account,
            commands::auth::import_account,
            commands::chat::send_message,
            commands::chat::create_chat,
            commands::chat::get_chats,
            commands::chat::get_messages,
            commands::group::create_group,
            commands::group::leave_group,
            commands::group::get_groups,
            commands::group::invite_to_group,
            commands::group::remove_from_group,
            commands::group::send_group_message,
            commands::group::get_group_messages,
            commands::group::delete_group_message,
            commands::group::get_group_media,
            commands::group::get_all_group_media,
            commands::group::clear_group_media_cache,
            commands::group::get_group_media_cache_size,
            commands::group::update_group_config,
            commands::group::update_member_permissions,
            commands::group::get_group_display_key,
            commands::voice::encrypt_voice,
            commands::voice::decrypt_voice,
            commands::voice::initialize_connection,
            commands::voice::join_session,
            commands::voice::get_voice_servers,
            commands::voice::leave_session,
            commands::user::get_user_status,
            commands::user::get_user_info,
            commands::user::update_username,
            commands::user::update_avatar,
            commands::user::set_user_status,
            commands::user::send_typing_status,
            commands::user::subscribe_to_users,
            commands::user::unsubscribe_from_users,
            commands::user::get_contacts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
