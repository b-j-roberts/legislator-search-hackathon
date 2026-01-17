use clap::{Parser, Subcommand};
use color_eyre::eyre::{Context, Result};
use std::path::{Path, PathBuf};

mod congress_api;
mod govinfo;
mod models;
mod output;
mod transcript_parser;

use congress_api::{load_hearings_from_yaml, HearingsStats};
use govinfo::GovInfoClient;
use models::Event;
use output::{write_floor_speeches, write_hearings, write_master_list};
use transcript_parser::TranscriptFetcher;

#[derive(Parser)]
#[command(name = "congress-events")]
#[command(about = "Master list of congressional events with transcript status")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Fetch floor speeches from GovInfo CREC collection
    FloorSpeeches {
        /// Start date (YYYY-MM-DD)
        #[arg(long, default_value = "2020-01-01")]
        start_date: String,

        /// End date (YYYY-MM-DD)
        #[arg(long, default_value = "2026-12-31")]
        end_date: String,

        /// Output file path
        #[arg(short, long, default_value = "floor_speeches.yaml")]
        output: PathBuf,
    },

    /// Fetch hearings from GovInfo CHRG collection
    FetchHearings {
        /// Start date (YYYY-MM-DD)
        #[arg(long, default_value = "2020-01-01")]
        start_date: String,

        /// End date (YYYY-MM-DD)
        #[arg(long, default_value = "2026-12-31")]
        end_date: String,

        /// Output file path
        #[arg(short, long, default_value = "hearings.yaml")]
        output: PathBuf,
    },

    /// Load hearings from existing YAML and convert to our format
    Hearings {
        /// Path to existing hearings YAML file
        #[arg(short, long)]
        input: PathBuf,

        /// Output file path
        #[arg(short, long, default_value = "hearings.yaml")]
        output: PathBuf,
    },

    /// Merge floor speeches and hearings into master list
    Merge {
        /// Path to floor speeches YAML
        #[arg(long)]
        speeches: Option<PathBuf>,

        /// Path to hearings YAML (existing format from Python fetcher)
        #[arg(long)]
        hearings: PathBuf,

        /// Paths to media appearance YAML files (can specify multiple)
        #[arg(long)]
        media: Vec<PathBuf>,

        /// Output file path for master list
        #[arg(short, long, default_value = "master_congressional_events.yaml")]
        output: PathBuf,

        /// Start date for floor speeches (YYYY-MM-DD)
        #[arg(long, default_value = "2020-01-01")]
        start_date: String,

        /// End date for floor speeches (YYYY-MM-DD)
        #[arg(long, default_value = "2026-12-31")]
        end_date: String,

        /// Skip fetching floor speeches (use existing file or skip entirely)
        #[arg(long)]
        skip_speeches: bool,
    },

    /// Show statistics about hearings
    Stats {
        /// Path to hearings YAML file
        #[arg(short, long)]
        input: PathBuf,
    },

    /// Parse transcripts from hearings into structured JSON
    ParseTranscripts {
        /// Path to hearings YAML file
        #[arg(short, long)]
        input: PathBuf,

        /// Output directory for JSON files
        #[arg(short, long, default_value = "transcripts")]
        output_dir: PathBuf,

        /// Maximum number of transcripts to parse (for testing)
        #[arg(long)]
        limit: Option<usize>,

        /// Skip transcripts that already exist in output directory
        #[arg(long)]
        skip_existing: bool,
    },
}

fn main() -> Result<()> {
    color_eyre::install()?;

    let cli = Cli::parse();

    match cli.command {
        Commands::FloorSpeeches {
            start_date,
            end_date,
            output,
        } => {
            fetch_floor_speeches(&start_date, &end_date, &output)?;
        }

        Commands::FetchHearings {
            start_date,
            end_date,
            output,
        } => {
            fetch_hearings_from_govinfo(&start_date, &end_date, &output)?;
        }

        Commands::Hearings { input, output } => {
            convert_hearings(&input, &output)?;
        }

        Commands::Merge {
            speeches,
            hearings,
            media,
            output,
            start_date,
            end_date,
            skip_speeches,
        } => {
            merge_events(
                speeches.as_deref(),
                &hearings,
                &media,
                &output,
                &start_date,
                &end_date,
                skip_speeches,
            )?;
        }

        Commands::Stats { input } => {
            show_stats(&input)?;
        }

        Commands::ParseTranscripts {
            input,
            output_dir,
            limit,
            skip_existing,
        } => {
            parse_transcripts(&input, &output_dir, limit, skip_existing)?;
        }
    }

    Ok(())
}

