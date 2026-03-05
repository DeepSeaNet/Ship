// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Prevent craching on nvidia
        std::env::set_var("__NV_DISABLE_EXPLICIT_SYNC", "1");
    }
    env_logger::Builder::from_env(
        env_logger::Env::default().default_filter_or("h2=off,h2::codec=warn,quinn=warn,debug"),
    )
    .init();

    ship_lib::run()
}
