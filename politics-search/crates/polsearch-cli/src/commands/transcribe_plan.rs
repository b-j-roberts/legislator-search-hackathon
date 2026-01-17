//! Create a transcription batch for episodes

use color_eyre::eyre::{Result, bail};
use colored::Colorize;
use polsearch_core::{TranscriptionBatch, TranscriptionTask};
use polsearch_util::{batch_name_from_month, batch_name_from_range, batch_name_from_year};

use super::get_database;

pub async fn run(
    month: Option<String>,
    year: Option<i32>,
    from: Option<String>,
    to: Option<String>,
    podcast_slug: Option<String>,
    priority: i32,
) -> Result<()> {
    let db = get_database().await?;

    // Determine the date range and batch name
    let (from_ym, to_ym, batch_name) = match (month, year, from, to) {
        (Some(m), None, None, None) => {
            // Single month
            (m.clone(), m.clone(), batch_name_from_month(&m))
        }
        (None, Some(y), None, None) => {
            // Entire year
            let from = format!("{y}-01");
            let to = format!("{y}-12");
            (from, to, batch_name_from_year(y))
        }
        (None, None, Some(f), Some(t)) => {
            // Date range
            let name = batch_name_from_range(&f, &t);
            (f, t, name)
        }
        _ => {
            bail!("Must specify one of: --month, --year, or both --from and --to");
        }
    };

    // Get podcast if filtering by podcast
    let podcast = if let Some(query) = &podcast_slug {
        let podcast = db
            .podcasts()
            .find_by_fuzzy_match(query)
            .await?
            .ok_or_else(|| color_eyre::eyre::eyre!("No podcast found matching: {}", query))?;
        Some(podcast)
    } else {
        None
    };
    let source_id = podcast.as_ref().map(|p| p.id);

    // Find untranscribed episodes in the date range
    let episodes = db
        .episodes()
        .get_untranscribed_in_range(&from_ym, &to_ym, source_id)
        .await?;

    if episodes.is_empty() {
        println!(
            "{}",
            format!("No untranscribed episodes found for range {from_ym} to {to_ym}").yellow()
        );
        if let Some(p) = &podcast {
            println!("  (filtered to podcast: {} ({}))", p.name, p.slug);
        }
        return Ok(());
    }

    // Create the batch (include podcast name if filtering by podcast)
    let full_batch_name = podcast.as_ref().map_or_else(
        || batch_name.clone(),
        |p| format!("{} - {}", batch_name, p.name),
    );
    let mut batch = TranscriptionBatch::new(full_batch_name);
    batch.priority = priority;
    batch.total_episodes = i32::try_from(episodes.len()).unwrap_or(i32::MAX);

    db.batches().create(&batch).await?;

    // Create tasks for each episode
    let tasks: Vec<TranscriptionTask> = episodes
        .iter()
        .map(|ep| TranscriptionTask::new(batch.id, ep.id))
        .collect();

    db.tasks().create_many(&tasks).await?;

    println!("{} {}", "Created batch:".green().bold(), batch_name.cyan());
    println!("  {}: {}", "ID".dimmed(), batch.id);
    println!(
        "  {}: {}",
        "Contents".dimmed(),
        episodes.len().to_string().cyan()
    );
    println!("  {}: {} to {}", "Range".dimmed(), from_ym, to_ym);
    if let Some(p) = &podcast {
        println!("  {}: {} ({})", "Source".dimmed(), p.name, p.slug);
    }

    Ok(())
}
