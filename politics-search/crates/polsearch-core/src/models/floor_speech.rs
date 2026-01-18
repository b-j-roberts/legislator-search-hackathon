//! Floor speech model - Congressional Record speech metadata

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Congressional Record floor speech metadata stored in Postgres
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct FloorSpeech {
    pub id: Uuid,
    /// Unique event identifier (e.g., "CREC-2024-01-17-CREC-2024-01-17-pt1-PgS157")
    pub event_id: String,
    /// `GovInfo` granule ID (e.g., "CREC-2024-01-17-pt1-PgS157")
    pub granule_id: String,
    /// Speech title (e.g., "IMMIGRATION POLICY")
    pub title: String,
    /// Chamber: "House" or "Senate"
    pub chamber: String,
    /// Page type: "H" (House), "S" (Senate), "E" (Extensions), "D" (Daily Digest)
    pub page_type: String,
    /// Date of the speech
    pub speech_date: NaiveDate,
    /// Year-month for filtering (e.g., "2024-01")
    pub year_month: String,
    /// Link to `GovInfo` source
    pub source_url: String,
    /// Total statements in speech
    pub total_statements: i32,
    /// Total segments (chunks) created
    pub total_segments: i32,
    /// Whether embedding processing is complete
    pub is_processed: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl FloorSpeech {
    /// Creates a new floor speech from parsed CREC data
    #[must_use]
    pub fn new(
        event_id: String,
        granule_id: String,
        title: String,
        chamber: String,
        speech_date: NaiveDate,
        source_url: String,
    ) -> Self {
        let year_month = speech_date.format("%Y-%m").to_string();
        let page_type = extract_page_type(&granule_id);

        Self {
            id: Uuid::now_v7(),
            event_id,
            granule_id,
            title,
            chamber,
            page_type,
            speech_date,
            year_month,
            source_url,
            total_statements: 0,
            total_segments: 0,
            is_processed: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    /// Returns true if this is a Senate floor speech
    #[must_use]
    pub fn is_senate(&self) -> bool {
        self.chamber == "Senate" || self.page_type == "S"
    }

    /// Returns true if this is a House floor speech
    #[must_use]
    pub fn is_house(&self) -> bool {
        self.chamber == "House" || self.page_type == "H"
    }
}

/// Extract page type (H, S, E, D) from granule ID
/// e.g., "CREC-2024-01-17-pt1-PgS157" -> "S"
fn extract_page_type(granule_id: &str) -> String {
    // look for "Pg" followed by the page type letter
    if let Some(pos) = granule_id.find("Pg") {
        if let Some(ch) = granule_id.chars().nth(pos + 2) {
            return ch.to_string();
        }
    }
    String::new()
}
