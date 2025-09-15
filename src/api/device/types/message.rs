use zerocopy::{FromBytes, Immutable, IntoBytes, KnownLayout};

#[derive(IntoBytes, FromBytes, Clone, Copy, Immutable, KnownLayout)]
#[repr(C)]
pub struct GroupTextMessageHeader {
    pub message_id: i64,
    pub sender_id: i64,
    pub date: i64,
    pub group_id_len: u64,
    pub text_len: u64,
    pub media_len: u64,
    pub media_name_len: u64,
    pub reply_message_id: i64,
    pub expires: i64,
    pub edit_date: i64,
}

#[derive(IntoBytes, FromBytes, Clone, Copy, Immutable, KnownLayout)]
#[repr(C)]
pub struct GroupConfigMessageHeader {
    pub message_id: i64,
    pub group_id: i64,
    pub sender_id: i64,
    pub date: i64,
}

#[derive(Debug, Clone, PartialEq)]
pub struct GroupTextMessage {
    pub message_id: i64,
    pub group_id: String,
    pub sender_id: i64,
    pub date: i64,
    pub text: String,
    pub media: Option<Vec<u8>>,
    pub media_name: Option<String>,
    pub reply_message_id: Option<i64>,
    pub expires: Option<i64>,
    pub edit_date: Option<i64>,
}

impl GroupTextMessage {
    pub fn to_bytes(&self) -> Vec<u8> {
        let group_id_bytes = self.group_id.as_bytes();
        let text_bytes = self.text.as_bytes();
        let media_bytes = self.media.as_ref().map(|v| &v[..]).unwrap_or(&[]);
        let media_name_bytes = self
            .media_name
            .as_ref()
            .map(|s| s.as_bytes())
            .unwrap_or(&[]);

        let header = GroupTextMessageHeader {
            message_id: self.message_id,
            sender_id: self.sender_id,
            date: self.date,
            group_id_len: group_id_bytes.len() as u64,
            text_len: text_bytes.len() as u64,
            media_len: media_bytes.len() as u64,
            media_name_len: media_name_bytes.len() as u64,
            reply_message_id: self.reply_message_id.unwrap_or(-1),
            expires: self.expires.unwrap_or(-1),
            edit_date: self.edit_date.unwrap_or(-1),
        };

        let mut bytes = Vec::new();
        bytes.extend_from_slice(header.as_bytes());
        bytes.extend_from_slice(group_id_bytes);
        bytes.extend_from_slice(text_bytes);
        bytes.extend_from_slice(media_bytes);
        bytes.extend_from_slice(media_name_bytes);
        bytes
    }

    pub fn from_bytes(data: &[u8]) -> Result<Self, String> {
        let header_size = std::mem::size_of::<GroupTextMessageHeader>();
        if data.len() < header_size {
            return Err("Data too short for header".to_string());
        }

        let header = GroupTextMessageHeader::read_from_bytes(&data[..header_size])
            .map_err(|e| format!("Failed to read header: {}", e))?;

        let mut offset = header_size;

        let group_id_end = offset + header.group_id_len as usize;
        if group_id_end > data.len() {
            return Err("Data too short for group_id".to_string());
        }
        let group_id = String::from_utf8(data[offset..group_id_end].to_vec())
            .map_err(|e| format!("Invalid UTF-8 in group_id: {}", e))?;
        offset = group_id_end;

        let text_end = offset + header.text_len as usize;
        if text_end > data.len() {
            return Err("Data too short for text".to_string());
        }
        let text = String::from_utf8(data[offset..text_end].to_vec())
            .map_err(|e| format!("Invalid UTF-8 in text: {}", e))?;
        offset = text_end;

        let media = if header.media_len > 0 {
            let media_end = offset + header.media_len as usize;
            if media_end > data.len() {
                return Err("Data too short for media".to_string());
            }
            let media_bytes = data[offset..media_end].to_vec();
            offset = media_end;
            Some(media_bytes)
        } else {
            None
        };

        let media_name = if header.media_name_len > 0 {
            let media_name_end = offset + header.media_name_len as usize;
            if media_name_end > data.len() {
                return Err("Data too short for media_name".to_string());
            }
            let name = String::from_utf8(data[offset..media_name_end].to_vec())
                .map_err(|e| format!("Invalid UTF-8 in media name: {}", e))?;
            Some(name)
        } else {
            None
        };

        Ok(GroupTextMessage {
            message_id: header.message_id,
            group_id,
            sender_id: header.sender_id,
            date: header.date,
            text,
            media,
            media_name,
            reply_message_id: if header.reply_message_id >= 0 {
                Some(header.reply_message_id)
            } else {
                None
            },
            expires: if header.expires >= 0 {
                Some(header.expires)
            } else {
                None
            },
            edit_date: if header.edit_date >= 0 {
                Some(header.edit_date)
            } else {
                None
            },
        })
    }
}

#[derive(Debug, Clone, PartialEq)]
pub enum UserGroupMessage {
    TextMessage(GroupTextMessage),
}

impl UserGroupMessage {
    pub fn to_bytes(&self) -> Vec<u8> {
        let mut bytes = Vec::new();

        // Write message type (1 byte)
        let message_type = match self {
            UserGroupMessage::TextMessage(_) => 0u8,
        };
        bytes.push(message_type);

        // Write message data
        match self {
            UserGroupMessage::TextMessage(msg) => bytes.extend_from_slice(&msg.to_bytes()),
        }

        bytes
    }

    pub fn from_bytes(data: &[u8]) -> Result<Self, String> {
        if data.is_empty() {
            return Err("Empty data".to_string());
        }

        let message_type = data[0];
        let message_data = &data[1..];

        match message_type {
            0 => Ok(UserGroupMessage::TextMessage(GroupTextMessage::from_bytes(
                message_data,
            )?)),
            _ => Err(format!("Unknown message type: {}", message_type)),
        }
    }
}
