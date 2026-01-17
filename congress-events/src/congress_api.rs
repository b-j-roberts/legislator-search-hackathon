use crate::models::{Chamber, Hearing};
use eyre::{Context, Result};
use serde::Deserialize;
use std::fs;
use std::path::Path;

// Structs matching the existing hearings YAML format from the Python fetcher
// Some fields may be unused but match the source schema

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct ExistingHearingsYaml {
    metadata: ExistingMetadata,
    hearings: Vec<ExistingHearing>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct ExistingMetadata {
    total_hearings: Option<usize>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct ExistingHearing {
    title: Option<String>,
    date: Option<String>,
    congress: Option<u32>,
    chamber: Option<String>,
    #[serde(rename = "type")]
    hearing_type: Option<String>,
    committee: Option<String>,
    subcommittee: Option<String>,
    sources: Option<Vec<Source>>,
    event_id: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct Source {
    url: Option<String>,
    #[serde(rename = "type")]
    source_type: Option<String>,
    source: Option<String>,
    description: Option<String>,
}

/// Load hearings from existing YAML file and convert to our model
pub fn load_hearings_from_yaml(path: &Path) -> Result<Vec<Hearing>> {
    let content = fs::read_to_string(path)
        .wrap_err_with(|| format!("Failed to read hearings YAML: {}", path.display()))?;

    let yaml: ExistingHearingsYaml = serde_yaml::from_str(&content)
        .wrap_err_with(|| format!("Failed to parse hearings YAML: {}", path.display()))?;

    let hearings = yaml
        .hearings
        .into_iter()
        .enumerate()
        .map(|(i, h)| convert_hearing(h, i))
        .collect();

    Ok(hearings)
}

fn convert_hearing(h: ExistingHearing, index: usize) -> Hearing {
    let sources = h.sources.unwrap_or_default();

    // Extract transcript URL (type == "text" from govinfo)
    let transcript = sources
        .iter()
        .find(|s| {
            let source_type = s.source_type.as_deref().unwrap_or("");
            source_type == "text"
        })
        .and_then(|s| s.url.clone());

    // Extract video URL
    let video = sources
        .iter()
        .find(|s| {
            let source_type = s.source_type.as_deref().unwrap_or("");
            source_type == "video"
        })
        .and_then(|s| s.url.clone());

    // Generate event ID if not present
    let event_id = h.event_id.unwrap_or_else(|| {
        let congress = h.congress.unwrap_or(0);
        let chamber_code = match h.chamber.as_deref() {
            Some("House") => "h",
            Some("Senate") => "s",
            _ => "x",
        };
        let date = h.date.as_deref().unwrap_or("unknown");
        format!("hearing-{}-{}-{}-{}", congress, chamber_code, date, index)
    });

    // Combine committee and subcommittee for display
    let committee = match (h.committee, h.subcommittee) {
        (Some(c), Some(s)) => Some(format!("{} - {}", c, s)),
        (Some(c), None) => Some(c),
        (None, Some(s)) => Some(s),
        (None, None) => None,
    };

    Hearing {
        event_id,
        date: h.date.unwrap_or_else(|| "unknown".to_string()),
        chamber: h
            .chamber
            .as_deref()
            .map(Chamber::from)
            .unwrap_or(Chamber::Unknown),
        committee,
        title: h.title.unwrap_or_else(|| "Untitled Hearing".to_string()),
        transcript,
        video,
        congress: h.congress,
    }
}

/// Statistics about the hearings loaded
pub struct HearingsStats {
    pub total: usize,
    pub with_transcript: usize,
    pub with_video: usize,
    pub without_transcript: usize,
    pub without_video: usize,
}

impl HearingsStats {
    pub fn from_hearings(hearings: &[Hearing]) -> Self {
        let total = hearings.len();
        let with_transcript = hearings.iter().filter(|h| h.transcript.is_some()).count();
        let with_video = hearings.iter().filter(|h| h.video.is_some()).count();

        Self {
            total,
            with_transcript,
            with_video,
            without_transcript: total - with_transcript,
            without_video: total - with_video,
        }
    }
}
