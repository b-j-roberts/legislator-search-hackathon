//! Committee model - congressional committees lookup table

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Congressional committee for categorization
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Committee {
    pub id: Uuid,
    /// Full committee name
    pub name: String,
    /// Normalized slug for filtering (unique)
    pub slug: String,
    /// Chamber: "House", "Senate", or None for joint
    pub chamber: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl Committee {
    /// Creates a new committee
    #[must_use]
    pub fn new(name: String, slug: String, chamber: Option<String>) -> Self {
        Self {
            id: Uuid::now_v7(),
            name,
            slug,
            chamber,
            created_at: Utc::now(),
        }
    }

    /// Returns true if this is a joint committee
    #[must_use]
    pub const fn is_joint(&self) -> bool {
        self.chamber.is_none()
    }
}
