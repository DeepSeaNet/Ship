use crate::api::device::types::errors::GroupError;
use crate::api::device::types::group::GroupId;
use crate::api::device::types::message::{GroupTextMessage, UserGroupMessage};
use dirs;

use moka::future::{Cache, CacheBuilder};
use sha2::Digest;
use sqlx::{ConnectOptions, Row, SqlitePool, sqlite::SqliteConnectOptions};
use std::path::PathBuf;
use std::str::FromStr;
use std::time::{Duration, Instant};

type Result<T> = std::result::Result<T, GroupError>;

#[derive(Clone)]
pub struct GroupManager {
    pool: SqlitePool,
    contacts_cache: Cache<i64, Option<Vec<u8>>>,
    media_exists_cache: Cache<String, bool>,
    media_data_cache: Cache<String, Option<(Vec<u8>, String, i64)>>,
    group_messages_cache: Cache<Vec<u8>, Vec<UserGroupMessage>>,
    last_message_cache: Cache<Vec<u8>, Option<GroupTextMessage>>,
}

// Make metrics accessible as a global static
use std::sync::atomic::{AtomicU64, Ordering};

pub struct GlobalMetrics {
    pub get_messages_ns: AtomicU64,
    pub save_message_ns: AtomicU64,
    pub find_media_ns: AtomicU64,
    pub get_media_ns: AtomicU64,
    pub call_counts: AtomicU64,
}

impl Default for GlobalMetrics {
    fn default() -> Self {
        Self {
            get_messages_ns: AtomicU64::new(0),
            save_message_ns: AtomicU64::new(0),
            find_media_ns: AtomicU64::new(0),
            get_media_ns: AtomicU64::new(0),
            call_counts: AtomicU64::new(0),
        }
    }
}

lazy_static::lazy_static! {
    pub static ref GROUP_METRICS: GlobalMetrics = GlobalMetrics::default();
}

// Helper function to log timing
fn log_operation_time(operation: &str, duration: Duration) {
    log::info!("Operation '{}' took {:?}", operation, duration);
}

