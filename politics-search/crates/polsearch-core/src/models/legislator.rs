//! Legislator model - congressional member data

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// A member of Congress with their current and historical identifiers
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Legislator {
    pub id: Uuid,
    /// Bioguide ID - the canonical identifier for all legislators (e.g., "A000370")
    pub bioguide_id: String,
    /// Senate LIS ID (e.g., "S354"), only for senators
    pub lis_id: Option<String>,
    pub first_name: String,
    pub last_name: String,
    pub display_name: String,
    /// Current party affiliation: R, D, I
    pub current_party: String,
    /// Current state (e.g., "CA", "NY")
    pub current_state: String,
    /// Current chamber: "House" or "Senate"
    pub current_chamber: String,
    /// Whether currently serving
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Legislator {
    /// Creates a new legislator from House vote data
    #[must_use]
    pub fn from_house_vote(
        bioguide_id: String,
        display_name: String,
        party: String,
        state: String,
    ) -> Self {
        Self {
            id: Uuid::now_v7(),
            bioguide_id,
            lis_id: None,
            first_name: String::new(),
            last_name: String::new(),
            display_name,
            current_party: party,
            current_state: state,
            current_chamber: "House".to_string(),
            is_active: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    /// Creates a new legislator from Senate vote data
    #[must_use]
    pub fn from_senate_vote(
        bioguide_id: String,
        lis_id: String,
        first_name: String,
        last_name: String,
        display_name: String,
        party: String,
        state: String,
    ) -> Self {
        Self {
            id: Uuid::now_v7(),
            bioguide_id,
            lis_id: Some(lis_id),
            first_name,
            last_name,
            display_name,
            current_party: party,
            current_state: state,
            current_chamber: "Senate".to_string(),
            is_active: true,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    /// Returns full name as "First Last"
    #[must_use]
    pub fn full_name(&self) -> String {
        if self.first_name.is_empty() {
            self.display_name.clone()
        } else {
            format!("{} {}", self.first_name, self.last_name)
        }
    }
}
