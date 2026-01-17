//! Speaker alias model for tracking unresolved speaker references

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SpeakerAlias {
    pub id: Uuid,
    pub alias_text: String,
    pub resolved_speaker_id: Option<Uuid>,
    pub confidence: f32,
    pub needs_review: bool,
    pub context: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl SpeakerAlias {
    #[must_use]
    pub fn new(alias_text: String) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::now_v7(),
            alias_text,
            resolved_speaker_id: None,
            confidence: 0.0,
            needs_review: true,
            context: None,
            created_at: now,
            updated_at: now,
        }
    }

    #[must_use]
    pub fn with_context(mut self, context: String) -> Self {
        self.context = Some(context);
        self
    }

    #[must_use]
    pub fn resolved(mut self, speaker_id: Uuid, confidence: f32) -> Self {
        self.resolved_speaker_id = Some(speaker_id);
        self.confidence = confidence;
        self.needs_review = confidence < 0.8;
        self
    }
}
