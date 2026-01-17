//! Content variant model (different formats of the same content)

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VariantType {
    Audio,
    Video,
    Transcript,
    Document,
}

impl std::fmt::Display for VariantType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Audio => write!(f, "audio"),
            Self::Video => write!(f, "video"),
            Self::Transcript => write!(f, "transcript"),
            Self::Document => write!(f, "document"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ContentVariant {
    pub id: Uuid,
    pub content_id: Uuid,
    pub variant_type: String,
    pub variant_url: String,
    pub duration_seconds: Option<i32>,
    pub is_canonical: bool,
    // Provenance fields
    pub source_url: String,
    pub access_date: DateTime<Utc>,
    pub checksum: Option<String>,
    pub original_format: String,
    pub created_at: DateTime<Utc>,
}

impl ContentVariant {
    #[must_use]
    pub fn new(
        content_id: Uuid,
        variant_type: VariantType,
        variant_url: String,
        source_url: String,
        original_format: String,
    ) -> Self {
        Self {
            id: Uuid::now_v7(),
            content_id,
            variant_type: variant_type.to_string(),
            variant_url,
            duration_seconds: None,
            is_canonical: false,
            source_url,
            access_date: Utc::now(),
            checksum: None,
            original_format,
            created_at: Utc::now(),
        }
    }

    #[must_use]
    pub fn with_checksum(mut self, checksum: String) -> Self {
        self.checksum = Some(checksum);
        self
    }

    #[must_use]
    pub const fn with_duration(mut self, seconds: i32) -> Self {
        self.duration_seconds = Some(seconds);
        self
    }

    #[must_use]
    pub const fn as_canonical(mut self) -> Self {
        self.is_canonical = true;
        self
    }
}
