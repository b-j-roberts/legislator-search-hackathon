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
    /// Congressional hearing transcripts
    Hearing,
    /// Congressional Record floor speeches
    FloorSpeech,
    /// Congressional vote records
    Vote,
}

impl ContentType {
    /// Returns the database value for this content type
    #[must_use]
    pub const fn as_db_value(&self) -> &'static str {
        match self {
            Self::All => "all",
            Self::Hearing => "hearing",
            Self::FloorSpeech => "floor_speech",
            Self::Vote => "vote",
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
            Self::Hearing => write!(f, "hearing"),
            Self::FloorSpeech => write!(f, "floor_speech"),
            Self::Vote => write!(f, "vote"),
        }
    }
}

impl FromStr for ContentType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "all" => Ok(Self::All),
            "hearing" => Ok(Self::Hearing),
            "floor_speech" | "floorspeech" => Ok(Self::FloorSpeech),
            "vote" => Ok(Self::Vote),
            _ => Err(format!("Unknown content type: {s}")),
        }
    }
}
