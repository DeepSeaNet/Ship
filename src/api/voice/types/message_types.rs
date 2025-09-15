use serde::{Deserialize, Serialize};

// Типы для сериализации в JSON (для вызовов из JavaScript)
#[derive(Debug, Serialize, Deserialize)]
pub struct JoinRequestJs {
    pub session_id: String,
    pub sdp: String,
    // Убираем group_info, он должен обрабатываться только Rust кодом
}

#[derive(Debug, Serialize, Deserialize)]
pub struct JoinResponseJs {
    pub success: bool,
    pub answer: String,
    pub error_message: String,
    // Результат обработки group_info не должен передаваться в JS
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OfferRequestJs {
    pub session_id: String,
    pub endpoint_id: String,
    pub sdp: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OfferResponseJs {
    pub success: bool,
    pub sdp: String,
    pub error_message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnswerRequestJs {
    pub session_id: String,
    pub endpoint_id: String,
    pub sdp: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnswerResponseJs {
    pub success: bool,
    pub error_message: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LeaveRequestJs {
    pub session_id: String,
    pub endpoint_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LeaveResponseJs {
    pub success: bool,
    pub error_message: String,
}
