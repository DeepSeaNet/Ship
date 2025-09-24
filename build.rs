fn main() -> Result<(), Box<dyn std::error::Error>> {
    let sea_path = std::env::var("SEA_PATH").unwrap_or_else(|_| "../Sea".into());

    tonic_prost_build::compile_protos(format!("{}/api/auth/proto/account.proto", sea_path))?;
    tonic_prost_build::compile_protos(format!(
        "{}/service/group/proto/group_microservice.proto",
        sea_path
    ))?;
    tonic_prost_build::compile_protos(format!("{}/service/voice/proto/signaling.proto", sea_path))?;
    tonic_prost_build::compile_protos(format!("{}/api/status/proto/user_status.proto", sea_path))?;

    tauri_build::build();

    Ok(())
}
