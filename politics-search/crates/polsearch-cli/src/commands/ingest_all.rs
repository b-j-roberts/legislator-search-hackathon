//! Ingest all content in priority order (newest first, hearings before speeches)

use color_eyre::eyre::Result;
use colored::Colorize;
use indicatif::{ProgressBar, ProgressStyle};
use polsearch_pipeline::stages::{FloorSpeechIngester, HearingIngester};
use std::fs;
use std::path::Path;

use super::get_database;

/// Count JSON files in a directory
fn count_json_files(path: &Path) -> usize {
    if !path.exists() || !path.is_dir() {
        return 0;
    }

    fs::read_dir(path)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .filter(|e| e.path().extension().is_some_and(|ext| ext == "json"))
                .count()
        })
        .unwrap_or(0)
}

/// Run the ingest-all command
pub async fn run(
    start_year: i32,
    end_year: i32,
    hearings_path: &str,
    speeches_path: &str,
    force: bool,
    lancedb_path: &str,
) -> Result<()> {
    let hearings_dir = Path::new(hearings_path);
    let speeches_dir = Path::new(speeches_path);

    if !hearings_dir.exists() {
        println!(
            "{}",
            format!("Warning: Hearings directory not found: {}", hearings_path).yellow()
        );
    }
    if !speeches_dir.exists() {
        println!(
            "{}",
            format!("Warning: Speeches directory not found: {}", speeches_path).yellow()
        );
    }

    println!(
        "{}",
        format!(
            "Ingesting all content from {} to {} (newest first, hearings before speeches)",
            start_year, end_year
        )
        .cyan()
        .bold()
    );
    if force {
        println!(
            "{}",
            "Force mode enabled - will re-process existing content".yellow()
        );
    }

    // Count total files for progress bar
    let hearings_count = count_json_files(hearings_dir);
    let speeches_count = count_json_files(speeches_dir);
    let total_files = hearings_count + speeches_count;

    println!(
        "Found {} hearings and {} speeches ({} total files)",
        hearings_count.to_string().cyan(),
        speeches_count.to_string().cyan(),
        total_files.to_string().green()
    );
    println!();

    // Create progress bar
    let pb = ProgressBar::new(total_files as u64);
    pb.set_style(
        ProgressStyle::default_bar()
            .template("[{elapsed_precise}<{eta_precise}] {bar:40.cyan/blue} {pos}/{len} {msg}")?
            .progress_chars("━━░"),
    );

    let mut total_hearings = 0;
    let mut total_speeches = 0;
    let mut total_embeddings = 0;

    for year in (end_year..=start_year).rev() {
        // Hearings first
        if hearings_dir.exists() {
            pb.set_message(format!("{} hearings", year));

            let db = get_database().await?;
            let mut ingester = HearingIngester::new(db, lancedb_path, force, Some(year)).await?;

            let stats = ingester
                .ingest_directory_with_progress(hearings_dir, None, Some(&pb))
                .await?;

            total_hearings += stats.hearings_created;
            total_embeddings += stats.embeddings_created;
        }

        // Then speeches
        if speeches_dir.exists() {
            pb.set_message(format!("{} speeches", year));

            let db = get_database().await?;
            let mut ingester =
                FloorSpeechIngester::new(db, lancedb_path, force, Some(year)).await?;

            let stats = ingester
                .ingest_directory_with_progress(speeches_dir, None, Some(&pb))
                .await?;

            total_speeches += stats.speeches_created;
            total_embeddings += stats.embeddings_created;
        }
    }

    pb.finish_with_message("Done");

    println!();
    println!("{}", "━━━ Summary ━━━".green().bold());
    println!(
        "  Total hearings:   {}",
        total_hearings.to_string().cyan()
    );
    println!(
        "  Total speeches:   {}",
        total_speeches.to_string().cyan()
    );
    println!(
        "  Total embeddings: {}",
        total_embeddings.to_string().cyan()
    );

    Ok(())
}
