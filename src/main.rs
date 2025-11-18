// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    unsafe {
        std::env::set_var("RUST_LOG", "debug");
        #[cfg(target_os = "linux")]
        {
            // Prevent craching on nvidia
            std::env::set_var("__NV_DISABLE_EXPLICIT_SYNC", "1");
        }
    }
    env_logger::init();

    ship_lib::run()
}
