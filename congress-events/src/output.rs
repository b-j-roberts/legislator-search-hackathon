use crate::models::{Event, FloorSpeech, Hearing, MasterList, Metadata};
use chrono::Utc;
use eyre::{Context, Result};
use std::fs::File;
use std::io::Write;
use std::path::Path;

/// Write the master list to a YAML file
pub fn write_master_list(events: &[Event], output_path: &Path) -> Result<()> {
    let with_transcript = events.iter().filter(|e| e.has_transcript()).count();
    let without_transcript = events.len() - with_transcript;

    let floor_speeches = events
        .iter()
        .filter(|e| matches!(e, Event::FloorSpeech(_)))
        .count();
    let hearings = events
        .iter()
        .filter(|e| matches!(e, Event::Hearing(_)))
        .count();
    let media_appearances = events
        .iter()
        .filter(|e| matches!(e, Event::MediaAppearance(_)))
        .count();

    let master_list = MasterList {
        metadata: Metadata {
            generated_at: Utc::now().to_rfc3339(),
            total_events: events.len(),
            with_transcript,
            without_transcript,
            floor_speeches,
            hearings,
            media_appearances,
        },
        events: events.to_vec(),
    };

    let yaml =
        serde_yaml::to_string(&master_list).wrap_err("Failed to serialize master list to YAML")?;

    let mut file =
        File::create(output_path).wrap_err_with(|| format!("Failed to create {}", output_path.display()))?;

    file.write_all(yaml.as_bytes())
        .wrap_err_with(|| format!("Failed to write to {}", output_path.display()))?;

    Ok(())
}

/// Write floor speeches to a YAML file
pub fn write_floor_speeches(speeches: &[FloorSpeech], output_path: &Path) -> Result<()> {
    let with_transcript = speeches.iter().filter(|s| s.transcript.is_some()).count();

    let output = FloorSpeechesOutput {
        metadata: FloorSpeechesMetadata {
            generated_at: Utc::now().to_rfc3339(),
            total_speeches: speeches.len(),
            with_transcript,
            without_transcript: speeches.len() - with_transcript,
        },
        floor_speeches: speeches.to_vec(),
    };

    let yaml = serde_yaml::to_string(&output).wrap_err("Failed to serialize floor speeches to YAML")?;

    let mut file =
        File::create(output_path).wrap_err_with(|| format!("Failed to create {}", output_path.display()))?;

    file.write_all(yaml.as_bytes())
        .wrap_err_with(|| format!("Failed to write to {}", output_path.display()))?;

    Ok(())
}

/// Write hearings to a YAML file
pub fn write_hearings(hearings: &[Hearing], output_path: &Path) -> Result<()> {
    let with_transcript = hearings.iter().filter(|h| h.transcript.is_some()).count();
    let with_video = hearings.iter().filter(|h| h.video.is_some()).count();

    let output = HearingsOutput {
        metadata: HearingsMetadata {
            generated_at: Utc::now().to_rfc3339(),
            total_hearings: hearings.len(),
            with_transcript,
            without_transcript: hearings.len() - with_transcript,
            with_video,
        },
        hearings: hearings.to_vec(),
    };

    let yaml = serde_yaml::to_string(&output).wrap_err("Failed to serialize hearings to YAML")?;

    let mut file =
        File::create(output_path).wrap_err_with(|| format!("Failed to create {}", output_path.display()))?;

    file.write_all(yaml.as_bytes())
        .wrap_err_with(|| format!("Failed to write to {}", output_path.display()))?;

    Ok(())
}

#[derive(serde::Serialize)]
struct FloorSpeechesOutput {
    metadata: FloorSpeechesMetadata,
    floor_speeches: Vec<FloorSpeech>,
}

#[derive(serde::Serialize)]
struct FloorSpeechesMetadata {
    generated_at: String,
    total_speeches: usize,
    with_transcript: usize,
    without_transcript: usize,
}

#[derive(serde::Serialize)]
struct HearingsOutput {
    metadata: HearingsMetadata,
    hearings: Vec<Hearing>,
}

#[derive(serde::Serialize)]
struct HearingsMetadata {
    generated_at: String,
    total_hearings: usize,
    with_transcript: usize,
    without_transcript: usize,
    with_video: usize,
}
