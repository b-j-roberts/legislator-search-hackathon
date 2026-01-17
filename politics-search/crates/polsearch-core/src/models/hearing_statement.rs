//! Hearing statement model - individual speaker turns

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Individual speaker statement from a hearing transcript
/// Full text content is stored in `LanceDB`, not in `PostgreSQL`
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct HearingStatement {
    pub id: Uuid,
    /// Reference to parent hearing
    pub hearing_id: Uuid,
    /// Position in the hearing (0-indexed)
    pub statement_index: i32,
    /// Raw speaker label from transcript (e.g., "Chairman CROW", "Ms. Speier")
    pub speaker_label: String,
    /// Resolved speaker ID (after fuzzy matching)
    pub speaker_id: Option<Uuid>,
    /// Word count for filtering
    pub word_count: i32,
    pub created_at: DateTime<Utc>,
}

impl HearingStatement {
    /// Creates a new hearing statement
    #[must_use]
    pub fn new(
        hearing_id: Uuid,
        statement_index: i32,
        speaker_label: String,
        word_count: i32,
    ) -> Self {
        Self {
            id: Uuid::now_v7(),
            hearing_id,
            statement_index,
            speaker_label,
            speaker_id: None,
            word_count,
            created_at: Utc::now(),
        }
    }

    /// Returns true if this statement is too short to be meaningful
    #[must_use]
    pub const fn is_too_short(&self) -> bool {
        self.word_count < 10
    }

    /// Extract the speaker's name from the label (strips titles)
    #[must_use]
    pub fn speaker_name(&self) -> String {
        strip_speaker_prefix(&self.speaker_label)
    }
}

/// Strip common title prefixes from speaker labels
fn strip_speaker_prefix(label: &str) -> String {
    let prefixes = [
        "Chairman ",
        "Chairwoman ",
        "Ranking Member ",
        "Senator ",
        "Representative ",
        "Congressman ",
        "Congresswoman ",
        "Mr. ",
        "Mrs. ",
        "Ms. ",
        "Dr. ",
        "Hon. ",
        "The ",
    ];

    let mut name = label.to_string();
    for prefix in prefixes {
        if let Some(stripped) = name.strip_prefix(prefix) {
            name = stripped.to_string();
        }
    }

    name
}
