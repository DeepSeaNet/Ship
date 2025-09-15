fn main() -> Result<(), Box<dyn std::error::Error>> {
    tonic_build::compile_protos("../Server/api/auth/proto/account.proto").unwrap();
    tonic_build::compile_protos("../Server/service/group/proto/group_microservice.proto").unwrap();
    tonic_build::compile_protos("../Server/service/voice/proto/signaling.proto").unwrap();
    tonic_build::compile_protos("../Server/api/status/proto/user_status.proto").unwrap();

    tauri_build::build();

    Ok(())
}
