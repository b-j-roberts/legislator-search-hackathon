use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

/// Type of media source
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceType {
    Cspan,
    TvArchive,
    Youtube,
    Podcast,
}

impl std::fmt::Display for SourceType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SourceType::Cspan => write!(f, "cspan"),
            SourceType::TvArchive => write!(f, "tv_archive"),
            SourceType::Youtube => write!(f, "youtube"),
            SourceType::Podcast => write!(f, "podcast"),
        }
    }
}

/// Type of media outlet
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OutletType {
    NetworkTv,
    Cable,
    Podcast,
    Youtube,
    Cspan,
}

/// Media URLs and metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaInfo {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub video_url: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio_url: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub transcript_url: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub transcript: Option<String>,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_seconds: Option<u32>,
}

impl MediaInfo {
    pub fn new() -> Self {
        Self {
            video_url: None,
            audio_url: None,
            transcript_url: None,
            transcript: None,
            duration_seconds: None,
        }
    }

    pub fn with_video(mut self, url: impl Into<String>) -> Self {
        self.video_url = Some(url.into());
        self
    }

    pub fn with_audio(mut self, url: impl Into<String>) -> Self {
        self.audio_url = Some(url.into());
        self
    }

    pub fn with_transcript_url(mut self, url: impl Into<String>) -> Self {
        self.transcript_url = Some(url.into());
        self
    }

    pub fn with_transcript(mut self, text: impl Into<String>) -> Self {
        self.transcript = Some(text.into());
        self
    }

    pub fn with_duration(mut self, seconds: u32) -> Self {
        self.duration_seconds = Some(seconds);
        self
    }
}

impl Default for MediaInfo {
    fn default() -> Self {
        Self::new()
    }
}

/// Information about the media outlet
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Outlet {
    pub name: String,

    #[serde(rename = "type")]
    pub outlet_type: OutletType,
}

impl Outlet {
    pub fn new(name: impl Into<String>, outlet_type: OutletType) -> Self {
        Self {
            name: name.into(),
            outlet_type,
        }
    }
}

/// A media appearance by a legislator
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaAppearance {
    pub event_id: String,
    pub date: NaiveDate,
    pub member_bioguide_id: String,
    pub member_name: String,
    pub source_type: SourceType,
    pub title: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    pub media: MediaInfo,
    pub outlet: Outlet,

    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub topics: Vec<String>,
}

impl MediaAppearance {
    pub fn new(
        event_id: impl Into<String>,
        date: NaiveDate,
        member_bioguide_id: impl Into<String>,
        member_name: impl Into<String>,
        source_type: SourceType,
        title: impl Into<String>,
        outlet: Outlet,
    ) -> Self {
        Self {
            event_id: event_id.into(),
            date,
            member_bioguide_id: member_bioguide_id.into(),
            member_name: member_name.into(),
            source_type,
            title: title.into(),
            description: None,
            media: MediaInfo::new(),
            outlet,
            topics: Vec::new(),
        }
    }

    pub fn with_description(mut self, desc: impl Into<String>) -> Self {
        self.description = Some(desc.into());
        self
    }

    pub fn with_media(mut self, media: MediaInfo) -> Self {
        self.media = media;
        self
    }

    pub fn with_topics(mut self, topics: Vec<String>) -> Self {
        self.topics = topics;
        self
    }

    /// Check if this appearance has a transcript available
    pub fn has_transcript(&self) -> bool {
        self.media.transcript.is_some() || self.media.transcript_url.is_some()
    }
}

/// Output format for media appearance collections
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MediaAppearanceOutput {
    pub metadata: OutputMetadata,
    pub appearances: Vec<MediaAppearance>,
}

/// Metadata for output files
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputMetadata {
    pub generated_at: String,
    pub source_type: SourceType,
    pub total_appearances: usize,
    pub with_transcript: usize,
    pub without_transcript: usize,
}

impl MediaAppearanceOutput {
    pub fn new(source_type: SourceType, appearances: Vec<MediaAppearance>) -> Self {
        let with_transcript = appearances.iter().filter(|a| a.has_transcript()).count();
        let without_transcript = appearances.len() - with_transcript;

        Self {
            metadata: OutputMetadata {
                generated_at: chrono::Utc::now().to_rfc3339(),
                source_type,
                total_appearances: appearances.len(),
                with_transcript,
                without_transcript,
            },
            appearances,
        }
    }
}
