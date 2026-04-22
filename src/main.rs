// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
#![deny(clippy::unwrap_used)]
#![deny(clippy::expect_used)]
#![deny(clippy::panic)]
#![deny(clippy::unimplemented)]
#![deny(clippy::todo)]
#![deny(clippy::arithmetic_side_effects)]
#![deny(clippy::float_arithmetic)]
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
