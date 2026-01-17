//! Show transcription statistics

use color_eyre::eyre::{Result, bail};
use colored::Colorize;
use polsearch_db::Database;
use polsearch_util::truncate;

use super::get_database;

/// Stats for a single podcast
struct SourceStats {
    name: String,
    total: i32,
    transcribed: i32,
}

impl SourceStats {
    fn progress(&self) -> f64 {
        if self.total == 0 {
            return 0.0;
        }
        f64::from(self.transcribed) / f64::from(self.total) * 100.0
    }
}

pub async fn run(
    podcast_slug: Option<String>,
    from: Option<String>,
    to: Option<String>,
    detailed: bool,
) -> Result<()> {
    let db = get_database().await?;

    // Validate date range: both or neither
    let date_range = match (&from, &to) {
        (Some(f), Some(t)) => Some((f.as_str(), t.as_str())),
        (None, None) => None,
        _ => bail!("Must specify both --from and --to for date range filtering"),
    };

    // Resolve podcast if filtering by name/slug
    let podcast = if let Some(query) = &podcast_slug {
        let p = db
            .podcasts()
            .find_by_fuzzy_match(query)
            .await?
            .ok_or_else(|| color_eyre::eyre::eyre!("No podcast found matching: {query}"))?;
        Some(p)
    } else {
        None
    };

    // Fetch stats based on filters
    let (total, transcribed) = if let Some((from_ym, to_ym)) = date_range {
        let source_id = podcast.as_ref().map(|p| p.id);
        (
            db.episodes()
                .count_in_range(from_ym, to_ym, source_id)
                .await?,
            db.episodes()
                .count_transcribed_in_range(from_ym, to_ym, source_id)
                .await?,
        )
    } else if let Some(ref p) = podcast {
        (
            db.episodes().count_by_source(p.id).await?,
            db.episodes().count_transcribed_by_source(p.id).await?,
        )
    } else {
        (
            db.episodes().count().await?,
            db.episodes().count_transcribed().await?,
        )
    };

    let remaining = total - transcribed;
    let progress = if total > 0 {
        f64::from(transcribed) / f64::from(total) * 100.0
    } else {
        0.0
    };

    // Print header with context
    println!("{}", "=== Transcription Stats ===".cyan().bold());

    if let Some(ref p) = podcast {
        println!("Source: {} ({})", p.name.cyan(), p.slug);
    }
    if let Some((from_ym, to_ym)) = date_range {
        println!("Range: {} to {}", from_ym, to_ym);
    }
    if podcast.is_some() || date_range.is_some() {
        println!();
    }

    // Summary stats
    println!("Total Contents: {}", total.to_string().cyan());
    println!(
        "Transcribed:    {} ({:.1}%)",
        transcribed.to_string().green(),
        progress
    );
    println!("Remaining:      {}", remaining.to_string().yellow());

    // Detailed per-podcast breakdown
    if detailed && podcast.is_none() {
        println!();
        print_detailed_breakdown(&db, date_range).await?;
    }

    Ok(())
}

async fn print_detailed_breakdown(db: &Database, date_range: Option<(&str, &str)>) -> Result<()> {
    let rows = if let Some((from_ym, to_ym)) = date_range {
        db.episodes()
            .get_stats_by_source_in_range(from_ym, to_ym)
            .await?
    } else {
        db.episodes().get_stats_by_source().await?
    };

    let stats: Vec<SourceStats> = rows
        .into_iter()
        .map(|(name, _slug, total, transcribed)| SourceStats {
            name,
            total: i32::try_from(total).unwrap_or(i32::MAX),
            transcribed: i32::try_from(transcribed).unwrap_or(i32::MAX),
        })
        .collect();

    if stats.is_empty() {
        println!("{}", "No podcast data found".yellow());
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

    for stat in &stats {
        let progress_str = format!("{:.1}%", stat.progress());
        println!(
            "{:<40} {:>8} {:>12} {:>8}",
            truncate(&stat.name, 38),
            stat.total,
            stat.transcribed,
            progress_str
        );
    }

    println!("{}", "-".repeat(72).dimmed());
    println!("{} {} podcasts", "Total:".green().bold(), stats.len());

    Ok(())
}
