/// Convenience function to get available servers
pub fn get_avaliable_servers() -> String {
    //String::from("http://192.168.102.166:50051")
    //String::from("http://192.168.101.3:50051")
    String::from("http://192.168.101.42:50051")
}

pub fn get_group_servers() -> String {
    //String::from("h3://192.168.102.166:50053")
    String::from("h3://192.168.101.42:50053")
}

pub fn get_status_servers() -> String {
    //String::from("http://192.168.102.166:50052")
    String::from("http://192.168.101.42:50052")
}

pub fn get_avaliable_voice_servers() -> String {
    //String::from("192.168.102.166")
    String::from("192.168.101.42")
}
