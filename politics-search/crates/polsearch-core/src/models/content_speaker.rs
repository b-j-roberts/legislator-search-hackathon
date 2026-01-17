//! Content speaker model (per-content speaker instances)

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ContentSpeaker {
    pub id: Uuid,
    pub content_id: Uuid,
    pub local_speaker_label: String,
    pub speaker_id: Option<Uuid>,
    pub match_confidence: Option<f32>,
    pub speaking_time_seconds: Option<i32>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl ContentSpeaker {
    #[must_use]
    pub fn new(content_id: Uuid, local_speaker_label: String) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::now_v7(),
            content_id,
            local_speaker_label,
            speaker_id: None,
            match_confidence: None,
            speaking_time_seconds: None,
            created_at: now,
            updated_at: now,
        }
    }
}
