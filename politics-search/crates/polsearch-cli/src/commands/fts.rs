//! FTS (Full-Text Search) commands for fast text-only ingestion

use color_eyre::eyre::Result;
use colored::Colorize;
use polsearch_pipeline::stages::FtsIngester;
use std::path::Path;
use std::time::Instant;

use super::get_database;

/// Run the FTS ingest command
pub async fn ingest(
    hearings_path: Option<&str>,
    speeches_path: Option<&str>,
    votes: bool,
    limit: Option<usize>,
    force: bool,
    dry_run: bool,
    lancedb_path: &str,
) -> Result<()> {
    if hearings_path.is_none() && speeches_path.is_none() && !votes {
        println!(
            "{}",
            "No sources specified. Use --hearings-path, --speeches-path, and/or --votes".yellow()
        );
        return Ok(());
    }

    if dry_run {
        println!("{}", "[DRY RUN] Would process the following:".yellow());
        if let Some(path) = hearings_path {
            let count = count_json_files(path);
            let limited = limit.map_or(count, |l| l.min(count));
            println!("  Hearings: {} files from {}", limited, path);
        }
        if let Some(path) = speeches_path {
            let count = count_json_files(path);
            let limited = limit.map_or(count, |l| l.min(count));
            println!("  Floor speeches: {} files from {}", limited, path);
        }
        if votes {
            println!("  Votes: from PostgreSQL");
        }
        if force {
            println!("  {} Force mode - will re-process existing content", "[!]".yellow());
        }
        return Ok(());
    }

    let db = get_database().await?;
    let mut ingester = FtsIngester::new(db, lancedb_path, force).await?;

    println!("{}", "Starting FTS ingestion (text-only, no embeddings)...".cyan());
    if force {
        println!("{}", "Force mode enabled - will re-process existing content".yellow());
    }

    let start = Instant::now();
    let mut total_segments = 0;

    // Ingest hearings
    if let Some(path) = hearings_path {
        let hearings_path = Path::new(path);
        if !hearings_path.exists() {
            println!(
                "{}",
                format!("Warning: Hearings directory not found: {path}").yellow()
            );
        } else {
            println!();
            println!("{}", format!("Ingesting hearings from {}...", path).cyan());
            let stats = ingester.ingest_hearings_directory(hearings_path, limit).await?;
            total_segments += stats.segments_created;
            println!(
                "  {} hearings processed, {} skipped, {} segments",
                stats.hearings_processed.to_string().green(),
                stats.hearings_skipped.to_string().yellow(),
                stats.segments_created.to_string().cyan()
            );
        }
    }

    // Ingest floor speeches
    if let Some(path) = speeches_path {
        let speeches_path = Path::new(path);
        if !speeches_path.exists() {
            println!(
                "{}",
                format!("Warning: Floor speeches directory not found: {path}").yellow()
            );
        } else {
            println!();
            println!("{}", format!("Ingesting floor speeches from {}...", path).cyan());
            let stats = ingester.ingest_speeches_directory(speeches_path, limit).await?;
            total_segments += stats.segments_created;
            println!(
                "  {} speeches processed, {} skipped, {} segments",
                stats.speeches_processed.to_string().green(),
                stats.speeches_skipped.to_string().yellow(),
                stats.segments_created.to_string().cyan()
            );
        }
    }

    // Ingest votes from PostgreSQL (if requested)
    if votes {
        println!();
        println!("{}", "Ingesting votes from PostgreSQL...".cyan());
        let vote_stats = ingester.ingest_votes(limit).await?;
        total_segments += vote_stats.segments_created;
        println!(
            "  {} votes processed, {} skipped",
            vote_stats.votes_processed.to_string().green(),
            vote_stats.votes_skipped.to_string().yellow()
        );
    }

    let duration = start.elapsed();
    println!();
    println!("{}", "FTS ingestion complete:".green().bold());
    println!("  Total segments: {}", total_segments.to_string().cyan());
    println!("  Time elapsed:   {:.1}s", duration.as_secs_f64());
    println!();
    println!(
        "{}",
        "Run 'polsearch index' to create FTS indexes".dimmed()
    );

    Ok(())
}

/// Clear/delete the FTS table
pub async fn clear(lancedb_path: &str) -> Result<()> {
    println!("{}", "Clearing FTS table...".yellow());

    let lancedb = lancedb::connect(lancedb_path).execute().await?;

    match lancedb.drop_table("text_fts", &[]).await {
        Ok(()) => {
            println!("{}", "FTS table deleted successfully".green());
        }
        Err(e) => {
            println!("{}", format!("No FTS table to delete: {}", e).yellow());
        }
    }

    Ok(())
}

/// Count JSON files in a directory
fn count_json_files(path: &str) -> usize {
    let path = Path::new(path);
    if !path.is_dir() {
        return 0;
    }

    std::fs::read_dir(path)
        .map(|entries| {
            entries
                .filter_map(Result::ok)
                .filter(|e| e.path().extension().is_some_and(|ext| ext == "json"))
                .count()
        })
        .unwrap_or(0)
}