fn get_api_key() -> Result<String> {
    std::env::var("CONGRESS_API_KEY")
        .wrap_err("CONGRESS_API_KEY environment variable not set.\nGet a free API key at: https://api.data.gov/signup/")
}

fn fetch_floor_speeches(start_date: &str, end_date: &str, output: &PathBuf) -> Result<()> {
    let api_key = get_api_key()?;
    let client = GovInfoClient::new(api_key);

    eprintln!("Fetching floor speeches from {} to {}...", start_date, end_date);

    let speeches = client.fetch_floor_speeches(start_date, end_date, |current, total| {
        eprint!("\r  Processing package {}/{}...", current, total);
    })?;
    eprintln!();

    eprintln!("Total floor speeches: {}", speeches.len());
    eprintln!(
        "With transcript: {} ({}%)",
        speeches.iter().filter(|s| s.transcript.is_some()).count(),
        if speeches.is_empty() {
            0
        } else {
            speeches.iter().filter(|s| s.transcript.is_some()).count() * 100 / speeches.len()
        }
    );

    write_floor_speeches(&speeches, output)?;
    eprintln!("Output written to: {}", output.display());

    Ok(())
}

fn fetch_hearings_from_govinfo(start_date: &str, end_date: &str, output: &PathBuf) -> Result<()> {
    let api_key = get_api_key()?;
    let client = GovInfoClient::new(api_key);

    eprintln!("Fetching hearings from {} to {}...", start_date, end_date);

    let hearings = client.fetch_hearings(start_date, end_date, |current, total| {
        eprint!("\r  Processing hearing {}/{}...", current, total);
    })?;
    eprintln!();

    eprintln!("Total hearings: {}", hearings.len());
    eprintln!(
        "With transcript: {} ({}%)",
        hearings.iter().filter(|h| h.transcript.is_some()).count(),
        if hearings.is_empty() {
            0
        } else {
            hearings.iter().filter(|h| h.transcript.is_some()).count() * 100 / hearings.len()
        }
    );

    write_hearings(&hearings, output)?;
    eprintln!("Output written to: {}", output.display());

    Ok(())
}

fn convert_hearings(input: &PathBuf, output: &PathBuf) -> Result<()> {
    eprintln!("Loading hearings from {}...", input.display());

    let hearings = load_hearings_from_yaml(input)?;
    let stats = HearingsStats::from_hearings(&hearings);

    eprintln!("Total hearings: {}", stats.total);
    eprintln!(
        "With transcript: {} ({:.1}%)",
        stats.with_transcript,
        if stats.total == 0 {
            0.0
        } else {
            stats.with_transcript as f64 / stats.total as f64 * 100.0
        }
    );
    eprintln!(
        "With video: {} ({:.1}%)",
        stats.with_video,
        if stats.total == 0 {
            0.0
        } else {
            stats.with_video as f64 / stats.total as f64 * 100.0
        }
    );

    write_hearings(&hearings, output)?;
    eprintln!("Output written to: {}", output.display());

    Ok(())
}

