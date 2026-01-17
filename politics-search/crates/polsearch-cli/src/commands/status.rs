//! Show global progress and active batches

use color_eyre::eyre::Result;
use colored::Colorize;
use polsearch_core::BatchStatus;

use super::get_database;

pub async fn run() -> Result<()> {
    let db = get_database().await?;

    // Global stats
    let total_episodes = db.episodes().count().await?;
    let transcribed_episodes = db.episodes().count_transcribed().await?;
    let total_podcasts = db.podcasts().count().await?;

    let global_progress = if total_episodes > 0 {
        100.0 * f64::from(transcribed_episodes) / f64::from(total_episodes)
    } else {
        0.0
    };

    println!("{}", "=== Global Progress ===".cyan().bold());
    println!("Sources: {}", total_podcasts.to_string().cyan());
    println!(
        "Contents: {} / {} ({:.1}%)",
        transcribed_episodes.to_string().cyan(),
        total_episodes,
        global_progress
    );

    // Active batches (running)
    let running_batches = db.batches().get_running().await?;
    if !running_batches.is_empty() {
        println!("\n{}", "=== Running Batches ===".cyan().bold());
        for batch in &running_batches {
            println!(
                "  {} - {}/{} ({:.1}%)",
                batch.name.cyan(),
                batch.completed_episodes + batch.failed_episodes,
                batch.total_episodes,
                batch.progress()
            );
            if batch.failed_episodes > 0 {
                println!("    {}: {}", "Failed".red(), batch.failed_episodes);
            }
        }
    }

    // Pending batches
    let pending_batches = db.batches().get_pending().await?;
    if !pending_batches.is_empty() {
        println!("\n{}", "=== Pending Batches ===".cyan().bold());
        for batch in &pending_batches {
            println!(
                "  {} - {} episodes",
                batch.name.dimmed(),
                batch.total_episodes
            );
        }
    }

    // Recent completed batches (last 5)
    let all_batches = db.batches().get_all().await?;
    let completed: Vec<_> = all_batches
        .iter()
        .filter(|b| b.batch_status() == BatchStatus::Completed)
        .take(5)
        .collect();

    if !completed.is_empty() {
        println!("\n{}", "=== Recently Completed ===".cyan().bold());
        for batch in completed {
            println!(
                "  {} - {}/{} ({:.1}% success)",
                batch.name.green(),
                batch.completed_episodes,
                batch.total_episodes,
                batch.success_rate()
            );
        }
    }

    Ok(())
}
