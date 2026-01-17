//! Source model (content sources like YouTube channels, congressional records, etc.)

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "VARCHAR", rename_all = "snake_case")]
pub enum SourceType {
    Audio,
    YouTube,
    CongressionalRecord,
    DocumentCollection,
}

impl Default for SourceType {
    fn default() -> Self {
        Self::Audio
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Source {
    pub id: Uuid,
    pub name: String,
    pub slug: String,
    pub url: String,
    pub artwork_url: Option<String>,
    #[sqlx(json)]
    pub known_hosts: Vec<String>,
    pub tier: i16,
    pub source_type: String,
    pub is_available: bool,
    pub last_fetched_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Source {
    #[must_use]
    pub fn new(name: String, slug: String, url: String, tier: i16, source_type: SourceType) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::now_v7(),
            name,
            slug,
            url,
            artwork_url: None,
            known_hosts: Vec::new(),
            tier,
            source_type: format!("{source_type:?}").to_lowercase(),
            is_available: true,
            last_fetched_at: None,
            created_at: now,
            updated_at: now,
        }
    }

    #[must_use]
    pub fn with_known_hosts(mut self, hosts: Vec<String>) -> Self {
        self.known_hosts = hosts;
        self
    }

    #[must_use]
    pub fn with_artwork_url(mut self, url: String) -> Self {
        self.artwork_url = Some(url);
        self
    }
}
