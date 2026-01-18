//! Hearing model - congressional hearing metadata

use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Congressional hearing transcript metadata stored in Postgres
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Hearing {
    pub id: Uuid,
    /// `GovInfo` package ID (e.g., "CHRG-116hhrg42928")
    pub package_id: String,
    /// Event identifier from transcript
    pub event_id: String,
    /// Hearing title
    pub title: String,
    /// Raw committee name from transcript
    pub committee_raw: Option<String>,
    /// Normalized committee slug for filtering
    pub committee_slug: Option<String>,
    /// Array of chambers: ["House"], ["Senate"], or ["House", "Senate"] for joint
    pub chambers: Vec<String>,
    /// Congress number (e.g., 116, 117, 118)
    pub congress: i16,
    /// Date of the hearing
    pub hearing_date: NaiveDate,
    /// Year-month for filtering (e.g., "2020-12")
    pub year_month: String,
    /// Link to `GovInfo` source
    pub source_url: String,
    /// Total statements in hearing
    pub total_statements: i32,
    /// Total segments (chunks) created
    pub total_segments: i32,
    /// Whether embedding processing is complete
    pub is_processed: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Hearing {
    /// Creates a new hearing from parsed transcript data
    #[must_use]
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        package_id: String,
        event_id: String,
        title: String,
        committee_raw: Option<String>,
        chamber: &str,
        congress: i16,
        hearing_date: NaiveDate,
        source_url: String,
    ) -> Self {
        let year_month = hearing_date.format("%Y-%m").to_string();
        let chambers = vec![chamber.to_string()];
        let committee_slug = committee_raw.as_ref().map(|c| slugify_committee(c));

        Self {
            id: Uuid::now_v7(),
            package_id,
            event_id,
            title,
            committee_raw,
            committee_slug,
            chambers,
            congress,
            hearing_date,
            year_month,
            source_url,
            total_statements: 0,
            total_segments: 0,
            is_processed: false,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    /// Returns chambers as a display string (e.g., "House, Senate" for joint)
    #[must_use]
    pub fn chambers_display(&self) -> String {
        self.chambers.join(", ")
    }

    /// Returns true if this is a joint hearing
    #[must_use]
    pub fn is_joint(&self) -> bool {
        self.chambers.len() > 1
    }
}

/// Normalize a committee name to a slug for filtering
fn slugify_committee(name: &str) -> String {
    let mut slug = String::new();
    let mut last_was_hyphen = true;

    for c in name.chars() {
        if c.is_alphanumeric() {
            slug.push(c.to_ascii_lowercase());
            last_was_hyphen = false;
        } else if !last_was_hyphen {
            slug.push('-');
            last_was_hyphen = true;
        }
    }

    slug.trim_end_matches('-').to_string()
}