fn merge_events(
    speeches_path: Option<&Path>,
    hearings_path: &Path,
    media_paths: &[PathBuf],
    output: &Path,
    start_date: &str,
    end_date: &str,
    skip_speeches: bool,
) -> Result<()> {
    let mut events: Vec<Event> = Vec::new();

    // Load hearings
    eprintln!("Loading hearings from {}...", hearings_path.display());
    let hearings = load_hearings_from_yaml(hearings_path)?;
    let hearings_count = hearings.len();
    events.extend(hearings.into_iter().map(Event::Hearing));
    eprintln!("  Loaded {} hearings", hearings_count);

    // Load or fetch floor speeches
    if !skip_speeches {
        if let Some(speeches_file) = speeches_path {
            // Load from existing file
            eprintln!("Loading floor speeches from {}...", speeches_file.display());
            let content = std::fs::read_to_string(speeches_file)
                .wrap_err_with(|| format!("Failed to read {}", speeches_file.display()))?;

            #[derive(serde::Deserialize)]
            struct SpeechesYaml {
                floor_speeches: Vec<models::FloorSpeech>,
            }

            let yaml: SpeechesYaml = serde_yaml::from_str(&content)?;
            let count = yaml.floor_speeches.len();
            events.extend(yaml.floor_speeches.into_iter().map(Event::FloorSpeech));
            eprintln!("  Loaded {} floor speeches", count);
        } else {
            // Fetch from API
            let api_key = get_api_key()?;
            let client = GovInfoClient::new(api_key);

            eprintln!(
                "Fetching floor speeches from {} to {}...",
                start_date, end_date
            );
            let speeches =
                client.fetch_floor_speeches(start_date, end_date, |current, total| {
                    eprint!("\r  Processing package {}/{}...", current, total);
                })?;
            eprintln!();

            let count = speeches.len();
            events.extend(speeches.into_iter().map(Event::FloorSpeech));
            eprintln!("  Fetched {} floor speeches", count);
        }
    }

    // Load media appearances from YAML files
    for media_path in media_paths {
        eprintln!("Loading media appearances from {}...", media_path.display());
        let content = std::fs::read_to_string(media_path)
            .wrap_err_with(|| format!("Failed to read {}", media_path.display()))?;

        let media_output: media_common::MediaAppearanceOutput = serde_yaml::from_str(&content)
            .wrap_err_with(|| format!("Failed to parse {}", media_path.display()))?;

        let count = media_output.appearances.len();
        events.extend(
            media_output
                .appearances
                .into_iter()
                .map(Event::MediaAppearance),
        );
        eprintln!("  Loaded {} media appearances", count);
    }

    // Sort events by date (most recent first)
    events.sort_by(|a, b| b.date_string().cmp(&a.date_string()));

    // Calculate statistics
    let total = events.len();
    let with_transcript = events.iter().filter(|e| e.has_transcript()).count();
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

    eprintln!();
    eprintln!("=== Master List Summary ===");
    eprintln!("Total events: {}", total);
    eprintln!("  Floor speeches: {}", floor_speeches);
    eprintln!("  Hearings: {}", hearings);
    eprintln!("  Media appearances: {}", media_appearances);
    eprintln!(
        "With transcript: {} ({:.1}%)",
        with_transcript,
        if total == 0 {
            0.0
        } else {
            with_transcript as f64 / total as f64 * 100.0
        }
    );
    eprintln!(
        "Without transcript: {} ({:.1}%)",
        total - with_transcript,
        if total == 0 {
            0.0
        } else {
            (total - with_transcript) as f64 / total as f64 * 100.0
        }
    );

    write_master_list(&events, output)?;
    eprintln!();
    eprintln!("Output written to: {}", output.display());

    Ok(())
}

fn show_stats(input: &PathBuf) -> Result<()> {
    eprintln!("Loading hearings from {}...", input.display());

    let hearings = load_hearings_from_yaml(input)?;
    let stats = HearingsStats::from_hearings(&hearings);

    // Calculate combination stats
    let with_both = hearings.iter().filter(|h| h.transcript.is_some() && h.video.is_some()).count();
    let transcript_only = hearings.iter().filter(|h| h.transcript.is_some() && h.video.is_none()).count();
    let video_only = hearings.iter().filter(|h| h.transcript.is_none() && h.video.is_some()).count();
    let with_neither = hearings.iter().filter(|h| h.transcript.is_none() && h.video.is_none()).count();

    let pct = |n: usize| -> f64 {
        if stats.total == 0 { 0.0 } else { n as f64 / stats.total as f64 * 100.0 }
    };

    println!("=== Hearings Statistics ===");
    println!("Total hearings: {}", stats.total);
    println!();
    println!("Transcript availability:");
    println!("  With transcript:    {:>5} ({:>5.1}%)", stats.with_transcript, pct(stats.with_transcript));
    println!("  Without transcript: {:>5} ({:>5.1}%)", stats.without_transcript, pct(stats.without_transcript));
    println!();
    println!("Video availability:");
    println!("  With video:    {:>5} ({:>5.1}%)", stats.with_video, pct(stats.with_video));
    println!("  Without video: {:>5} ({:>5.1}%)", stats.without_video, pct(stats.without_video));
    println!();
    println!("Combined availability:");
    println!("  Both transcript & video: {:>5} ({:>5.1}%)", with_both, pct(with_both));
    println!("  Transcript only:         {:>5} ({:>5.1}%)", transcript_only, pct(transcript_only));
    println!("  Video only:              {:>5} ({:>5.1}%)", video_only, pct(video_only));
    println!("  Neither:                 {:>5} ({:>5.1}%)", with_neither, pct(with_neither));

    // Show date distribution for hearings with neither
    if with_neither > 0 {
        let mut neither_dates: Vec<_> = hearings
            .iter()
            .filter(|h| h.transcript.is_none() && h.video.is_none())
            .map(|h| h.date.as_str())
            .collect();
        neither_dates.sort();

        println!();
        println!("=== Hearings With Neither Transcript Nor Video ===");
        println!("Date range: {} to {}", neither_dates.first().unwrap_or(&"?"), neither_dates.last().unwrap_or(&"?"));

        // Group by year
        let mut by_year: std::collections::HashMap<&str, usize> = std::collections::HashMap::new();
        for date in &neither_dates {
            let year = &date[..4.min(date.len())];
            *by_year.entry(year).or_insert(0) += 1;
        }
        let mut years: Vec<_> = by_year.into_iter().collect();
        years.sort_by_key(|(y, _)| *y);
        println!("By year:");
        for (year, count) in years {
            println!("  {}: {}", year, count);
        }
    }

    // Note about video duration
    println!();
    println!("Note: Video duration data not available in source (would require fetching each video page)");

    Ok(())
}

