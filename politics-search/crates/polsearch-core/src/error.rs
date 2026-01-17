//! Core error types

use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("Invalid slug: {0}")]
    InvalidSlug(String),

    #[error("Invalid year-month format: {0}")]
    InvalidYearMonth(String),

    #[error("Invalid tier: {0} (must be 1, 2, or 3)")]
    InvalidTier(i16),

    #[error("Podcast not found: {0}")]
    PodcastNotFound(String),

    #[error("Episode not found: {0}")]
    EpisodeNotFound(String),

    #[error("Speaker not found: {0}")]
    SpeakerNotFound(String),

    #[error("Batch not found: {0}")]
    BatchNotFound(String),

    #[error("Cannot merge speaker into itself")]
    SelfMerge,

    #[error("Circular merge detected: speaker {0} would create a cycle")]
    CircularMerge(String),
}
