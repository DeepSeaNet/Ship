fn main() -> Result<(), Box<dyn std::error::Error>> {
    let sea_path = std::env::var("SEA_PATH").unwrap_or_else(|_| "../Sea".into());

    tonic_prost_build::compile_protos(format!(
        "{}/service/auth/api/auth/proto/account.proto",
        sea_path
    ))?;
    tonic_prost_build::compile_protos(format!(
        "{}/service/group/proto/group_microservice.proto",
        sea_path
    ))?;

    // Compile signaling.proto with serde support and service client
    tonic_prost_build::configure()
        .type_attribute(".", "#[derive(serde::Serialize, serde::Deserialize)]")
        .type_attribute(".", "#[serde(rename_all = \"camelCase\")]")
        .compile_protos(
            &[format!("{}/service/voice/proto/signaling.proto", sea_path)],
            &[format!("{}/service/voice/proto", sea_path)],
        )?;

    tonic_prost_build::compile_protos(format!(
        "{}/service/status/proto/user_status.proto",
        sea_path
    ))?;

    tauri_typegen::BuildSystem::generate_at_build_time()
        .expect("Failed to generate TypeScript bindings");

    tauri_build::build();

    Ok(())
}
