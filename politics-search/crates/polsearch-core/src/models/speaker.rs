//! Speaker model

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Speaker {
    pub id: Uuid,
    pub merged_into_id: Option<Uuid>,
    pub name: Option<String>,
    pub slug: Option<String>,
    pub total_appearances: i32,
    pub is_verified: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Speaker {
    /// Creates a new unidentified speaker
    #[must_use]
    pub fn new_unidentified() -> Self {
        Self {
            id: Uuid::now_v7(),
            merged_into_id: None,
            name: None,
            slug: None,
            total_appearances: 0,
            is_verified: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    /// Creates a new identified speaker with a name
    #[must_use]
    pub fn new_identified(name: String, slug: String) -> Self {
        Self {
            id: Uuid::now_v7(),
            merged_into_id: None,
            name: Some(name),
            slug: Some(slug),
            total_appearances: 0,
            is_verified: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    /// Returns true if this speaker has been merged into another
    #[must_use]
    pub const fn is_merged(&self) -> bool {
        self.merged_into_id.is_some()
    }

    /// Returns the canonical speaker ID (follows merge chain)
    #[must_use]
    pub fn canonical_id(&self) -> Uuid {
        self.merged_into_id.unwrap_or(self.id)
    }
}