fn parse_transcripts(
    input: &Path,
    output_dir: &Path,
    limit: Option<usize>,
    skip_existing: bool,
) -> Result<()> {
    use rayon::prelude::*;
    use std::sync::atomic::{AtomicUsize, Ordering};

    eprintln!("Loading hearings from {}...", input.display());
    let hearings = load_hearings_from_yaml(input)?;

    // Filter to hearings with transcripts
    let with_transcript: Vec<_> = hearings
        .into_iter()
        .filter(|h| h.transcript.is_some())
        .collect();

    eprintln!(
        "Found {} hearings with transcripts",
        with_transcript.len()
    );

    // Apply limit if specified
    let to_process: Vec<_> = match limit {
        Some(n) => with_transcript.into_iter().take(n).collect(),
        None => with_transcript,
    };

    // Filter out existing files if skip_existing
    let to_process: Vec<_> = if skip_existing {
        to_process
            .into_iter()
            .filter(|h| {
                if let Some(url) = &h.transcript {
                    if let Some(package_id) = TranscriptFetcher::extract_package_id(url) {
                        let output_file = output_dir.join(format!("{}.json", package_id));
                        return !output_file.exists();
                    }
                }
                true
            })
            .collect()
    } else {
        to_process
    };

    eprintln!("Will parse {} transcripts (using parallel processing)", to_process.len());

    if to_process.is_empty() {
        eprintln!("Nothing to process.");
        return Ok(());
    }

    // Create output directory
    std::fs::create_dir_all(output_dir)
        .wrap_err_with(|| format!("Failed to create output directory: {}", output_dir.display()))?;

    let success_count = AtomicUsize::new(0);
    let error_count = AtomicUsize::new(0);
    let processed_count = AtomicUsize::new(0);
    let total = to_process.len();
    let output_dir = output_dir.to_path_buf();

    // Process in parallel
    to_process.par_iter().for_each(|hearing| {
        let fetcher = TranscriptFetcher::new();
        let transcript_url = hearing.transcript.as_ref().unwrap();

        let package_id = match TranscriptFetcher::extract_package_id(transcript_url) {
            Some(id) => id,
            None => {
                error_count.fetch_add(1, Ordering::Relaxed);
                return;
            }
        };

        let output_file = output_dir.join(format!("{}.json", package_id));
        let current = processed_count.fetch_add(1, Ordering::Relaxed) + 1;

        eprint!("\r  [{}/{}] Parsing {}...                    ", current, total, package_id);

        match fetcher.parse_hearing_transcript(hearing) {
            Ok(Some(parsed)) => {
                match serde_json::to_string_pretty(&parsed) {
                    Ok(json) => {
                        if std::fs::write(&output_file, json).is_ok() {
                            success_count.fetch_add(1, Ordering::Relaxed);
                        } else {
                            error_count.fetch_add(1, Ordering::Relaxed);
                        }
                    }
                    Err(_) => {
                        error_count.fetch_add(1, Ordering::Relaxed);
                    }
                }
            }
            Ok(None) => {
                error_count.fetch_add(1, Ordering::Relaxed);
            }
            Err(e) => {
                eprintln!("\n  Error parsing {}: {}", package_id, e);
                error_count.fetch_add(1, Ordering::Relaxed);
            }
        }
    });

    eprintln!();
    eprintln!();
    eprintln!("=== Parsing Complete ===");
    eprintln!("Successfully parsed: {}", success_count.load(Ordering::Relaxed));
    eprintln!("Errors:              {}", error_count.load(Ordering::Relaxed));
    eprintln!("Output directory:    {}", output_dir.display());

    Ok(())
}
