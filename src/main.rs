// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Prevent craching on nvidia
        unsafe {
            std::env::set_var("__NV_DISABLE_EXPLICIT_SYNC", "1");
        }
    }

    env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("warn,ship_lib=debug,sqlx=debug"),
    )
    .init();

    ship_lib::run()
}
