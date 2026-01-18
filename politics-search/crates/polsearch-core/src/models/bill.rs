//! Bill model - congressional legislation reference

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// A congressional bill referenced by votes
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Bill {
    pub id: Uuid,
    /// Congress number
    pub congress: i16,
    /// Bill type: hr, s, hjres, sjres, hconres, sconres, hres, sres
    pub bill_type: String,
    /// Bill number
    pub bill_number: i32,
    /// Optional bill title
    pub title: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl Bill {
    /// Creates a new bill reference
    #[must_use]
    pub fn new(congress: i16, bill_type: String, bill_number: i32, title: Option<String>) -> Self {
        Self {
            id: Uuid::now_v7(),
            congress,
            bill_type,
            bill_number,
            title,
            created_at: Utc::now(),
        }
    }

    /// Returns the standard bill identifier (e.g., "H.R. 1234" or "S. 567")
    #[must_use]
    pub fn bill_identifier(&self) -> String {
        match self.bill_type.as_str() {
            "hr" => format!("H.R. {}", self.bill_number),
            "s" => format!("S. {}", self.bill_number),
            "hjres" => format!("H.J.Res. {}", self.bill_number),
            "sjres" => format!("S.J.Res. {}", self.bill_number),
            "hconres" => format!("H.Con.Res. {}", self.bill_number),
            "sconres" => format!("S.Con.Res. {}", self.bill_number),
            "hres" => format!("H.Res. {}", self.bill_number),
            "sres" => format!("S.Res. {}", self.bill_number),
            other => format!("{} {}", other.to_uppercase(), self.bill_number),
        }
    }
}
