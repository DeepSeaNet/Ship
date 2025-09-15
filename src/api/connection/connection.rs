/// Convenience function to get available servers
pub fn get_avaliable_servers() -> String {
    //String::from("http://192.168.101.42:50051")
    //String::from("http://192.168.101.3:50051")
    //return String::from("http://94.228.164.109:50051");
    String::from("http://192.168.103.102:50051")
    //String::from("http://94.228.164.109:80/grpc")
    //String::from("http://shipmessenger.ton/grpc")
}

pub fn get_group_servers() -> String {
    String::from("http://192.168.103.102:50053")
}

pub fn get_avaliable_voice_servers() -> String {
    String::from("192.168.103.102")
    //String::from("192.168.101.42")
    //String::from("94.228.164.109")
    //String::from("192.168.102.251")
}
