use tauri::Manager;
#[cfg(target_os = "linux")]
use webkit2gtk::{SettingsExt, WebViewExt};

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
            app.webview_windows().values().for_each(|webview_window| {
                if let Err(e) = webview_window.with_webview(|webview| {
                    if let Some(settings) = webview.inner().settings() {
                        #[cfg(target_os = "linux")]
                        enable_web_features(&settings);

                        #[cfg(target_os = "linux")]
                        allow_all_permissions(&webview.inner());
                    }
                }) {
                    eprintln!("Error configuring webview: {:?}", e);
                }
            });
            tauri::async_runtime::spawn(init_client(app.handle().clone()));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::auth::login,
            commands::auth::register,
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
            commands::voice::get_voice_keys,
            commands::voice::initialize_connection,
            commands::voice::join_session,
            commands::voice::get_voice_servers,
            commands::voice::leave_session,
            commands::voice::init_webrtc_signaling,
            commands::voice::send_webrtc_message,
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

#[cfg(target_os = "linux")]
fn enable_web_features(settings: &webkit2gtk::Settings) {
    println!("enabling webrtc");
    settings.set_enable_webrtc(true);
    settings.set_enable_media_stream(true);
    settings.set_enable_mediasource(true);
    settings.set_enable_media(true);
    settings.set_enable_media_capabilities(true);
    settings.set_enable_encrypted_media(true);
    // settings.set_enable_mock_capture_devices(true);
    settings.set_media_playback_requires_user_gesture(false);
    settings.set_media_playback_allows_inline(true);
    settings.set_media_content_types_requiring_hardware_support(None);
    // settings.set_disable_web_security(true);
}

#[cfg(target_os = "linux")]
fn allow_all_permissions(webview: &webkit2gtk::WebView) {
    use webkit2gtk::PermissionRequestExt;
    // Allow all permission requests for debugging
    let _ = webview.connect_permission_request(move |_, request| {
        request.allow();
        true
    });
}
