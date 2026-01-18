//! Ingest floor speech transcripts command

use color_eyre::eyre::Result;
use colored::Colorize;
use polsearch_pipeline::stages::FloorSpeechIngester;
use std::path::Path;

use super::get_database;

/// Run the ingest floor speeches command
pub async fn run(
    path: &str,
    limit: Option<usize>,
    force: bool,
    dry_run: bool,
    validate: bool,
    lancedb_path: &str,
) -> Result<()> {
    let transcript_path = Path::new(path);

    if !transcript_path.exists() {
        return Err(color_eyre::eyre::eyre!(
            "Floor speech directory not found: {}",
            path
        ));
    }

    if validate {
        println!(
            "{}",
            format!("Validating JSON files in {}...", path).cyan()
        );

        let db = get_database().await?;
        let ingester = FloorSpeechIngester::new(db, lancedb_path, force).await?;
        let (valid, invalid) = ingester.validate_directory(transcript_path, limit)?;

        println!();
        println!("{}", "Validation complete:".green().bold());
        println!("  Valid files:   {}", valid.to_string().green());
        println!("  Invalid files: {}", invalid.to_string().red());

        return Ok(());
    }

    if dry_run {
        println!(
            "{}",
            format!("[DRY RUN] Would process files in {}", path).yellow()
        );

        let mut count = 0;
        for entry in std::fs::read_dir(transcript_path)? {
            let entry = entry?;
            if entry.path().extension().is_some_and(|e| e == "json") {
                count += 1;
                if let Some(max) = limit {
                    if count > max {
                        break;
                    }
                }
            }
        }

        println!(
            "Would process {} JSON files{}",
            count.to_string().cyan(),
            if force { " (force mode)" } else { "" }
        );
        return Ok(());
    }

    println!(
        "{}",
        format!("Ingesting floor speeches from {}...", path).cyan()
    );
    if force {
        println!(
            "{}",
            "Force mode enabled - will re-process existing speeches".yellow()
        );
    }

    let db = get_database().await?;
    let mut ingester = FloorSpeechIngester::new(db, lancedb_path, force).await?;
    let stats = ingester.ingest_directory(transcript_path, limit).await?;

    println!();
    println!("{}", "Ingestion complete:".green().bold());
    println!(
        "  Files processed: {}",
        stats.files_processed.to_string().cyan()
    );
    println!(
        "  Files skipped:   {}",
        stats.files_skipped.to_string().yellow()
    );
    println!(
        "  Speeches:        {}",
        stats.speeches_created.to_string().cyan()
    );
    println!(
        "  Statements:      {}",
        stats.statements_created.to_string().cyan()
    );
    println!(
        "  Segments:        {}",
        stats.segments_created.to_string().cyan()
    );
    println!(
        "  Embeddings:      {}",
        stats.embeddings_created.to_string().cyan()
    );

    Ok(())
}
