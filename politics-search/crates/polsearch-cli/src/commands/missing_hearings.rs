//! Find congressional hearings that are missing transcripts

use chrono::NaiveDate;
use color_eyre::eyre::{Result, WrapErr};
use colored::Colorize;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::io::Write as IoWrite;
use std::path::Path;

/// YAML file structure from congressional hearings fetcher
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct HearingsFile {
    metadata: Metadata,
    hearings: Vec<HearingEntry>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct Metadata {
    generated_at: String,
    total_hearings: usize,
}

#[derive(Debug, Deserialize, Clone)]
#[allow(dead_code)]
struct HearingEntry {
    title: String,
    date: Option<String>,
    congress: i16,
    chamber: Option<String>,
    #[serde(rename = "type")]
    hearing_type: Option<String>,
    committee: Option<String>,
    subcommittee: Option<String>,
    status: Option<String>,
    location: Option<String>,
    sources: Option<Vec<Source>>,
}

#[derive(Debug, Deserialize, Clone)]
#[allow(dead_code)]
struct Source {
    url: String,
    #[serde(rename = "type")]
    source_type: String,
    source: String,
}

/// Transcript JSON file structure
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct TranscriptFile {
    package_id: String,
    title: String,
    date: String,
    committee: String,
    chamber: String,
    congress: i16,
}

/// Info extracted from transcripts for matching
#[derive(Debug)]
#[allow(dead_code)]
struct TranscriptInfo {
    package_id: String,
    title_normalized: String,
    date: String,
    chamber: String,
    congress: i16,
    committee_normalized: String,
}

/// Output structure for missing hearings
#[derive(Debug, Serialize)]
struct MissingHearingsOutput {
    metadata: OutputMetadata,
    missing_hearings: Vec<MissingHearing>,
}

#[derive(Debug, Serialize)]
struct OutputMetadata {
    generated_at: String,
    yaml_source: String,
    total_in_yaml: usize,
    hearings_only: usize,
    existing_transcripts: usize,
    missing: usize,
}

#[derive(Debug, Serialize)]
struct MissingHearing {
    title: String,
    date: String,
    congress: i16,
    chamber: String,
    committee: String,
    subcommittee: Option<String>,
    location: Option<String>,
    congress_gov_url: Option<String>,
}

/// Run the missing-hearings command
pub async fn run(
    yaml_path: &str,
    transcripts_path: &str,
    output: Option<String>,
    congress_filter: Option<i16>,
    chamber_filter: Option<String>,
) -> Result<()> {
    let yaml_path = Path::new(yaml_path);
    let transcripts_path = Path::new(transcripts_path);

    // validate paths
    if !yaml_path.exists() {
        return Err(color_eyre::eyre::eyre!(
            "YAML file not found: {}",
            yaml_path.display()
        ));
    }

    if !transcripts_path.exists() {
        return Err(color_eyre::eyre::eyre!(
            "Transcripts directory not found: {}",
            transcripts_path.display()
        ));
    }

    println!(
        "{}",
        format!("Loading hearings from {}...", yaml_path.display()).cyan()
    );

    // load and parse YAML
    let yaml_content =
        fs::read_to_string(yaml_path).wrap_err("Failed to read YAML file")?;
    let hearings_file: HearingsFile =
        serde_yaml::from_str(&yaml_content).wrap_err("Failed to parse YAML file")?;

    let total_in_yaml = hearings_file.hearings.len();
    println!("  Total entries in YAML: {}", total_in_yaml.to_string().cyan());

    // today's date for filtering future hearings
    let today = NaiveDate::parse_from_str("2026-01-17", "%Y-%m-%d")
        .expect("hardcoded date should parse");

    // filter to only past hearings of type "Hearing"
    let candidate_hearings: Vec<_> = hearings_file
        .hearings
        .into_iter()
        .filter(|h| {
            // must be type "Hearing"
            let is_hearing = h
                .hearing_type
                .as_ref()
                .is_some_and(|t| t.eq_ignore_ascii_case("hearing"));

            if !is_hearing {
                return false;
            }

            // must have a date in the past
            let Some(date_str) = &h.date else {
                return false;
            };
            let Ok(date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") else {
                return false;
            };
            if date >= today {
                return false;
            }

            // filter by congress if specified
            if let Some(c) = congress_filter {
                if h.congress != c {
                    return false;
                }
            }

            // filter by chamber if specified
            if let Some(ref ch) = chamber_filter {
                let hearing_chamber = h.chamber.as_deref().unwrap_or("");
                if !hearing_chamber.eq_ignore_ascii_case(ch) {
                    return false;
                }
            }

            true
        })
        .collect();

    let hearings_only = candidate_hearings.len();
    println!(
        "  Past hearings (type=Hearing, date<today): {}",
        hearings_only.to_string().cyan()
    );

    // load existing transcripts
    println!(
        "{}",
        format!("Loading transcripts from {}...", transcripts_path.display()).cyan()
    );

    let transcripts = load_transcripts(transcripts_path)?;
    let existing_transcripts = transcripts.len();
    println!(
        "  Existing transcripts: {}",
        existing_transcripts.to_string().cyan()
    );

    // build index for fast matching
    let transcript_keys: HashSet<String> = transcripts
        .iter()
        .map(|t| make_match_key(t.congress, &t.chamber, &t.date))
        .collect();

    // find missing hearings
    println!("{}", "Finding missing hearings...".cyan());

    let mut missing: Vec<MissingHearing> = Vec::new();

    for hearing in &candidate_hearings {
        let date = hearing.date.as_deref().unwrap_or("");
        let chamber = hearing.chamber.as_deref().unwrap_or("");

        // first pass: exact match on congress + chamber + date
        let key = make_match_key(hearing.congress, chamber, date);

        if transcript_keys.contains(&key) {
            // there's a transcript with same congress/chamber/date
            // do a more thorough check
            let matching_transcripts: Vec<_> = transcripts
                .iter()
                .filter(|t| t.congress == hearing.congress && t.chamber.eq_ignore_ascii_case(chamber) && t.date == date)
                .collect();

            // check if any transcript matches by committee
            let hearing_committee = normalize_committee(
                hearing
                    .committee
                    .as_deref()
                    .or(hearing.subcommittee.as_deref())
                    .unwrap_or(""),
            );

            let has_match = matching_transcripts.iter().any(|t| {
                let similarity = committee_similarity(&hearing_committee, &t.committee_normalized);
                similarity >= 0.5
            });

            if has_match {
                continue;
            }
        }

        // no match found, add to missing
        let congress_gov_url = hearing
            .sources
            .as_ref()
            .and_then(|sources| {
                sources
                    .iter()
                    .find(|s| s.url.contains("congress.gov"))
                    .map(|s| s.url.clone())
            });

        missing.push(MissingHearing {
            title: hearing.title.clone(),
            date: date.to_string(),
            congress: hearing.congress,
            chamber: chamber.to_string(),
            committee: hearing
                .committee
                .clone()
                .unwrap_or_else(|| "Unknown".to_string()),
            subcommittee: hearing.subcommittee.clone(),
            location: hearing.location.clone(),
            congress_gov_url,
        });
    }

    let missing_count = missing.len();

    println!();
    println!("{}", "Results:".green().bold());
    println!("  Total hearings in YAML:   {}", total_in_yaml.to_string().cyan());
    println!(
        "  Past hearings (filtered): {}",
        hearings_only.to_string().cyan()
    );
    println!(
        "  Existing transcripts:     {}",
        existing_transcripts.to_string().cyan()
    );
    println!("  Missing transcripts:      {}", missing_count.to_string().yellow());

    // generate output
    let output_data = MissingHearingsOutput {
        metadata: OutputMetadata {
            generated_at: chrono::Utc::now().to_rfc3339(),
            yaml_source: yaml_path.display().to_string(),
            total_in_yaml,
            hearings_only,
            existing_transcripts,
            missing: missing_count,
        },
        missing_hearings: missing,
    };

    let yaml_output =
        serde_yaml::to_string(&output_data).wrap_err("Failed to serialize output")?;

    if let Some(output_path) = output {
        let mut file =
            fs::File::create(&output_path).wrap_err("Failed to create output file")?;
        file.write_all(yaml_output.as_bytes())
            .wrap_err("Failed to write output file")?;
        println!();
        println!("Output written to: {}", output_path.green());
    } else {
        println!();
        println!("{}", "--- Missing Hearings ---".yellow().bold());
        print!("{yaml_output}");
    }

    Ok(())
}

/// Load all transcript JSON files and extract relevant info
fn load_transcripts(dir: &Path) -> Result<Vec<TranscriptInfo>> {
    let mut transcripts = Vec::new();

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();

        if path.extension().is_some_and(|e| e == "json")
            && path
                .file_name()
                .is_some_and(|n| n.to_string_lossy().starts_with("CHRG-"))
        {
            match load_transcript(&path) {
                Ok(info) => transcripts.push(info),
                Err(e) => {
                    tracing::warn!("Failed to parse {}: {}", path.display(), e);
                }
            }
        }
    }

    Ok(transcripts)
}

