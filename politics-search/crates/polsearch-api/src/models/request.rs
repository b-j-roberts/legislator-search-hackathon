//! Request models for API endpoints

use serde::Deserialize;
use utoipa::{IntoParams, ToSchema};

/// Search mode for queries
#[derive(Debug, Clone, Copy, Default, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum SearchMode {
    /// Combine vector similarity + full-text search (best quality)
    #[default]
    Hybrid,
    /// Semantic similarity using embeddings only
    Vector,
    /// Keyword-based full-text search
    Fts,
    /// Exact phrase matching
    Phrase,
}

/// Content type filter
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum ContentType {
    Hearing,
    FloorSpeech,
    Vote,
    All,
}

/// Context scope for RAG mode
#[derive(Debug, Clone, Copy, Default, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum ContextScope {
    /// Only segments from the same content
    #[default]
    Same,
    /// Include semantically similar segments from other content
    Related,
}

/// Chamber filter
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum Chamber {
    House,
    Senate,
}

impl Chamber {
    #[must_use]
    #[allow(dead_code)]
    pub const fn as_str(&self) -> &'static str {
        match self {
            Self::House => "house",
            Self::Senate => "senate",
        }
    }
}

const fn default_limit() -> usize { 10 }
const fn default_enrich() -> bool { true }

/// Search query parameters
#[derive(Debug, Deserialize, IntoParams)]
#[into_params(parameter_in = Query)]
pub struct SearchParams {
    /// Search query text (required, non-empty)
    #[param(min_length = 1)]
    pub q: String,

    /// Search mode
    #[serde(default)]
    pub mode: SearchMode,

    /// Content types to search (comma-separated: `hearing,floor_speech,vote,all`)
    #[serde(default, rename = "type")]
    #[param(value_type = Option<String>)]
    pub content_type: Option<String>,

    /// Results per page (default: 10, max: 100)
    #[serde(default = "default_limit")]
    #[param(minimum = 1, maximum = 100)]
    pub limit: usize,

    /// Pagination offset
    #[serde(default)]
    pub offset: usize,

    /// Include metadata from `PostgreSQL`
    #[serde(default = "default_enrich")]
    pub enrich: bool,

    /// Number of context segments before/after (0 = disabled)
    #[serde(default)]
    #[param(minimum = 0, maximum = 10)]
    pub context: usize,

    /// Context scope (same content or related)
    #[serde(default)]
    #[allow(dead_code)]
    pub context_scope: ContextScope,

    /// Filter by speaker name (fuzzy match)
    pub speaker: Option<String>,

    /// Filter by committee (fuzzy match, hearings only)
    pub committee: Option<String>,

    /// Filter by chamber
    pub chamber: Option<Chamber>,

    /// Filter by congress number
    pub congress: Option<i16>,

    /// Start date (YYYY-MM-DD or YYYY-MM)
    pub from: Option<String>,

    /// End date (YYYY-MM-DD or YYYY-MM)
    pub to: Option<String>,

    /// Exclude witnesses from results (only return congressional speakers)
    #[serde(default)]
    pub exclude_witnesses: bool,
}

impl SearchParams {
    /// Parse content types from comma-separated string
    #[must_use]
    pub fn parse_content_types(&self) -> Vec<ContentType> {
        match &self.content_type {
            None => vec![ContentType::All],
            Some(s) if s.is_empty() => vec![ContentType::All],
            Some(s) => s
                .split(',')
                .filter_map(|t| match t.trim().to_lowercase().as_str() {
                    "hearing" => Some(ContentType::Hearing),
                    "floor_speech" => Some(ContentType::FloorSpeech),
                    "vote" => Some(ContentType::Vote),
                    "all" => Some(ContentType::All),
                    _ => None,
                })
                .collect(),
        }
    }
}
