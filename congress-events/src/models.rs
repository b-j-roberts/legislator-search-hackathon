use serde::{Deserialize, Serialize};

pub use media_common::MediaAppearance;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Event {
    FloorSpeech(FloorSpeech),
    Hearing(Hearing),
    MediaAppearance(MediaAppearance),
}

#[allow(dead_code)]
impl Event {
    pub fn event_id(&self) -> &str {
        match self {
            Event::FloorSpeech(s) => &s.event_id,
            Event::Hearing(h) => &h.event_id,
            Event::MediaAppearance(m) => &m.event_id,
        }
    }

    pub fn date(&self) -> &str {
        match self {
            Event::FloorSpeech(s) => &s.date,
            Event::Hearing(h) => &h.date,
            Event::MediaAppearance(m) => m.date.to_string().leak(),
        }
    }

    pub fn date_string(&self) -> String {
        match self {
            Event::FloorSpeech(s) => s.date.clone(),
            Event::Hearing(h) => h.date.clone(),
            Event::MediaAppearance(m) => m.date.to_string(),
        }
    }

    pub fn has_transcript(&self) -> bool {
        match self {
            Event::FloorSpeech(s) => s.transcript.is_some(),
            Event::Hearing(h) => h.transcript.is_some(),
            Event::MediaAppearance(m) => m.has_transcript(),
        }
    }

    pub fn has_video(&self) -> bool {
        match self {
            Event::FloorSpeech(s) => s.video.is_some(),
            Event::Hearing(h) => h.video.is_some(),
            Event::MediaAppearance(m) => m.media.video_url.is_some(),
        }
    }

    pub fn is_media_appearance(&self) -> bool {
        matches!(self, Event::MediaAppearance(_))
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FloorSpeech {
    pub event_id: String,
    pub date: String,
    pub chamber: Chamber,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transcript: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub video: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub granule_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hearing {
    pub event_id: String,
    pub date: String,
    pub chamber: Chamber,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub committee: Option<String>,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transcript: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub video: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub congress: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum Chamber {
    House,
    Senate,
    Joint,
    #[serde(other)]
    Unknown,
}

impl std::fmt::Display for Chamber {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Chamber::House => write!(f, "House"),
            Chamber::Senate => write!(f, "Senate"),
            Chamber::Joint => write!(f, "Joint"),
            Chamber::Unknown => write!(f, "Unknown"),
        }
    }
}

impl From<&str> for Chamber {
    fn from(s: &str) -> Self {
        match s.to_lowercase().as_str() {
            "house" => Chamber::House,
            "senate" => Chamber::Senate,
            "joint" => Chamber::Joint,
            _ => Chamber::Unknown,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MasterList {
    pub metadata: Metadata,
    pub events: Vec<Event>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metadata {
    pub generated_at: String,
    pub total_events: usize,
    pub with_transcript: usize,
    pub without_transcript: usize,
    pub floor_speeches: usize,
    pub hearings: usize,
    #[serde(default)]
    pub media_appearances: usize,
}

/// A fully parsed transcript with speaker attribution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedTranscript {
    pub event_id: String,
    pub package_id: String,
    pub title: String,
    pub date: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub committee: Option<String>,
    pub chamber: Chamber,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub congress: Option<u32>,
    pub source_url: String,
    pub statements: Vec<Statement>,
    pub speakers: Vec<String>,
}

/// A single statement from a speaker in a transcript
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Statement {
    pub speaker: String,
    pub text: String,
    pub index: usize,
}
