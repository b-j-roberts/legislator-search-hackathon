//! Response models for API endpoints

use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

/// Individual search result
#[derive(Debug, Serialize, ToSchema)]
pub struct SearchResult {
    /// Content ID (hearing, floor speech, or vote ID)
    pub content_id: Uuid,

    /// Original content ID string (for FTS results using `package_id/event_id`)
    #[serde(skip_serializing_if = "String::is_empty")]
    pub content_id_str: String,

    /// Segment index within the content
    pub segment_index: i32,

    /// The matching text segment
    pub text: String,

    /// Start time in milliseconds (for audio content)
    pub start_time_ms: i32,

    /// End time in milliseconds (for audio content)
    pub end_time_ms: i32,

    /// Normalized relevance score (0-1, higher is better)
    pub score: f32,

    /// Content type (hearing, `floor_speech`, vote)
    pub content_type: String,

    /// Speaker name if available
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speaker_name: Option<String>,

    /// Content title if available (enriched)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,

    /// Content date if available (enriched)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date: Option<String>,

    /// Source URL to the original document (enriched)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_url: Option<String>,

    /// Committee name (hearings only, enriched)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub committee: Option<String>,

    /// Chamber: "House", "Senate", or "House, Senate" for joint (enriched)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chamber: Option<String>,

    /// Congress number (hearings only, enriched)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub congress: Option<i16>,

    /// Context segments before this result
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub context_before: Vec<String>,

    /// Context segments after this result
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub context_after: Vec<String>,
}

/// Search response
#[derive(Debug, Serialize, ToSchema)]
pub struct SearchResponse {
    /// Original query string
    pub query: String,

    /// Requested search mode
    pub mode: String,

    /// Actual mode used (may differ if fallback occurred)
    pub mode_used: String,

    /// Search results
    pub results: Vec<SearchResult>,

    /// Number of results returned
    pub total_returned: usize,

    /// Whether more results are available
    pub has_more: bool,

    /// Offset for next page (if `has_more` is true)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_offset: Option<usize>,
}

/// Health check response
#[derive(Debug, Serialize, ToSchema)]
pub struct HealthResponse {
    pub status: &'static str,
}

/// Content detail response for a single hearing or floor speech
#[derive(Debug, Serialize, ToSchema)]
pub struct ContentDetailResponse {
    /// Content ID
    pub id: Uuid,

    /// Content type (`"hearing"` or `"floor_speech"`)
    pub content_type: String,

    /// Content title
    pub title: String,

    /// Content date (YYYY-MM-DD format)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub date: Option<String>,

    /// Source URL to the original document on `GovInfo`
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_url: Option<String>,

    /// Committee name (hearings only)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub committee: Option<String>,

    /// Chamber(s): "House", "Senate", or "House, Senate" for joint hearings
    #[serde(skip_serializing_if = "Option::is_none")]
    pub chambers: Option<String>,

    /// Congress number (hearings only)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub congress: Option<i16>,

    /// Page type (floor speeches only)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub page_type: Option<String>,

    /// Total number of statements in this content
    pub total_statements: i32,

    /// Total number of searchable segments in this content
    pub total_segments: i32,
}
