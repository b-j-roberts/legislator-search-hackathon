//! Nomination model - presidential nomination reference

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// A presidential nomination referenced by confirmation votes
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Nomination {
    pub id: Uuid,
    /// Congress number
    pub congress: i16,
    /// Nomination number (e.g., "777" from "PN777")
    pub nomination_number: String,
    /// Nominee name
    pub name: String,
    /// Position being nominated for
    pub position: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl Nomination {
    /// Creates a new nomination reference
    #[must_use]
    pub fn new(
        congress: i16,
        nomination_number: String,
        name: String,
        position: Option<String>,
    ) -> Self {
        Self {
            id: Uuid::now_v7(),
            congress,
            nomination_number,
            name,
            position,
            created_at: Utc::now(),
        }
    }

    /// Returns the standard nomination identifier (e.g., "PN777")
    #[must_use]
    pub fn nomination_identifier(&self) -> String {
        format!("PN{}", self.nomination_number)
    }
}
