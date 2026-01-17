//! Segment model - minimal metadata linking to LanceDB

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Minimal segment metadata stored in Postgres
/// Actual text and embeddings are stored in LanceDB
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Segment {
    pub id: Uuid,
    pub content_id: Uuid,
    pub content_speaker_id: Option<Uuid>,
    pub start_time_ms: Option<i32>,
    pub end_time_ms: Option<i32>,
    pub segment_index: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Segment {
    /// Creates a new segment with timestamps (for audio/video content)
    #[must_use]
    pub fn new_timed(content_id: Uuid, start_time_ms: i32, end_time_ms: i32, segment_index: i32) -> Self {
        Self {
            id: Uuid::now_v7(),
            content_id,
            content_speaker_id: None,
            start_time_ms: Some(start_time_ms),
            end_time_ms: Some(end_time_ms),
            segment_index,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    /// Creates a new segment without timestamps (for documents)
    #[must_use]
    pub fn new_untimed(content_id: Uuid, segment_index: i32) -> Self {
        Self {
            id: Uuid::now_v7(),
            content_id,
            content_speaker_id: None,
            start_time_ms: None,
            end_time_ms: None,
            segment_index,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[must_use]
    pub const fn with_speaker(mut self, content_speaker_id: Uuid) -> Self {
        self.content_speaker_id = Some(content_speaker_id);
        self
    }

    /// Returns the duration of this segment in milliseconds (None for documents)
    #[must_use]
    pub fn duration_ms(&self) -> Option<i32> {
        match (self.start_time_ms, self.end_time_ms) {
            (Some(start), Some(end)) => Some(end - start),
            _ => None,
        }
    }

    /// Returns the duration of this segment in seconds (None for documents)
    #[must_use]
    pub fn duration_seconds(&self) -> Option<f64> {
        self.duration_ms().map(|ms| f64::from(ms) / 1000.0)
    }
}