/// Load a single transcript file and extract matching info
fn load_transcript(path: &Path) -> Result<TranscriptInfo> {
    let content = fs::read_to_string(path)?;
    let transcript: TranscriptFile = serde_json::from_str(&content)?;

    Ok(TranscriptInfo {
        package_id: transcript.package_id,
        title_normalized: normalize_title(&transcript.title),
        date: transcript.date,
        chamber: transcript.chamber,
        congress: transcript.congress,
        committee_normalized: normalize_committee(&transcript.committee),
    })
}

/// Create a match key from congress, chamber, and date
fn make_match_key(congress: i16, chamber: &str, date: &str) -> String {
    format!(
        "{}-{}-{}",
        congress,
        chamber.to_lowercase(),
        date
    )
}

/// Normalize a title for comparison
fn normalize_title(title: &str) -> String {
    title
        .to_lowercase()
        .replace(['.', ',', ':', ';', '"', '\'', '!', '?'], "")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

/// Normalize a committee name for comparison
fn normalize_committee(committee: &str) -> String {
    committee
        .to_lowercase()
        .replace("committee", "")
        .replace("subcommittee", "")
        .replace("united states", "")
        .replace("u.s.", "")
        .replace("house of representatives", "house")
        .replace("one hundred", "")
        .replace("first session", "")
        .replace("second session", "")
        .replace("congress", "")
        .replace(['.', ',', ':', ';'], "")
        .split_whitespace()
        .filter(|w| !w.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

/// Calculate similarity between two normalized committee names
fn committee_similarity(a: &str, b: &str) -> f64 {
    let a_words: HashSet<&str> = a.split_whitespace().collect();
    let b_words: HashSet<&str> = b.split_whitespace().collect();

    if a_words.is_empty() || b_words.is_empty() {
        return 0.0;
    }

    let intersection = a_words.intersection(&b_words).count();
    let union = a_words.union(&b_words).count();

    if union == 0 {
        return 0.0;
    }

    intersection as f64 / union as f64
}
