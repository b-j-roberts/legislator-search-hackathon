//! Individual vote model - a legislator's position on a roll call vote

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// An individual legislator's vote on a roll call
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct IndividualVote {
    pub id: Uuid,
    /// Reference to the roll call vote
    pub roll_call_vote_id: Uuid,
    /// Reference to the legislator
    pub legislator_id: Uuid,
    /// Normalized position: "yea", "nay", "present", `"not_voting"`
    pub position: String,
    /// Original position as recorded (e.g., "Aye", "No", "Yea", "Nay")
    pub raw_position: Option<String>,
    /// Party at time of vote (may differ from current party)
    pub party_at_vote: String,
    /// State at time of vote
    pub state_at_vote: String,
    pub created_at: DateTime<Utc>,
}

impl IndividualVote {
    /// Creates a new individual vote
    #[must_use]
    pub fn new(
        roll_call_vote_id: Uuid,
        legislator_id: Uuid,
        position: String,
        raw_position: Option<String>,
        party_at_vote: String,
        state_at_vote: String,
    ) -> Self {
        Self {
            id: Uuid::now_v7(),
            roll_call_vote_id,
            legislator_id,
            position,
            raw_position,
            party_at_vote,
            state_at_vote,
            created_at: Utc::now(),
        }
    }

    /// Normalizes House vote positions (Aye/No) to standard format (yea/nay)
    #[must_use]
    pub fn normalize_house_position(raw: &str) -> String {
        match raw.to_lowercase().as_str() {
            "aye" | "yea" => "yea".to_string(),
            "no" | "nay" => "nay".to_string(),
            "present" => "present".to_string(),
            "not voting" => "not_voting".to_string(),
            other => other.to_lowercase().replace(' ', "_"),
        }
    }

    /// Normalizes Senate vote positions (Yea/Nay) to standard format
    #[must_use]
    pub fn normalize_senate_position(raw: &str) -> String {
        match raw.to_lowercase().as_str() {
            "yea" => "yea".to_string(),
            "nay" => "nay".to_string(),
            "present" => "present".to_string(),
            "not voting" => "not_voting".to_string(),
            other => other.to_lowercase().replace(' ', "_"),
        }
    }

    /// Returns true if this is an affirmative vote
    #[must_use]
    pub fn is_yea(&self) -> bool {
        self.position == "yea"
    }

    /// Returns true if this is a negative vote
    #[must_use]
    pub fn is_nay(&self) -> bool {
        self.position == "nay"
    }

    /// Returns true if the legislator was present but didn't vote for/against
    #[must_use]
    pub fn is_present(&self) -> bool {
        self.position == "present"
    }

    /// Returns true if the legislator did not vote
    #[must_use]
    pub fn is_not_voting(&self) -> bool {
        self.position == "not_voting"
    }
}
