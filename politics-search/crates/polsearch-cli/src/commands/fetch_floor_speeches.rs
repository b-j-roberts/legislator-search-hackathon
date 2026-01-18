//! Fetch floor speech transcripts from `GovInfo`

use color_eyre::eyre::{eyre, Result};
use colored::Colorize;
use polsearch_pipeline::stages::{is_procedural_crec_title, parse_crec_html, CrecStatement};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::time::Duration;
use tokio::time::sleep;
use tracing::{info, warn};

/// YAML file structure for floor speeches
#[derive(Debug, Deserialize)]
struct FloorSpeechesYaml {
    #[allow(dead_code)]
    metadata: FloorSpeechesMetadata,
    floor_speeches: Vec<FloorSpeechEntry>,
}

#[derive(Debug, Deserialize)]
struct FloorSpeechesMetadata {
    #[allow(dead_code)]
    total_speeches: usize,
}

/// Entry in the YAML file
#[derive(Debug, Deserialize)]
struct FloorSpeechEntry {
    event_id: String,
    date: String,
    chamber: String,
    title: String,
    transcript: String,
    granule_id: String,
}

/// Output JSON structure
#[derive(Debug, Serialize)]
struct FloorSpeechJson {
    event_id: String,
    granule_id: String,
    title: String,
    date: String,
    chamber: String,
    page_type: String,
    source_url: String,
    statements: Vec<StatementJson>,
}

#[derive(Debug, Serialize)]
struct StatementJson {
    speaker: String,
    text: String,
    index: i32,
}

/// Statistics for the fetch operation
#[derive(Debug, Default)]
struct FetchStats {
    total_entries: usize,
    skipped_procedural: usize,
    skipped_existing: usize,
    fetched: usize,
    failed: usize,
}

/// Run the fetch floor speeches command
pub async fn run(
    year: i32,
    output_dir: &str,
    limit: Option<usize>,
    force: bool,
    dry_run: bool,
) -> Result<()> {
    let yaml_path = format!("data/floor_speeches/floor_speeches_{year}.yaml");

    if !Path::new(&yaml_path).exists() {
        return Err(eyre!(
            "Floor speeches YAML not found: {}. Run congress-events to fetch first.",
            yaml_path
        ));
    }

    // create output directory
    let output_path = Path::new(output_dir);
    if !dry_run {
        fs::create_dir_all(output_path)?;
    }

    println!(
        "{}",
        format!(
            "Fetching floor speech transcripts from {} to {}",
            yaml_path, output_dir
        )
        .cyan()
    );
    if force {
        println!(
            "{}",
            "Force mode enabled - will re-fetch existing files".yellow()
        );
    }

    // load YAML
    let yaml_content = fs::read_to_string(&yaml_path)?;
    let yaml: FloorSpeechesYaml = serde_yaml::from_str(&yaml_content)?;

    let mut stats = FetchStats {
        total_entries: yaml.floor_speeches.len(),
        ..Default::default()
    };

    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()?;

    let entries: Vec<_> = yaml.floor_speeches.into_iter().collect();
    let to_process = limit.unwrap_or(entries.len()).min(entries.len());

    info!(
        "Processing {} of {} floor speeches for year {}",
        to_process, stats.total_entries, year
    );

    for (i, entry) in entries.into_iter().take(to_process).enumerate() {
        // skip procedural titles
        if is_procedural_crec_title(&entry.title) {
            stats.skipped_procedural += 1;
            continue;
        }

        // construct output filename
        let output_file = output_path.join(format!("{}.json", sanitize_filename(&entry.event_id)));

        // skip if exists (unless force)
        if !force && output_file.exists() {
            stats.skipped_existing += 1;
            continue;
        }

        if dry_run {
            println!(
                "[{}/{}] Would fetch: {}",
                i + 1,
                to_process,
                entry.title.chars().take(60).collect::<String>()
            );
            stats.fetched += 1;
            continue;
        }

        // fetch the transcript HTML
        match fetch_and_parse(&client, &entry).await {
            Ok(json) => {
                if json.statements.is_empty() {
                    info!(
                        "[{}/{}] Skipped (no statements): {}",
                        i + 1,
                        to_process,
                        entry.title
                    );
                    stats.skipped_procedural += 1;
                    continue;
                }

                // write JSON output
                let json_str = serde_json::to_string_pretty(&json)?;
                fs::write(&output_file, json_str)?;

                info!(
                    "[{}/{}] Fetched {} ({} statements)",
                    i + 1,
                    to_process,
                    entry.title.chars().take(40).collect::<String>(),
                    json.statements.len()
                );
                stats.fetched += 1;
            }
            Err(e) => {
                warn!("[{}/{}] Failed to fetch {}: {}", i + 1, to_process, entry.title, e);
                stats.failed += 1;
            }
        }

        // rate limiting
        sleep(Duration::from_millis(200)).await;
    }

    // print summary
    println!();
    println!("{}", "Fetch complete:".green().bold());
    println!("  Total entries:      {}", stats.total_entries.to_string().cyan());
    println!(
        "  Skipped procedural: {}",
        stats.skipped_procedural.to_string().yellow()
    );
    println!(
        "  Skipped existing:   {}",
        stats.skipped_existing.to_string().yellow()
    );
    println!("  Fetched:            {}", stats.fetched.to_string().green());
    println!("  Failed:             {}", stats.failed.to_string().red());

    Ok(())
}

/// Fetch and parse a single floor speech
async fn fetch_and_parse(client: &Client, entry: &FloorSpeechEntry) -> Result<FloorSpeechJson> {
    // construct the HTML URL from the transcript URL
    // GovInfo pattern: https://www.govinfo.gov/app/details/CREC-2024-01-17/CREC-2024-01-17-pt1-PgS157
    // HTML: https://www.govinfo.gov/content/pkg/CREC-2024-01-17/html/CREC-2024-01-17-pt1-PgS157.htm

    let html_url = entry
        .transcript
        .replace("/app/details/", "/content/pkg/")
        .replace(&entry.granule_id, &format!("html/{}.htm", entry.granule_id));

    let response = client.get(&html_url).send().await?;

    if !response.status().is_success() {
        return Err(eyre!("HTTP {}: {}", response.status(), html_url));
    }

    let html = response.text().await?;

    // parse the HTML into statements
    let crec_statements = parse_crec_html(&html);

    // extract page type from granule_id
    let page_type = extract_page_type(&entry.granule_id);

    // convert to output format
    let statements: Vec<StatementJson> = crec_statements
        .into_iter()
        .map(|s: CrecStatement| StatementJson {
            speaker: s.speaker,
            text: s.text,
            index: s.index,
        })
        .collect();

    Ok(FloorSpeechJson {
        event_id: entry.event_id.clone(),
        granule_id: entry.granule_id.clone(),
        title: entry.title.clone(),
        date: entry.date.clone(),
        chamber: entry.chamber.clone(),
        page_type,
        source_url: entry.transcript.clone(),
        statements,
    })
}

/// Extract page type (H, S, E, D) from granule ID
fn extract_page_type(granule_id: &str) -> String {
    if let Some(pos) = granule_id.find("Pg") {
        if let Some(ch) = granule_id.chars().nth(pos + 2) {
            return ch.to_string();
        }
    }
    String::new()
}

/// Sanitize filename (remove problematic characters)
fn sanitize_filename(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect()
}
