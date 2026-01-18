//! Fetch floor speech transcripts from `GovInfo`

use color_eyre::eyre::{eyre, Result};
use colored::Colorize;
use futures::{stream, StreamExt};
use indicatif::{ProgressBar, ProgressStyle};
use polsearch_pipeline::stages::{is_procedural_crec_title, parse_crec_html, CrecStatement};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::time::sleep;

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
#[derive(Debug, Clone, Deserialize)]
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

/// Run the fetch floor speeches command
pub async fn run(
    year: i32,
    output_dir: &str,
    limit: Option<usize>,
    force: bool,
    dry_run: bool,
    concurrency: usize,
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
    println!(
        "{}",
        format!("Concurrency: {} requests", concurrency).cyan()
    );

    // load YAML
    let yaml_content = fs::read_to_string(&yaml_path)?;
    let yaml: FloorSpeechesYaml = serde_yaml::from_str(&yaml_content)?;

    let total_entries = yaml.floor_speeches.len();
    let skipped_procedural = AtomicUsize::new(0);
    let skipped_existing = AtomicUsize::new(0);

    let client = Client::builder()
        .timeout(Duration::from_secs(30))
        .build()?;

    // pre-filter entries: remove procedural and (optionally) existing files
    let entries_to_fetch: Vec<_> = yaml
        .floor_speeches
        .into_iter()
        .take(limit.unwrap_or(usize::MAX))
        .filter(|entry| {
            if is_procedural_crec_title(&entry.title) {
                skipped_procedural.fetch_add(1, Ordering::Relaxed);
                return false;
            }

            let output_file =
                output_path.join(format!("{}.json", sanitize_filename(&entry.event_id)));
            if !force && output_file.exists() {
                skipped_existing.fetch_add(1, Ordering::Relaxed);
                return false;
            }

            true
        })
        .collect();

    let to_fetch = entries_to_fetch.len();
    let skipped_procedural_count = skipped_procedural.load(Ordering::Relaxed);
    let skipped_existing_count = skipped_existing.load(Ordering::Relaxed);

    println!(
        "Found {} speeches to fetch ({} procedural, {} existing skipped)",
        to_fetch.to_string().cyan(),
        skipped_procedural_count.to_string().yellow(),
        skipped_existing_count.to_string().yellow()
    );

    if to_fetch == 0 {
        println!("{}", "Nothing to fetch".green());
        return Ok(());
    }

    // create progress bar
    let pb = ProgressBar::new(to_fetch as u64);
    pb.set_style(
        ProgressStyle::default_bar()
            .template("[{elapsed_precise}<{eta_precise}] {bar:40.cyan/blue} {pos}/{len} {msg}")?
            .progress_chars("━━░"),
    );

    // atomic counters for concurrent access
    let fetched = Arc::new(AtomicUsize::new(0));
    let failed = Arc::new(AtomicUsize::new(0));
    let skipped_empty = Arc::new(AtomicUsize::new(0));

    // process entries concurrently
    let output_path_buf = output_path.to_path_buf();
    let _results: Vec<_> = stream::iter(entries_to_fetch)
        .map(|entry| {
            let client = client.clone();
            let output_path = output_path_buf.clone();
            let pb = pb.clone();
            let fetched = fetched.clone();
            let failed = failed.clone();
            let skipped_empty = skipped_empty.clone();

            async move {
                fetch_single(
                    &client,
                    entry,
                    &output_path,
                    dry_run,
                    &pb,
                    &fetched,
                    &failed,
                    &skipped_empty,
                )
                .await
            }
        })
        .buffer_unordered(concurrency)
        .collect()
        .await;

    pb.finish_with_message("Done");

    // print summary
    let fetched_count = fetched.load(Ordering::Relaxed);
    let failed_count = failed.load(Ordering::Relaxed);
    let skipped_empty_count = skipped_empty.load(Ordering::Relaxed);

    println!();
    println!("{}", "Fetch complete:".green().bold());
    println!("  Total entries:      {}", total_entries.to_string().cyan());
    println!(
        "  Skipped procedural: {}",
        (skipped_procedural_count + skipped_empty_count)
            .to_string()
            .yellow()
    );
    println!(
        "  Skipped existing:   {}",
        skipped_existing_count.to_string().yellow()
    );
    println!("  Fetched:            {}", fetched_count.to_string().green());
    println!("  Failed:             {}", failed_count.to_string().red());

    Ok(())
}

/// Fetch a single floor speech with retry logic
#[allow(clippy::too_many_arguments)]
async fn fetch_single(
    client: &Client,
    entry: FloorSpeechEntry,
    output_path: &Path,
    dry_run: bool,
    pb: &ProgressBar,
    fetched: &Arc<AtomicUsize>,
    failed: &Arc<AtomicUsize>,
    skipped_empty: &Arc<AtomicUsize>,
) {
    let title_short: String = entry.title.chars().take(50).collect();
    let output_file = output_path.join(format!("{}.json", sanitize_filename(&entry.event_id)));

    if dry_run {
        pb.println(format!("Would fetch: {}", title_short));
        fetched.fetch_add(1, Ordering::Relaxed);
        pb.inc(1);
        return;
    }

    // fetch with retry
    match fetch_with_retry(client, &entry).await {
        Ok(json) => {
            if json.statements.is_empty() {
                pb.println(format!("{} (no statements): {}", "Skipped".yellow(), title_short));
                skipped_empty.fetch_add(1, Ordering::Relaxed);
                pb.inc(1);
                return;
            }

            // write JSON output
            match serde_json::to_string_pretty(&json) {
                Ok(json_str) => {
                    if let Err(e) = fs::write(&output_file, json_str) {
                        pb.println(format!("{} {}: {}", "Write failed".red(), title_short, e));
                        failed.fetch_add(1, Ordering::Relaxed);
                    } else {
                        pb.println(format!(
                            "{} {} ({} statements)",
                            "Fetched".green(),
                            title_short,
                            json.statements.len()
                        ));
                        fetched.fetch_add(1, Ordering::Relaxed);
                    }
                }
                Err(e) => {
                    pb.println(format!("{} {}: {}", "Serialize failed".red(), title_short, e));
                    failed.fetch_add(1, Ordering::Relaxed);
                }
            }
        }
        Err(e) => {
            pb.println(format!("{} {}: {}", "Failed".red(), title_short, e));
            failed.fetch_add(1, Ordering::Relaxed);
        }
    }

    pb.inc(1);
}

/// Fetch with exponential backoff retry on rate limit or server errors
async fn fetch_with_retry(client: &Client, entry: &FloorSpeechEntry) -> Result<FloorSpeechJson> {
    let mut delay = Duration::from_secs(1);

    for attempt in 0..3 {
        match fetch_and_parse(client, entry).await {
            Ok(json) => return Ok(json),
            Err(e) => {
                let error_str = e.to_string();
                let is_retryable = error_str.contains("429")
                    || error_str.contains("500")
                    || error_str.contains("502")
                    || error_str.contains("503")
                    || error_str.contains("504");

                if !is_retryable || attempt == 2 {
                    return Err(e);
                }

                sleep(delay).await;
                delay *= 2;
            }
        }
    }

    unreachable!()
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
