//! Backfill audio duration for transcribed episodes missing it

use color_eyre::eyre::Result;
use colored::Colorize;
use polsearch_util::truncate;

use super::get_database;

pub async fn run() -> Result<()> {
    let db = get_database().await?;

    // Find transcribed episodes without audio duration
    let episodes_without_duration: Vec<(uuid::Uuid, String)> = sqlx::query!(
        r#"
        SELECT e.id, e.title
        FROM content e
        WHERE e.is_processed = true
          AND e.duration_seconds IS NULL
        ORDER BY e.published_at DESC
        "#
    )
    .fetch_all(db.pool())
    .await?
    .into_iter()
    .map(|r| (r.id, r.title))
    .collect();

    if episodes_without_duration.is_empty() {
        println!(
            "{}",
            "All transcribed episodes have audio duration - nothing to backfill".green()
        );
        return Ok(());
    }

    println!(
        "Found {} episodes missing audio duration",
        episodes_without_duration.len().to_string().cyan()
    );

    let mut updated_count = 0;
    let mut skipped_count = 0;

    for (content_id, title) in &episodes_without_duration {
        // Calculate duration from segments (max end_time_ms)
        let result = sqlx::query!(
            r#"
            SELECT MAX(end_time_ms) as max_end_ms
            FROM segments
            WHERE content_id = $1
            "#,
            content_id
        )
        .fetch_one(db.pool())
        .await?;

        if let Some(max_end_ms) = result.max_end_ms {
            let duration_seconds = max_end_ms / 1000;

            sqlx::query!(
                "UPDATE content SET duration_seconds = $2, updated_at = NOW() WHERE id = $1",
                content_id,
                duration_seconds
            )
            .execute(db.pool())
            .await?;

            let duration_str = format!("{}:{:02}", duration_seconds / 60, duration_seconds % 60);
            println!(
                "  {} {} ({})",
                "Updated:".green(),
                truncate(title, 50),
                duration_str
            );
            updated_count += 1;
        } else {
            println!(
                "  {} {} (no segments found)",
                "Skipped:".yellow(),
                truncate(title, 50)
            );
            skipped_count += 1;
        }
    }

    println!("{}", "Backfill complete:".green().bold());
    println!("  Updated: {}", updated_count.to_string().cyan());
    println!("  Skipped: {}", skipped_count.to_string().yellow());

    Ok(())
}
