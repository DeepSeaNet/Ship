use crate::api::account::{AccountError, AccountResult, types::UserId};
use dirs;
use mls_rs_codec::MlsEncode;
use sqlx::{Row, SqlitePool, sqlite::SqliteConnectOptions};
use std::{path::PathBuf, str::FromStr};

use crate::api::account::Account;

pub struct AccountManager {
    pool: SqlitePool,
}

impl AccountManager {
    pub async fn new(db_path: PathBuf) -> AccountResult<Self> {
        let db_url = format!("sqlite:{}", db_path.display());
        let options = SqliteConnectOptions::from_str(&db_url)?.create_if_missing(true);

        let pool = SqlitePool::connect_with(options).await?;

        // Create the accounts table with new MLS fields
        sqlx::query(
            "CREATE TABLE IF NOT EXISTS accounts (
                user_id BLOB PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                server_address TEXT NOT NULL,
                server_public_key BLOB,
                avatar_url TEXT,
                mls_credential BLOB NOT NULL,
                mls_signer BLOB NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
        )
        .execute(&pool)
        .await?;

        // Create indexes for performance
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_username ON accounts(username)")
            .execute(&pool)
            .await?;

        Ok(AccountManager { pool })
    }

    pub async fn save_account(&self, account: &Account) -> AccountResult<()> {
        println!("saving account: {}", account.username);

        let mls_credential_bytes = account
            .credential
            .mls_encode_to_vec()
            .map_err(AccountError::Codec)?;
        let mls_signer_bytes = account.signer.as_bytes().to_vec();

        sqlx::query(
            "INSERT OR REPLACE INTO accounts 
             (user_id, username, server_address, server_public_key, avatar_url, mls_credential, mls_signer, created_at, updated_at) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)"
        )
        .bind(account.user_id.to_bytes())
        .bind(&account.username)
        .bind(&account.server_address)
        .bind(&account.server_public_key)
        .bind(&account.avatar_url)
        .bind(&mls_credential_bytes)
        .bind(&mls_signer_bytes)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn get_account_by_username(&self, username: &str) -> AccountResult<Option<Account>> {
        use crate::api::device::types::custom_mls::credentials::AccountCredential;
        use mls_rs_codec::MlsDecode;
        use mls_rs_core::crypto::SignatureSecretKey;

        let result = sqlx::query(
            "SELECT user_id, username, server_address, server_public_key, avatar_url, mls_credential, mls_signer
             FROM accounts WHERE username = ?"
        )
        .bind(username)
        .fetch_optional(&self.pool)
        .await?;

        match result {
            Some(row) => {
                let mls_credential_bytes: Vec<u8> = row.get("mls_credential");
                let mls_signer_bytes: Vec<u8> = row.get("mls_signer");

                let credential = AccountCredential::mls_decode(&mut &*mls_credential_bytes)
                    .map_err(AccountError::Codec)?;

                let signer = SignatureSecretKey::new(mls_signer_bytes);
                let user_id = UserId::from_bytes(row.get("user_id"));
                Ok(Some(Account {
                    user_id,
                    username: row.get("username"),
                    server_address: row.get("server_address"),
                    server_public_key: row.get("server_public_key"),
                    avatar_url: row.get("avatar_url"),
                    credential,
                    signer,
                }))
            }
            None => Ok(None),
        }
    }

    pub async fn update_avatar_url(
        &self,
        username: &str,
        avatar_url: Option<String>,
    ) -> AccountResult<()> {
        sqlx::query(
            "UPDATE accounts SET avatar_url = ?, updated_at = CURRENT_TIMESTAMP WHERE username = ?",
        )
        .bind(avatar_url)
        .bind(username)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    pub async fn delete_account(&self, username: &str) -> AccountResult<()> {
        sqlx::query("DELETE FROM accounts WHERE username = ?")
            .bind(username)
            .execute(&self.pool)
            .await?;

        Ok(())
    }

    pub async fn list_accounts(&self) -> AccountResult<Vec<Account>> {
        use crate::api::device::types::custom_mls::credentials::AccountCredential;
        use mls_rs_codec::MlsDecode;
        use mls_rs_core::crypto::SignatureSecretKey;

        let rows = sqlx::query(
            "SELECT user_id, username, server_address, server_public_key, avatar_url, mls_credential, mls_signer
             FROM accounts ORDER BY username"
        )
        .fetch_all(&self.pool)
        .await?;

        let mut accounts = Vec::new();
        for row in rows {
            let mls_credential_bytes: Vec<u8> = row.get("mls_credential");
            let mls_signer_bytes: Vec<u8> = row.get("mls_signer");

            let credential = AccountCredential::mls_decode(&mut &*mls_credential_bytes)
                .map_err(AccountError::Codec)?;

            let signer = SignatureSecretKey::new(mls_signer_bytes);
            let user_id = UserId::from_bytes(row.get("user_id"));
            accounts.push(Account {
                user_id,
                username: row.get("username"),
                server_address: row.get("server_address"),
                server_public_key: row.get("server_public_key"),
                avatar_url: row.get("avatar_url"),
                credential,
                signer,
            });
        }

        Ok(accounts)
    }
}

// Utility function to get default database path
pub fn get_default_db_path() -> std::path::PathBuf {
    #[cfg(not(target_os = "ios"))]
    {
        let mut path = dirs::home_dir().expect("Could not find home directory");
        path.push(".ship");
        std::fs::create_dir_all(&path).expect("Could not create .ship directory");
        path.push("accounts.db");
        path
    }
    #[cfg(target_os = "ios")]
    {
        let mut path = dirs::document_dir().expect("Could not find home directory");
        path.push("ship");
        std::fs::create_dir_all(&path).expect("Could not create .ship directory");
        path.push("accounts.db");
        path
    }
}
