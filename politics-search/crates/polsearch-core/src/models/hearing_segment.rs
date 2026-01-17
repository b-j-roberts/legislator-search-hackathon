//! Hearing segment model - chunks for embedding

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Minimal segment metadata stored in Postgres
/// Actual text and embeddings are stored in `LanceDB`
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct HearingSegment {
    pub id: Uuid,
    /// Reference to parent hearing
    pub hearing_id: Uuid,
    /// Reference to source statement
    pub statement_id: Uuid,
    /// Global position across all segments in hearing
    pub segment_index: i32,
    /// Position within the statement (for multi-chunk statements)
    pub chunk_index: i32,
    pub created_at: DateTime<Utc>,
}

impl HearingSegment {
    /// Creates a new hearing segment
    #[must_use]
    pub fn new(
        hearing_id: Uuid,
        statement_id: Uuid,
        segment_index: i32,
        chunk_index: i32,
    ) -> Self {
        Self {
            id: Uuid::now_v7(),
            hearing_id,
            statement_id,
            segment_index,
            chunk_index,
            created_at: Utc::now(),
        }
    }
}
