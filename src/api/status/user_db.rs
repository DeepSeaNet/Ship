use crate::api::account::UserId;
use crate::api::status::StatusResult;
use crate::api::status::types::DisplayUserInfo;
use sqlx::{Row, SqlitePool, sqlite::SqliteConnectOptions};
use std::path::PathBuf;
use std::str::FromStr;

pub struct UserManager {
    pool: SqlitePool,
}

impl UserManager {
    pub async fn new(db_path: PathBuf) -> StatusResult<Self> {
        let db_url = format!("sqlite:{}", db_path.to_str().unwrap());
        let options = SqliteConnectOptions::from_str(&db_url)?.create_if_missing(true);

        let pool = SqlitePool::connect_with(options).await?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id BLOB NOT NULL UNIQUE,
                username TEXT NOT NULL,
                avatar TEXT NOT NULL,
                trust_level INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
            )",
        )
        .execute(&pool)
        .await?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS sync_metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
        )
        .execute(&pool)
        .await?;

        Ok(Self { pool })
    }

    pub async fn save_contact(&self, contact: DisplayUserInfo) -> StatusResult<()> {
        let rows_affected = sqlx::query(
            "UPDATE contacts SET username = ?, avatar = ?, trust_level = ? WHERE user_id = ?",
        )
        .bind(&contact.username)
        .bind(&contact.avatar)
        .bind(contact.trust_level)
        .bind(&contact.user_id.to_bytes())
        .execute(&self.pool)
        .await?
        .rows_affected();

        if rows_affected == 0 {
            sqlx::query(
                "INSERT INTO contacts (user_id, username, avatar, trust_level, created_at) VALUES (?, ?, ?, ?, ?)",
            )
            .bind(&contact.user_id.to_bytes())
            .bind(&contact.username)
            .bind(&contact.avatar)
            .bind(contact.trust_level)
            .bind(contact.created_at)
            .execute(&self.pool)
            .await?;
        }

        Ok(())
    }

    pub async fn get_contacts(&self) -> StatusResult<Vec<DisplayUserInfo>> {
        let rows =
            sqlx::query("SELECT user_id, username, avatar, trust_level, created_at FROM contacts")
                .fetch_all(&self.pool)
                .await?;

        let mut contacts = Vec::new();
        for row in rows {
            contacts.push(DisplayUserInfo {
                user_id: UserId::from_bytes(row.get("user_id")),
                username: row.get("username"),
                avatar: row.get("avatar"),
                trust_level: row.get("trust_level"),
                created_at: row.get("created_at"),
                last_seen: -1,
                status: "OFFLINE".to_string(),
            });
        }

        Ok(contacts)
    }

    pub async fn get_sync_metadata(&self, key: &str) -> StatusResult<Option<String>> {
        let val: Option<String> =
            sqlx::query_scalar("SELECT value FROM sync_metadata WHERE key = ?")
                .bind(key)
                .fetch_optional(&self.pool)
                .await?;
        Ok(val)
    }

    pub async fn set_sync_metadata(&self, key: &str, value: &str) -> StatusResult<()> {
        sqlx::query("INSERT INTO sync_metadata (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
            .bind(key)
            .bind(value)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}

pub fn get_default_db_path(user_id: &UserId) -> std::path::PathBuf {
    #[cfg(not(target_os = "ios"))]
    {
        let mut path = dirs::home_dir().expect("Could not find home directory");
        path.push(".ship");
        std::fs::create_dir_all(&path).expect("Could not create .ship directory");
        path.push(format!("contacts_{}.db", user_id.to_string()));
        path
    }
    #[cfg(target_os = "ios")]
    {
        let mut path = dirs::document_dir().expect("Could not find home directory");
        path.push(".ship");
        std::fs::create_dir_all(&path).expect("Could not create .ship directory");
        path.push(format!("contacts_{}.db", user_id.to_string()));
        path
    }
}