impl GroupManager {
    pub async fn new(db_path: PathBuf) -> Result<Self> {
        // Create database connection options
        let connection_options =
            SqliteConnectOptions::from_str(&format!("sqlite:{}", db_path.display()))?
                .create_if_missing(true)
                .disable_statement_logging();

        // Create connection pool
        let pool = SqlitePool::connect_with(connection_options).await?;

        // Initialize database schema
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS group_messages (
                message_id INTEGER PRIMARY KEY,
                group_id BLOB NOT NULL,
                sender_id INTEGER NOT NULL,
                encrypted_content BLOB NOT NULL,
                media_id TEXT,
                media_name TEXT,
                timestamp INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                reply_message_id INTEGER,
                expires INTEGER,
                edit_date INTEGER
            )",
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS pending_invitations (
                id INTEGER PRIMARY KEY,
                user_id INTEGER NOT NULL,
                group_id BLOB NOT NULL,
                welcome_data BLOB NOT NULL,
                invite_time INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                UNIQUE(user_id, group_id)
            )",
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS group_media (
                media_id TEXT PRIMARY KEY,
                media_data BLOB NOT NULL,
                media_name TEXT,
                media_size INTEGER NOT NULL,
                message_id INTEGER,
                group_id BLOB NOT NULL,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                FOREIGN KEY(message_id) REFERENCES group_messages(message_id)
            )",
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY,
                device_id STRING NOT NULL,
                device_bytes BLOB NOT NULL,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
            )",
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS contacts (
                user_id INTEGER PRIMARY KEY,
                user_credential BLOB NOT NULL,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
            )",
        )
        .execute(&pool)
        .await?;

        // Create indexes
        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_group_messages_group_id 
             ON group_messages(group_id)",
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_group_messages_sender 
             ON group_messages(sender_id)",
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_group_messages_timestamp 
             ON group_messages(timestamp)",
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            "CREATE INDEX IF NOT EXISTS idx_group_media_group_id 
             ON group_media(group_id)",
        )
        .execute(&pool)
        .await?;

        // Build caches
        let contacts_cache = CacheBuilder::new(10_000)
            .time_to_live(Duration::from_secs(60 * 30))
            .build();
        let media_exists_cache = CacheBuilder::new(50_000)
            .time_to_live(Duration::from_secs(60 * 30))
            .build();
        let media_data_cache = CacheBuilder::new(2_000)
            .time_to_live(Duration::from_secs(60 * 10))
            .build();
        let group_messages_cache = CacheBuilder::new(1_000)
            .time_to_live(Duration::from_secs(60))
            .build();
        let last_message_cache = CacheBuilder::new(2_000)
            .time_to_live(Duration::from_secs(60))
            .build();

        Ok(GroupManager {
            pool,
            contacts_cache,
            media_exists_cache,
            media_data_cache,
            group_messages_cache,
            last_message_cache,
        })
    }

    // Save user to database
    pub async fn save_user(
        &self,
        user_id: i64,
        device_id: &str,
        device_bytes: &[u8],
    ) -> Result<()> {
        sqlx::query(
            "INSERT OR REPLACE INTO users (
                user_id, device_id, device_bytes, updated_at
            ) VALUES (?1, ?2, ?3, strftime('%s', 'now'))",
        )
        .bind(user_id)
        .bind(device_id)
        .bind(device_bytes)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn load_user(&self, user_id: i64) -> Result<(String, Vec<u8>)> {
        // Load user from database
        let row = sqlx::query("SELECT device_id, device_bytes FROM users WHERE user_id = ?1")
            .bind(user_id)
            .fetch_optional(&self.pool)
            .await?;

        match row {
            Some(row) => {
                let device_id: String = row.get("device_id");
                let device_bytes: Vec<u8> = row.get("device_bytes");

                Ok((device_id, device_bytes))
            }
            None => Err(GroupError::DatabaseError(
                "User not found in database".to_string(),
            )),
        }
    }

    pub async fn save_contact(&self, user_id: i64, user_credential: &[u8]) -> Result<()> {
        sqlx::query(
            "INSERT INTO contacts (
                user_id, user_credential
            ) VALUES (?1, ?2)",
        )
        .bind(user_id)
        .bind(user_credential)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_contact(&self, user_id: i64) -> Result<Option<Vec<u8>>> {
        let result = self
            .contacts_cache
            .get_with(user_id, async move {
                let row = sqlx::query("SELECT user_credential FROM contacts WHERE user_id = ?")
                    .bind(user_id)
                    .fetch_optional(&self.pool)
                    .await
                    .ok()?;
                row.map(|r| r.get::<Vec<u8>, _>("user_credential"))
            })
            .await;
        Ok(result.as_ref().cloned())
    }

    // Find existing media with timing metrics
    pub async fn find_existing_media(&self, media_data: &[u8]) -> Result<Option<String>> {
        let start = Instant::now();

        // First create hash of media data to compare
        let mut hasher = sha2::Sha256::new();
        hasher.update(media_data);
        let hash = hasher.finalize();
        let media_id = format!("{:x}", hash);

        // Check existence cache first
        if let Some(exists) = self.media_exists_cache.get(&media_id).await {
            let duration = start.elapsed();
            log_operation_time("Find existing media (cache)", duration);
            GROUP_METRICS
                .find_media_ns
                .fetch_add(duration.as_nanos() as u64, Ordering::Relaxed);
            return Ok(if exists { Some(media_id) } else { None });
        }

        let row = sqlx::query("SELECT media_id FROM group_media WHERE media_id = ?")
            .bind(&media_id)
            .fetch_optional(&self.pool)
            .await?;

        let result = row.map(|r| r.get::<String, _>("media_id"));
        // Populate existence cache
        self.media_exists_cache
            .insert(media_id.clone(), result.is_some())
            .await;

        let duration = start.elapsed();
        log_operation_time("Find existing media", duration);
        GROUP_METRICS
            .find_media_ns
            .fetch_add(duration.as_nanos() as u64, Ordering::Relaxed);

        Ok(result)
    }

    // Save a message with timing metrics
    pub async fn save_message(&self, message: &UserGroupMessage, group_id: &[u8]) -> Result<()> {
        let start = Instant::now();
        match message {
            UserGroupMessage::TextMessage(message) => {
                let mut media_id = None;
                let mut is_media_found = false;

                // Check for existing media before starting transaction
                if let Some(media_data) = &message.media
                    && let Ok(Some(existing_media_id)) = self.find_existing_media(media_data).await
                {
                    media_id = Some(existing_media_id);
                    is_media_found = true;
                }

                // Generate media ID if needed
                if let Some(media_data) = &message.media
                    && media_id.is_none()
                {
                    // Generate new media ID using SHA-256 hash
                    let mut hasher = sha2::Sha256::new();
                    hasher.update(media_data);
                    let hash = hasher.finalize();
                    media_id = Some(format!("{:x}", hash));
                }

                // Start transaction
                let mut tx = self.pool.begin().await?;

                // Handle edit case first
                if let Some(edit_date) = message.edit_date {
                    self.redact_message(message.message_id, group_id, message, edit_date)
                        .await?;

                    tx.commit().await?;

                    let duration = start.elapsed();
                    log_operation_time("Save message", duration);
                    GROUP_METRICS
                        .save_message_ns
                        .fetch_add(duration.as_nanos() as u64, Ordering::Relaxed);
                    GROUP_METRICS.call_counts.fetch_add(1, Ordering::Relaxed);

                    return Ok(());
                }

                // Save message first to satisfy the foreign key constraint
                sqlx::query(
                    "INSERT INTO group_messages (
                        message_id, group_id, sender_id, 
                        encrypted_content, media_id, media_name, timestamp, edit_date, expires, reply_message_id
                    ) 
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)"
                )
                .bind(message.message_id)
                .bind(group_id)
                .bind(message.sender_id)
                .bind(message.text.as_bytes())
                .bind(&media_id)
                .bind(&message.media_name)
                .bind(message.date)
                .bind(message.edit_date)
                .bind(message.expires)
                .bind(message.reply_message_id)
                .execute(&mut *tx)
                .await?;

                // Now save the media if it's new
                if let Some(media_data) = &message.media
                    && let Some(media_id_str) = &media_id
                {
                    // Only insert if it's not an existing media that we found earlier
                    if !is_media_found {
                        sqlx::query(
                            "INSERT INTO group_media (
                                    media_id, media_data, media_name, media_size, 
                                    message_id, group_id, created_at
                                ) 
                                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                        )
                        .bind(media_id_str)
                        .bind(media_data)
                        .bind(&message.media_name)
                        .bind(media_data.len() as i64)
                        .bind(message.message_id)
                        .bind(group_id)
                        .bind(message.date)
                        .execute(&mut *tx)
                        .await?;
                    }
                }

                // Commit transaction
                tx.commit().await?;

                let duration = start.elapsed();
                log_operation_time("Save message", duration);
                GROUP_METRICS
                    .save_message_ns
                    .fetch_add(duration.as_nanos() as u64, Ordering::Relaxed);
                GROUP_METRICS.call_counts.fetch_add(1, Ordering::Relaxed);
            }
        }
        Ok(())
    }

    // Get messages for a group with timing metrics
    pub async fn get_group_messages(&self, group_id: &[u8]) -> Result<Vec<UserGroupMessage>> {
        let cache_key = group_id.to_vec();
        let result = self
            .group_messages_cache
            .get_with(cache_key.clone(), async move {
                let start = Instant::now();

                let rows = sqlx::query(
                    "SELECT 
                        m.message_id,
                        m.sender_id,
                        m.encrypted_content,
                        m.timestamp,
                        m.media_name,
                        m.media_id,
                        m.reply_message_id,
                        m.edit_date,
                        m.expires
                     FROM group_messages m
                     WHERE m.group_id = ?
                     ORDER BY m.timestamp ASC",
                )
                .bind(&cache_key)
                .fetch_all(&self.pool)
                .await
                .unwrap_or_default();

                let max_inline_size = 1024 * 1024;
                let mut result_messages = Vec::with_capacity(rows.len());

                for row in rows {
                    let message_id: i64 = row.get("message_id");
                    let sender_id: i64 = row.get("sender_id");
                    let encrypted_content: Vec<u8> = row.get("encrypted_content");
                    let timestamp: i64 = row.get("timestamp");
                    let media_name: Option<String> = row.get("media_name");
                    let media_id: Option<String> = row.get("media_id");
                    let reply_message_id: Option<i64> = row.get("reply_message_id");
                    let edit_date: Option<i64> = row.get("edit_date");
                    let expires: Option<i64> = row.get("expires");

                    let text = String::from_utf8_lossy(&encrypted_content).to_string();

                    let media_data = if let Some(media_id_str) = &media_id {
                        self.fetch_media_data(media_id_str, &media_name, max_inline_size)
                            .await
                    } else {
                        None
                    };
                    let group_id = GroupId::new(cache_key.clone());
                    let group_text_message = GroupTextMessage {
                        message_id,
                        group_id: group_id.to_string(),
                        sender_id,
                        date: timestamp,
                        text,
                        media: media_data,
                        media_name,
                        reply_message_id,
                        expires,
                        edit_date,
                    };

                    result_messages.push(UserGroupMessage::TextMessage(group_text_message));
                }

                let duration = start.elapsed();
                log_operation_time("Get group messages", duration);
                GROUP_METRICS
                    .get_messages_ns
                    .fetch_add(duration.as_nanos() as u64, Ordering::Relaxed);
                GROUP_METRICS.call_counts.fetch_add(1, Ordering::Relaxed);

                result_messages
            })
            .await;
        Ok(result)
    }

    // Helper method to fetch media data
    async fn fetch_media_data(
        &self,
        media_id: &str,
        media_name: &Option<String>,
        max_size: i64,
    ) -> Option<Vec<u8>> {
        // Сначала получаем размер файла
        let media_size =
            match sqlx::query("SELECT LENGTH(media_data) FROM group_media WHERE media_id = ?")
                .bind(media_id)
                .fetch_optional(&self.pool)
                .await
            {
                Ok(Some(row)) => row.get::<i64, _>(0),
                _ => return None,
            };

        // Проверяем, является ли файл отображаемым изображением
        let is_displayable_media = match media_name {
            Some(name) => {
                let lower_name = name.to_lowercase();
                lower_name.ends_with(".jpg")
                    || lower_name.ends_with(".jpeg")
                    || lower_name.ends_with(".png")
                    || lower_name.ends_with(".gif")
                    || lower_name.ends_with(".webp")
                    || lower_name.ends_with(".svg")
            }
            None => false,
        };

        // Загружаем данные только если это небольшое изображение
        if media_size <= max_size && is_displayable_media {
            match sqlx::query("SELECT media_data FROM group_media WHERE media_id = ?")
                .bind(media_id)
                .fetch_optional(&self.pool)
                .await
            {
                Ok(Some(row)) => Some(row.get::<Vec<u8>, _>("media_data")),
                _ => None,
            }
        } else {
            None
        }
    }

    // Get media by ID with timing metrics
    pub async fn get_media_data(&self, media_id: &str) -> Result<Option<(Vec<u8>, String, i64)>> {
        let key = media_id.to_string();
        let result = self
            .media_data_cache
            .get_with(key.clone(), async move {
                let start = Instant::now();
                let row = sqlx::query(
                    "SELECT media_data, media_name, LENGTH(media_data) as size 
                     FROM group_media 
                     WHERE media_id = ?",
                )
                .bind(&key)
                .fetch_optional(&self.pool)
                .await
                .ok()?;

                let result = row.map(|r| {
                    (
                        r.get::<Vec<u8>, _>("media_data"),
                        r.get::<String, _>("media_name"),
                        r.get::<i64, _>("size"),
                    )
                });

                let duration = start.elapsed();
                log_operation_time("Get media data", duration);
                GROUP_METRICS
                    .get_media_ns
                    .fetch_add(duration.as_nanos() as u64, Ordering::Relaxed);

                result
            })
            .await;
        Ok(result.as_ref().cloned())
    }

    // Delete a message
    pub async fn delete_message(&self, message_id: i64, group_id: &[u8]) -> Result<()> {
        sqlx::query("DELETE FROM group_messages WHERE message_id = ?1 AND group_id = ?2")
            .bind(message_id)
            .bind(group_id)
            .execute(&self.pool)
            .await?;

        // Invalidate caches related to this group
        self.group_messages_cache
            .invalidate(&group_id.to_vec())
            .await;
        self.last_message_cache.invalidate(&group_id.to_vec()).await;

        Ok(())
    }

    pub async fn get_last_message(&self, group_id: &GroupId) -> Result<Option<GroupTextMessage>> {
        let key = group_id.to_vec();
        let result = self
            .last_message_cache
            .get_with(key.clone(), async move {
                let row = sqlx::query(
                    "SELECT * FROM group_messages WHERE group_id = ? ORDER BY timestamp DESC LIMIT 1",
                )
                .bind(&key)
                .fetch_optional(&self.pool)
                .await
                .ok()?;
                let row = row?;

                let message_id: i64 = row.get("message_id");
                let sender_id: i64 = row.get("sender_id");
                let encrypted_content: Vec<u8> = row.get("encrypted_content");
                let timestamp: i64 = row.get("timestamp");
                let media_name: Option<String> = row.get("media_name");
                let reply_message_id: Option<i64> = row.get("reply_message_id");
                let edit_date: Option<i64> = row.get("edit_date");
                let expires: Option<i64> = row.get("expires");

                let text = String::from_utf8_lossy(&encrypted_content).to_string();

                Some(GroupTextMessage {
                    message_id,
                    group_id: GroupId::new(key.clone()).to_string(),
                    sender_id,
                    date: timestamp,
                    text,
                    media: None,
                    media_name,
                    reply_message_id,
                    expires,
                    edit_date,
                })
            })
            .await;
        Ok(result.as_ref().cloned())
    }

    // Redact a message (edit to replace content)
    pub async fn redact_message(
        &self,
        message_id: i64,
        group_id: &[u8],
        new_message: &GroupTextMessage,
        edit_date: i64,
    ) -> Result<()> {
        sqlx::query(
            "UPDATE group_messages 
             SET encrypted_content = ?1, 
                 edit_date = ?2 
             WHERE message_id = ?3 AND group_id = ?4",
        )
        .bind(new_message.text.as_bytes())
        .bind(edit_date)
        .bind(message_id)
        .bind(group_id)
        .execute(&self.pool)
        .await?;

        // Invalidate caches for this group
        self.group_messages_cache
            .invalidate(&group_id.to_vec())
            .await;
        self.last_message_cache.invalidate(&group_id.to_vec()).await;

        Ok(())
    }

    // Get all media for a group
    pub async fn get_group_media(&self, group_id: &[u8]) -> Result<Vec<(String, String, i64)>> {
        let rows = sqlx::query(
            "SELECT media_id, media_name, LENGTH(media_data) as size
             FROM group_media
             WHERE group_id = ?
             ORDER BY created_at DESC",
        )
        .bind(group_id)
        .fetch_all(&self.pool)
        .await?;

        let results = rows
            .into_iter()
            .map(|row| {
                (
                    row.get::<String, _>("media_id"),
                    row.get::<String, _>("media_name"),
                    row.get::<i64, _>("size"),
                )
            })
            .collect();

        Ok(results)
    }

    // Get all groups for a user
    #[allow(dead_code)]
    pub async fn get_user_groups(&self, user_id: i64) -> Result<Vec<Vec<u8>>> {
        let rows = sqlx::query(
            "SELECT DISTINCT group_id
             FROM group_messages
             WHERE sender_id = ? OR receiver_id = ?
             ORDER BY MAX(timestamp) DESC",
        )
        .bind(user_id)
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        let results = rows
            .into_iter()
            .map(|row| row.get::<Vec<u8>, _>("group_id"))
            .collect();

        Ok(results)
    }

    // Clear media cache
    pub async fn clear_media_cache(&self) -> Result<()> {
        let mut tx = self.pool.begin().await?;

        // Delete all media data but keep message references
        sqlx::query("DELETE FROM group_media")
            .execute(&mut *tx)
            .await?;

        // Reset media_id references in messages
        sqlx::query("UPDATE group_messages SET media_id = NULL")
            .execute(&mut *tx)
            .await?;

        tx.commit().await?;

        // Invalidate media caches
        self.media_data_cache.invalidate_all();
        self.media_exists_cache.invalidate_all();

        Ok(())
    }

    // Get media cache size
    pub async fn get_media_cache_size(&self) -> Result<i64> {
        let row = sqlx::query("SELECT COALESCE(SUM(LENGTH(media_data)), 0) FROM group_media")
            .fetch_one(&self.pool)
            .await?;

        Ok(row.get(0))
    }
}

// Utility function to get default database path
pub fn get_default_db_path(account_id: u64) -> std::path::PathBuf {
    #[cfg(not(target_os = "ios"))]
    {
        let mut path = dirs::home_dir().expect("Could not find home directory");
        path.push(".anongram");
        std::fs::create_dir_all(&path).expect("Could not create .anongram directory");
        path.push(format!("group_{}.db", account_id));
        path
    }
    #[cfg(target_os = "ios")]
    {
        let mut path = dirs::document_dir().expect("Could not find home directory");
        path.push(".anongram");
        std::fs::create_dir_all(&path).expect("Could not create .anongram directory");
        path.push(format!("group_{}.db", account_id));
        path
    }
}
