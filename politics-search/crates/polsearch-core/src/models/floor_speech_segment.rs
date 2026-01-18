//! Floor speech segment model - chunks for embedding

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Minimal segment metadata stored in Postgres
/// Actual text and embeddings are stored in `LanceDB`
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FloorSpeechSegment {
    pub id: Uuid,
    /// Reference to parent floor speech
    pub floor_speech_id: Uuid,
    /// Reference to source statement
    pub statement_id: Uuid,
    /// Global position across all segments in speech
    pub segment_index: i32,
    /// Position within the statement (for multi-chunk statements)
    pub chunk_index: i32,
    /// Preview of segment text (first 255 chars)
    pub text_preview: String,
    pub created_at: DateTime<Utc>,
}

impl FloorSpeechSegment {
    /// Creates a new floor speech segment
    #[must_use]
    pub fn new(
        floor_speech_id: Uuid,
        statement_id: Uuid,
        segment_index: i32,
        chunk_index: i32,
        text: &str,
    ) -> Self {
        let text_preview = if text.len() > 255 {
            format!("{}...", &text[..252])
        } else {
            text.to_string()
        };

        Self {
            id: Uuid::now_v7(),
            floor_speech_id,
            statement_id,
            segment_index,
            chunk_index,
            text_preview,
            created_at: Utc::now(),
        }
    }
}
