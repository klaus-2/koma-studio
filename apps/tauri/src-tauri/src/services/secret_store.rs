//! Keychain-backed secret storage. All keychain I/O happens off the async
//! runtime; secrets are held in zeroizing containers.

use zeroize::Zeroizing;

use crate::error::{AppError, AppResult};

const KEYCHAIN_SERVICE: &str = "com.komastudio.desktop";

pub struct SecretString(Zeroizing<String>);

impl SecretString {
    pub fn expose(&self) -> &str {
        self.0.as_str()
    }

    pub fn snapshot(&self) -> Zeroizing<String> {
        Zeroizing::new(self.0.to_string())
    }
}

impl std::fmt::Debug for SecretString {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        formatter.write_str("SecretString([REDACTED])")
    }
}

pub async fn get(account: impl Into<String>) -> AppResult<Option<SecretString>> {
    let account = account.into();

    tokio::task::spawn_blocking(move || {
        let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &account)?;

        match entry.get_password() {
            Ok(secret) => Ok(Some(SecretString(Zeroizing::new(secret)))),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(error) => Err(AppError::from(error)),
        }
    })
    .await?
}

pub async fn set(account: impl Into<String>, secret: impl AsRef<str>) -> AppResult<()> {
    let account = account.into();
    let secret = Zeroizing::new(secret.as_ref().to_string());

    tokio::task::spawn_blocking(move || {
        let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &account)?;
        entry.set_password(secret.as_str())?;
        Ok(())
    })
    .await?
}

pub async fn delete(account: impl Into<String>) -> AppResult<()> {
    let account = account.into();

    tokio::task::spawn_blocking(move || {
        let entry = keyring::Entry::new(KEYCHAIN_SERVICE, &account)?;

        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(error) => Err(AppError::from(error)),
        }
    })
    .await?
}
