use crate::api::status::types::DisplayUserInfo;
use sqlx::{Row, SqlitePool, sqlite::SqliteConnectOptions};
use std::path::PathBuf;
use std::str::FromStr;

pub struct UserManager {
    pool: SqlitePool,
}

impl UserManager {
    pub async fn new(db_path: PathBuf) -> anyhow::Result<Self> {
        let db_url = format!("sqlite:{}", db_path.to_str().unwrap());
        let options = SqliteConnectOptions::from_str(&db_url)?.create_if_missing(true);

        let pool = SqlitePool::connect_with(options).await?;

        sqlx::query(
            "CREATE TABLE IF NOT EXISTS contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                username TEXT NOT NULL,
                avatar TEXT NOT NULL,
                trust_level INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
            )",
        )
        .execute(&pool)
        .await?;

        Ok(Self { pool })
    }

    pub async fn save_contact(&self, contact: DisplayUserInfo) -> anyhow::Result<()> {
        // Проверяем, существует ли уже контакт
        let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM contacts WHERE user_id = ?")
            .bind(contact.user_id)
            .fetch_one(&self.pool)
            .await?;

        if count > 0 {
            return Ok(());
        }

        // Добавляем новый контакт
        sqlx::query(
            "INSERT INTO contacts (user_id, username, avatar, trust_level, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(contact.user_id)
        .bind(&contact.username)
        .bind(&contact.avatar)
        .bind(contact.trust_level)
        .bind(contact.created_at)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_contacts(&self) -> anyhow::Result<Vec<DisplayUserInfo>> {
        let rows =
            sqlx::query("SELECT user_id, username, avatar, trust_level, created_at FROM contacts")
                .fetch_all(&self.pool)
                .await?;

        let mut contacts = Vec::new();
        for row in rows {
            contacts.push(DisplayUserInfo {
                user_id: row.get("user_id"),
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
}

pub fn get_default_db_path(account_id: u64) -> std::path::PathBuf {
    #[cfg(not(target_os = "ios"))]
    {
        let mut path = dirs::home_dir().expect("Could not find home directory");
        path.push(".anongram");
        std::fs::create_dir_all(&path).expect("Could not create .anongram directory");
        path.push(format!("contacts_{}.db", account_id));
        path
    }
    #[cfg(target_os = "ios")]
    {
        let mut path = dirs::document_dir().expect("Could not find home directory");
        path.push(".anongram");
        std::fs::create_dir_all(&path).expect("Could not create .anongram directory");
        path.push(format!("contacts_{}.db", account_id));
        path
    }
}
