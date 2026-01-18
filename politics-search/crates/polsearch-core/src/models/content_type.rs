//! Content type enum for filtering search results

use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

/// Content type for search filtering
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum ContentType {
    /// All content types (default)
    #[default]
    All,
    /// Podcast episodes
    Podcast,
    /// Congressional hearing transcripts
    Hearing,
    /// Congressional Record floor speeches
    FloorSpeech,
}

impl ContentType {
    /// Returns the database value for this content type
    #[must_use]
    pub const fn as_db_value(&self) -> &'static str {
        match self {
            Self::All => "all",
            Self::Podcast => "podcast",
            Self::Hearing => "hearing",
            Self::FloorSpeech => "floor_speech",
        }
    }

    /// Returns true if this represents all content types
    #[must_use]
    pub const fn is_all(&self) -> bool {
        matches!(self, Self::All)
    }
}

impl fmt::Display for ContentType {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::All => write!(f, "all"),
            Self::Podcast => write!(f, "podcast"),
            Self::Hearing => write!(f, "hearing"),
            Self::FloorSpeech => write!(f, "floor_speech"),
        }
    }
}

impl FromStr for ContentType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "all" => Ok(Self::All),
            "podcast" => Ok(Self::Podcast),
            "hearing" => Ok(Self::Hearing),
            "floor_speech" | "floorspeech" => Ok(Self::FloorSpeech),
            _ => Err(format!("Unknown content type: {s}")),
        }
    }
}

