//! List speakers with their cross-podcast appearances

use color_eyre::eyre::Result;
use colored::Colorize;
use polsearch_util::truncate;
use std::collections::HashMap;
use uuid::Uuid;

use super::get_database;

struct SpeakerAppearance {
    podcast_name: String,
    episode_title: String,
    published_at: String,
    match_confidence: Option<f32>,
}

struct SpeakerInfo {
    id: Uuid,
    name: Option<String>,
    total_appearances: i32,
    appearances: Vec<SpeakerAppearance>,
}

pub async fn list(min_appearances: Option<i32>) -> Result<()> {
    let db = get_database().await?;
    let min = min_appearances.unwrap_or(1);

    let rows = sqlx::query!(
        r#"
        SELECT
            s.id as speaker_id,
            s.name as speaker_name,
            s.total_appearances,
            es.match_confidence,
            e.title as episode_title,
            e.published_at,
            p.name as podcast_name
        FROM speakers s
        JOIN content_speakers es ON es.speaker_id = s.id
        JOIN content e ON es.content_id = e.id
        JOIN sources p ON e.source_id = p.id
        WHERE s.merged_into_id IS NULL
          AND s.total_appearances >= $1
        ORDER BY s.total_appearances DESC, s.id, p.name, e.published_at DESC
        "#,
        min
    )
    .fetch_all(db.pool())
    .await?;

    if rows.is_empty() {
        println!(
            "{}",
            format!("No speakers found with {} or more appearances", min).yellow()
        );
        return Ok(());
    }

    // group by speaker
    let mut speakers: HashMap<Uuid, SpeakerInfo> = HashMap::new();

    for row in rows {
        let entry = speakers
            .entry(row.speaker_id)
            .or_insert_with(|| SpeakerInfo {
                id: row.speaker_id,
                name: row.speaker_name.clone(),
                total_appearances: row.total_appearances.unwrap_or(0),
                appearances: Vec::new(),
            });

        entry.appearances.push(SpeakerAppearance {
            podcast_name: row.podcast_name,
            episode_title: row.episode_title,
            published_at: row.published_at.format("%Y-%m-%d").to_string(),
            match_confidence: row.match_confidence,
        });
    }

    // sort by total appearances descending
    let mut speaker_list: Vec<_> = speakers.into_values().collect();
    speaker_list.sort_by(|a, b| b.total_appearances.cmp(&a.total_appearances));

    // count cross-podcast speakers
    let cross_podcast_count = speaker_list
        .iter()
        .filter(|s| {
            let podcasts: std::collections::HashSet<_> =
                s.appearances.iter().map(|a| &a.podcast_name).collect();
            podcasts.len() > 1
        })
        .count();

    println!(
        "{} ({} total, {} cross-podcast)\n",
        "Speakers".cyan().bold(),
        speaker_list.len(),
        cross_podcast_count.to_string().green()
    );

    for speaker in &speaker_list {
        let podcasts: std::collections::HashSet<_> = speaker
            .appearances
            .iter()
            .map(|a| &a.podcast_name)
            .collect();
        let is_cross_podcast = podcasts.len() > 1;

        // header line
        let name_display = speaker
            .name
            .as_deref()
            .unwrap_or("(unidentified)")
            .to_string();

        if is_cross_podcast {
            println!(
                "{} {} | {} | {} appearances across {} podcasts",
                "[CROSS-PODCAST]".green().bold(),
                &speaker.id.to_string()[..13].dimmed(),
                name_display.cyan(),
                speaker.total_appearances,
                podcasts.len()
            );
        } else {
            println!(
                "{} | {} | {} appearances",
                &speaker.id.to_string()[..13].dimmed(),
                name_display.cyan(),
                speaker.total_appearances
            );
        }

        // group appearances by podcast
        let mut by_source: HashMap<&str, Vec<&SpeakerAppearance>> = HashMap::new();
        for app in &speaker.appearances {
            by_source.entry(&app.podcast_name).or_default().push(app);
        }

        for (podcast_name, appearances) in &by_source {
            println!("  {}:", podcast_name.yellow());
            for app in appearances {
                let date = format!("[{}] ", app.published_at);
                let conf = app
                    .match_confidence
                    .map_or(String::new(), |c| format!(" (conf: {c:.2})"));
                let title = truncate(&app.episode_title, 50);
                println!("    - {}{}{}", date.dimmed(), title, conf.dimmed());
            }
        }

        println!();
    }

    Ok(())
}
