use mls_rs_codec::{MlsDecode, MlsEncode, MlsSize};

#[derive(MlsDecode, MlsEncode, MlsSize)]
pub struct RegisterGroupDeviceTBS {
    pub user_id: u64,
    pub device_id: String,
}

#[derive(MlsDecode, MlsEncode, MlsSize)]
pub struct UploadKeyPackagesTBS {
    pub user_id: u64,
    pub device_id: String,
    pub key_packages: Vec<Vec<u8>>,
}

#[derive(MlsDecode, MlsEncode, MlsSize)]
pub struct InitGroupStreamTBS {
    pub user_id: u64,
    pub device_id: String,
    pub date: u64,
}
