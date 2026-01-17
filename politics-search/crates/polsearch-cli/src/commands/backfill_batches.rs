//! Backfill transcription batch status and counts from task data

use color_eyre::eyre::Result;
use colored::Colorize;
use polsearch_core::BatchStatus;

use super::get_database;

pub async fn run() -> Result<()> {
    let db = get_database().await?;

    let batches = db.batches().get_all().await?;

    if batches.is_empty() {
        println!("{}", "No batches found".dimmed());
        return Ok(());
    }

    println!(
        "Found {} batches to check",
        batches.len().to_string().cyan()
    );

    let mut completed_count = 0;
    let mut updated_count = 0;

    for batch in &batches {
        let has_pending = db.tasks().has_pending_for_batch(batch.id).await?;
        let (completed, failed) = db.tasks().count_final_for_batch(batch.id).await?;

        let current_status = batch.batch_status();

        if !has_pending && current_status != BatchStatus::Completed {
            db.batches()
                .complete_with_counts(batch.id, completed, failed)
                .await?;
            println!(
                "  {} {} ({} completed, {} failed)",
                "Completed:".green(),
                batch.name,
                completed,
                failed
            );
            completed_count += 1;
        } else if has_pending {
            if batch.completed_episodes != completed || batch.failed_episodes != failed {
                db.batches()
                    .update_counts(batch.id, completed, failed)
                    .await?;
                println!(
                    "  {} {} ({} completed, {} failed, still pending)",
                    "Updated:".yellow(),
                    batch.name,
                    completed,
                    failed
                );
                updated_count += 1;
            } else {
                println!(
                    "  {} {} ({} completed, {} failed, still pending)",
                    "Unchanged:".dimmed(),
                    batch.name,
                    completed,
                    failed
                );
            }
        } else {
            println!(
                "  {} {} ({} completed, {} failed)",
                "Already complete:".dimmed(),
                batch.name,
                completed,
                failed
            );
        }
    }

    println!("{}", "Backfill complete:".green().bold());
    println!(
        "  Marked completed: {}",
        completed_count.to_string().green()
    );
    println!("  Updated counts: {}", updated_count.to_string().yellow());

    Ok(())
}
