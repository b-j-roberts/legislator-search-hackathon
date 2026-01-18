//! Amendment model - congressional amendment reference

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// A congressional amendment referenced by votes
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Amendment {
    pub id: Uuid,
    /// Congress number
    pub congress: i16,
    /// Chamber: "House" or "Senate"
    pub chamber: String,
    /// Amendment number
    pub amendment_number: i32,
    /// Purpose/description of the amendment
    pub purpose: Option<String>,
    /// Optional reference to the bill being amended
    pub bill_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

impl Amendment {
    /// Creates a new amendment reference
    #[must_use]
    pub fn new(
        congress: i16,
        chamber: String,
        amendment_number: i32,
        purpose: Option<String>,
        bill_id: Option<Uuid>,
    ) -> Self {
        Self {
            id: Uuid::now_v7(),
            congress,
            chamber,
            amendment_number,
            purpose,
            bill_id,
            created_at: Utc::now(),
        }
    }

    /// Returns the standard amendment identifier (e.g., "H.Amdt. 123" or "S.Amdt. 456")
    #[must_use]
    pub fn amendment_identifier(&self) -> String {
        match self.chamber.as_str() {
            "House" => format!("H.Amdt. {}", self.amendment_number),
            "Senate" => format!("S.Amdt. {}", self.amendment_number),
            _ => format!("Amdt. {}", self.amendment_number),
        }
    }
}
