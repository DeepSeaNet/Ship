// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    unsafe {
        std::env::set_var("RUST_LOG", "debug");
    }
    env_logger::init();

    ship_lib::run()
}
