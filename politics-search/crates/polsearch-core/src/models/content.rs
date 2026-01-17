//! Content model (individual pieces of content from a source)

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Content {
    pub id: Uuid,
    pub source_id: Uuid,
    pub guid: String,
    pub title: String,
    pub description: Option<String>,
    pub published_at: DateTime<Utc>,
    pub year_month: String,
    pub content_url: String,
    pub thumbnail_url: Option<String>,
    pub duration_seconds: Option<i32>,
    pub is_processed: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// Tracks which raw data format is stored in the archive
    pub raw_data_version: Option<i32>,
}

impl Content {
    #[must_use]
    pub fn new(
        source_id: Uuid,
        guid: String,
        title: String,
        published_at: DateTime<Utc>,
        content_url: String,
    ) -> Self {
        let year_month = published_at.format("%Y-%m").to_string();
        Self {
            id: Uuid::now_v7(),
            source_id,
            guid,
            title,
            description: None,
            published_at,
            year_month,
            content_url,
            thumbnail_url: None,
            duration_seconds: None,
            is_processed: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            raw_data_version: None,
        }
    }

    #[must_use]
    pub fn with_description(mut self, description: String) -> Self {
        self.description = Some(description);
        self
    }

    #[must_use]
    pub fn with_thumbnail_url(mut self, url: String) -> Self {
        self.thumbnail_url = Some(url);
        self
    }

    #[must_use]
    pub const fn with_duration(mut self, seconds: i32) -> Self {
        self.duration_seconds = Some(seconds);
        self
    }
}
