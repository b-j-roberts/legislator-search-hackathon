//! Floor speech statement model - individual speaker turns

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Individual speaker statement from a Congressional Record floor speech
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FloorSpeechStatement {
    pub id: Uuid,
    /// Reference to parent floor speech
    pub floor_speech_id: Uuid,
    /// Position in the speech (0-indexed)
    pub statement_index: i32,
    /// Raw speaker label from transcript (e.g., "Mr. MERKLEY", "The PRESIDING OFFICER")
    pub speaker_label: String,
    /// Resolved speaker ID (after fuzzy matching)
    pub speaker_id: Option<Uuid>,
    /// Full statement text
    pub text: String,
    /// Word count for filtering
    pub word_count: i32,
    pub created_at: DateTime<Utc>,
}

impl FloorSpeechStatement {
    /// Creates a new floor speech statement
    #[must_use]
    pub fn new(
        floor_speech_id: Uuid,
        statement_index: i32,
        speaker_label: String,
        text: String,
    ) -> Self {
        let word_count = text.split_whitespace().count() as i32;

        Self {
            id: Uuid::now_v7(),
            floor_speech_id,
            statement_index,
            speaker_label,
            speaker_id: None,
            text,
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

/// Strip common title prefixes from CREC speaker labels
fn strip_speaker_prefix(label: &str) -> String {
    let prefixes = [
        "Mr. ",
        "Mrs. ",
        "Ms. ",
        "The ACTING PRESIDENT pro tempore. ",
        "The PRESIDENT pro tempore. ",
        "The PRESIDING OFFICER. ",
        "The SPEAKER pro tempore. ",
        "The SPEAKER. ",
    ];

    let mut name = label.to_string();
    for prefix in prefixes {
        if let Some(stripped) = name.strip_prefix(prefix) {
            name = stripped.to_string();
            break;
        }
    }

    // also strip trailing period if present
    name.trim_end_matches('.').to_string()
}
