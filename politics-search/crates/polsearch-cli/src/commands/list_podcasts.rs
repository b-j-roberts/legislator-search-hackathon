//! List all podcasts with episode counts

use color_eyre::eyre::Result;
use colored::Colorize;
use polsearch_util::truncate;

use super::get_database;

pub async fn run() -> Result<()> {
    let db = get_database().await?;

    // Get stats with counts computed via JOIN
    let stats = db.episodes().get_stats_by_source().await?;

    if stats.is_empty() {
        println!(
            "{}",
            "No podcasts found. Run 'polsearch seed' first.".yellow()
        );
        return Ok(());
    }

    println!(
        "{:<40} {:>8} {:>12} {:>8}",
        "Name".cyan().bold(),
        "Contents".cyan().bold(),
        "Transcribed".cyan().bold(),
        "Progress".cyan().bold()
    );
    println!("{}", "-".repeat(72).dimmed());

    for (name, _slug, total, transcribed) in &stats {
        let progress = if *total == 0 {
            0.0
        } else {
            *transcribed as f64 / *total as f64 * 100.0
        };
        println!(
            "{:<40} {:>8} {:>12} {:>7.1}%",
            truncate(name, 38),
            total,
            transcribed,
            progress
        );
    }

    println!("{}", "-".repeat(72).dimmed());
    println!("{} {} podcasts", "Total:".green().bold(), stats.len());

    Ok(())
}
