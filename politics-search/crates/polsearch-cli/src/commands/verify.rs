//! Verify transcribed episodes have complete data

use std::io::{Write, stdout};
use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::time::Instant;

use color_eyre::eyre::{Result, WrapErr};
use colored::Colorize;
use futures::StreamExt;
use polsearch_archive::ArchiveStore;
use polsearch_core::{Content, Source};
use polsearch_db::Database;
use uuid::Uuid;

use super::get_database;

fn concurrency() -> usize {
    num_cpus::get()
}

struct ContentVerification {
    content_id: Uuid,
    source_id: Uuid,
    episode_title: String,
    podcast_name: String,
    podcast_slug: String,
    year_month: String,
    segment_count: i32,
    content_speaker_count: usize,
    text_embedding_count: usize,
    speaker_embedding_count: usize,
    raw_data_version: Option<i32>,
    transcript_raw_count: usize,
    diarization_raw_count: usize,
    issues: Vec<String>,
}

impl ContentVerification {
    fn is_valid(&self) -> bool {
        self.issues.is_empty()
    }
}

struct VerificationSummary {
    total_checked: usize,
    valid_count: usize,
    invalid_count: usize,
    missing_segments: usize,
    missing_speakers: usize,
    missing_text_embeddings: usize,
    missing_speaker_embeddings: usize,
    missing_archive_data: usize,
    with_archive_data: usize,
}

impl VerificationSummary {
    fn from_results(results: &[ContentVerification]) -> Self {
        let valid_count = results.iter().filter(|r| r.is_valid()).count();
        let invalid_count = results.len() - valid_count;

        let missing_segments = results.iter().filter(|r| r.segment_count == 0).count();
        let missing_speakers = results
            .iter()
            .filter(|r| r.content_speaker_count == 0)
            .count();
        let missing_text_embeddings = results
            .iter()
            .filter(|r| r.text_embedding_count == 0)
            .count();
        let missing_speaker_embeddings = results
            .iter()
            .filter(|r| r.speaker_embedding_count == 0)
            .count();

        // archive stats: count episodes that claim to have raw data but don't
        let missing_archive_data = results
            .iter()
            .filter(|r| {
                r.raw_data_version.is_some()
                    && r.transcript_raw_count == 0
                    && r.diarization_raw_count == 0
            })
            .count();

        let with_archive_data = results
            .iter()
            .filter(|r| r.transcript_raw_count > 0 || r.diarization_raw_count > 0)
            .count();

        Self {
            total_checked: results.len(),
            valid_count,
            invalid_count,
            missing_segments,
            missing_speakers,
            missing_text_embeddings,
            missing_speaker_embeddings,
            missing_archive_data,
            with_archive_data,
        }
    }
}

pub async fn run(
    podcast_slug: Option<String>,
    month: Option<String>,
    limit: Option<usize>,
    lancedb_path: &str,
) -> Result<()> {
    let db = get_database().await?;

    // connect to LanceDB
    let lancedb = lancedb::connect(lancedb_path)
        .execute()
        .await
        .wrap_err_with(|| format!("Failed to connect to LanceDB at {lancedb_path}"))?;

    // check if required tables exist
    let table_names = lancedb.table_names().execute().await?;
    let has_text_embeddings = table_names.iter().any(|n| n == "text_embeddings");
    let has_speaker_embeddings = table_names.iter().any(|n| n == "speaker_embeddings");

    if !has_text_embeddings || !has_speaker_embeddings {
        println!("{}", "=== LanceDB Structure Issues ===".red().bold());
        if !has_text_embeddings {
            println!(
                "  {} text_embeddings table does not exist",
                "MISSING:".red()
            );
        }
        if !has_speaker_embeddings {
            println!(
                "  {} speaker_embeddings table does not exist",
                "MISSING:".red()
            );
        }
        println!();
    }

    // resolve podcast filter if provided
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

    // fetch transcribed episodes
    let episodes = db
        .episodes()
        .get_transcribed_filtered(podcast.as_ref().map(|p| p.id), month.as_deref(), limit)
        .await?;

    if episodes.is_empty() {
        println!(
            "{}",
            "No transcribed episodes found matching filters".yellow()
        );
        return Ok(());
    }

    let total = episodes.len();
    println!(
        "Verifying {} transcribed episodes ({} concurrent)...\n",
        total.to_string().cyan(),
        concurrency()
    );

    // build a cache of podcast info
    let podcasts = db.podcasts().get_all().await?;
    let podcast_map: std::collections::HashMap<Uuid, Source> =
        podcasts.into_iter().map(|p| (p.id, p)).collect();
    let podcast_map = Arc::new(podcast_map);

    // pre-open LanceDB tables to share across tasks (reduces file handles)
    let text_table = if has_text_embeddings {
        Some(lancedb.open_table("text_embeddings").execute().await?)
    } else {
        None
    };
    let speaker_table = if has_speaker_embeddings {
        Some(lancedb.open_table("speaker_embeddings").execute().await?)
    } else {
        None
    };

    // initialize archive store for raw data verification
    let archive = ArchiveStore::default_location();

    // shared state for progress
    let start_time = Instant::now();
    let completed = Arc::new(AtomicUsize::new(0));
    let valid_count = Arc::new(AtomicUsize::new(0));
    let invalid_count = Arc::new(AtomicUsize::new(0));

    // process episodes concurrently
    let results: Vec<Result<ContentVerification>> = futures::stream::iter(episodes)
        .map(|episode| {
            let db = &db;
            let text_table = &text_table;
            let speaker_table = &speaker_table;
            let archive = &archive;
            let podcast_map = Arc::clone(&podcast_map);
            let completed = Arc::clone(&completed);
            let valid_count = Arc::clone(&valid_count);
            let invalid_count = Arc::clone(&invalid_count);

            async move {
                let podcast = podcast_map.get(&episode.source_id).ok_or_else(|| {
                    color_eyre::eyre::eyre!("Source not found for episode {}", episode.id)
                })?;

                let verification =
                    verify_episode(db, text_table, speaker_table, archive, &episode, podcast)
                        .await?;

                // update progress counters
                let done = completed.fetch_add(1, Ordering::Relaxed) + 1;
                if verification.is_valid() {
                    valid_count.fetch_add(1, Ordering::Relaxed);
                } else {
                    invalid_count.fetch_add(1, Ordering::Relaxed);
                }

                // show progress
                print!(
                    "\r{} [{}/{}] {} valid, {} invalid",
                    "Progress:".dimmed(),
                    done.to_string().cyan(),
                    total,
                    valid_count.load(Ordering::Relaxed).to_string().green(),
                    invalid_count.load(Ordering::Relaxed).to_string().red()
                );
                print!("{:20}", "");
                stdout().flush().ok();

                Ok(verification)
            }
        })
        .buffer_unordered(concurrency())
        .collect()
        .await;

    // clear the progress line
    print!("\r{:80}\r", "");
    stdout().flush().ok();

    // collect successful results, propagate first error
    let mut verifications = Vec::with_capacity(results.len());
    for result in results {
        verifications.push(result?);
    }

    let elapsed = start_time.elapsed();
    let valid_final = valid_count.load(Ordering::Relaxed);
    let invalid_final = invalid_count.load(Ordering::Relaxed);

    println!(
        "{} Verified {} episodes in {:.1}s ({} valid, {} invalid)\n",
        "Done:".green().bold(),
        total,
        elapsed.as_secs_f32(),
        valid_final.to_string().green(),
        invalid_final.to_string().red()
    );

    // print detailed report
    print_report(&verifications);

    Ok(())
}

async fn verify_episode(
    db: &Database,
    text_table: &Option<lancedb::Table>,
    speaker_table: &Option<lancedb::Table>,
    archive: &Option<ArchiveStore>,
    episode: &Content,
    podcast: &Source,
) -> Result<ContentVerification> {
    let mut issues = Vec::new();

    // check Postgres: segments
    let segment_count = db.segments().count_by_content(episode.id).await?;
    if segment_count == 0 {
        issues.push("MISSING: segments (0 found in Postgres)".to_string());
    }

    // check Postgres: content_speakers
    let content_speakers = db.content_speakers().get_by_content(episode.id).await?;
    let content_speaker_count = content_speakers.len();
    if content_speaker_count == 0 {
        issues.push("MISSING: content_speakers (0 found in Postgres)".to_string());
    }

    // check LanceDB: text_embeddings
    let text_embedding_count = if let Some(table) = text_table {
        count_table_rows(table, episode.id).await?
    } else {
        0
    };
    if text_embedding_count == 0 && text_table.is_some() {
        issues.push("MISSING: text_embeddings (0 found in LanceDB)".to_string());
    } else if text_table.is_none() {
        issues.push("MISSING: text_embeddings (table does not exist)".to_string());
    }

    // check LanceDB: speaker_embeddings
    let speaker_embedding_count = if let Some(table) = speaker_table {
        count_table_rows(table, episode.id).await?
    } else {
        0
    };
    if speaker_embedding_count == 0 && speaker_table.is_some() {
        issues.push("MISSING: speaker_embeddings (0 found in LanceDB)".to_string());
    } else if speaker_table.is_none() {
        issues.push("MISSING: speaker_embeddings (table does not exist)".to_string());
    }

    // check archive: raw transcript and diarization data
    let (transcript_raw_count, diarization_raw_count) = archive.as_ref().map_or((0, 0), |a| {
        let transcript = a
            .count_transcript_raw(episode.source_id, episode.id)
            .unwrap_or(0);
        let diarization = a
            .count_diarization_raw(episode.source_id, episode.id)
            .unwrap_or(0);
        (transcript, diarization)
    });

    // flag if raw_data_version is set but archive data is missing
    if let Some(version) = episode.raw_data_version {
        if transcript_raw_count == 0 && diarization_raw_count == 0 {
            issues.push(format!(
                "MISSING: archive data (raw_data_version={version} but no archive records)"
            ));
        }
    }

    Ok(ContentVerification {
        content_id: episode.id,
        source_id: episode.source_id,
        episode_title: episode.title.clone(),
        podcast_name: podcast.name.clone(),
        podcast_slug: podcast.slug.clone(),
        year_month: episode.year_month.clone(),
        segment_count,
        content_speaker_count,
        text_embedding_count,
        speaker_embedding_count,
        raw_data_version: episode.raw_data_version,
        transcript_raw_count,
        diarization_raw_count,
        issues,
    })
}

async fn count_table_rows(table: &lancedb::Table, content_id: Uuid) -> Result<usize> {
    let filter = format!("content_id = '{content_id}'");
    let count = table.count_rows(Some(filter)).await?;
    Ok(count)
}

fn print_report(results: &[ContentVerification]) {
    let summary = VerificationSummary::from_results(results);

    // header
    println!("{}", "=== Verification Report ===".cyan().bold());
    println!("Checked: {} transcribed episodes", summary.total_checked);

    let valid_pct = if summary.total_checked > 0 {
        (summary.valid_count as f64 / summary.total_checked as f64) * 100.0
    } else {
        0.0
    };
    let invalid_pct = 100.0 - valid_pct;

    println!(
        "Valid: {} ({:.1}%)",
        summary.valid_count.to_string().green(),
        valid_pct
    );
    println!(
        "Invalid: {} ({:.1}%)",
        summary.invalid_count.to_string().red(),
        invalid_pct
    );
    println!(
        "With archive data: {}",
        summary.with_archive_data.to_string().dimmed()
    );
    println!();

    // summary of issues
    if summary.invalid_count > 0 {
        println!("{}", "=== Summary of Issues ===".yellow().bold());
        if summary.missing_segments > 0 {
            println!(
                "- Missing segments in Postgres: {} episodes",
                summary.missing_segments
            );
        }
        if summary.missing_speakers > 0 {
            println!(
                "- Missing content_speakers in Postgres: {} episodes",
                summary.missing_speakers
            );
        }
        if summary.missing_text_embeddings > 0 {
            println!(
                "- Missing text_embeddings in LanceDB: {} episodes",
                summary.missing_text_embeddings
            );
        }
        if summary.missing_speaker_embeddings > 0 {
            println!(
                "- Missing speaker_embeddings in LanceDB: {} episodes",
                summary.missing_speaker_embeddings
            );
        }
        if summary.missing_archive_data > 0 {
            println!(
                "- Missing archive data (version set but no data): {} episodes",
                summary.missing_archive_data
            );
        }
        println!();
    }

    // invalid episodes with details
    let invalid: Vec<_> = results.iter().filter(|r| !r.is_valid()).collect();
    if !invalid.is_empty() {
        println!("{}", "=== Invalid Contents ===".red().bold());
        println!();

        for v in &invalid {
            println!("Content: \"{}\"", v.episode_title.cyan());
            println!("  ID: {}", v.content_id);
            println!("  Source: {} ({})", v.podcast_name, v.podcast_slug);
            println!("  Month: {}", v.year_month);
            println!("  Issues:");
            for issue in &v.issues {
                println!("    - {}", issue.red());
            }
            println!("  Investigation:");

            // provide helpful queries based on what's missing
            if v.segment_count == 0 {
                println!(
                    "    - Postgres: SELECT * FROM segments WHERE content_id = '{}'",
                    v.content_id
                );
            }
            if v.content_speaker_count == 0 {
                println!(
                    "    - Postgres: SELECT * FROM content_speakers WHERE content_id = '{}'",
                    v.content_id
                );
            }
            if v.text_embedding_count == 0 {
                println!(
                    "    - LanceDB: Check text_embeddings WHERE content_id = '{}'",
                    v.content_id
                );
            }
            if v.speaker_embedding_count == 0 {
                println!(
                    "    - LanceDB: Check speaker_embeddings WHERE content_id = '{}'",
                    v.content_id
                );
            }
            if v.raw_data_version.is_some()
                && v.transcript_raw_count == 0
                && v.diarization_raw_count == 0
            {
                println!(
                    "    - Archive: sqlite3 ~/.polsearch/archive/{}/raw_data.sqlite \"SELECT * FROM transcript_raw WHERE content_id = '{}'\"",
                    v.source_id, v.content_id
                );
            }
            // always show transcription task check for invalid episodes
            println!(
                "    - Postgres: SELECT * FROM transcription_tasks WHERE content_id = '{}'",
                v.content_id
            );
            println!("  Fix (delete episode and re-transcribe):");
            println!("    DELETE FROM content WHERE id = '{}';", v.content_id);
            println!();
        }
    }

    // valid episodes (show first 5)
    let valid: Vec<_> = results.iter().filter(|r| r.is_valid()).collect();
    if !valid.is_empty() {
        let show_count = valid.len().min(5);
        println!(
            "{} ({} shown)",
            "=== Valid Contents ===".green().bold(),
            show_count
        );

        for v in valid.iter().take(5) {
            let archive_info = if v.transcript_raw_count > 0 || v.diarization_raw_count > 0 {
                format!(
                    ", {} transcript_raw, {} diarization_raw",
                    v.transcript_raw_count, v.diarization_raw_count
                )
            } else {
                String::new()
            };
            println!(
                "- \"{}\" ({}, {}): {} segments, {} speakers, {} text embeddings, {} speaker embeddings{}",
                v.episode_title.dimmed(),
                v.podcast_slug.dimmed(),
                v.year_month.dimmed(),
                v.segment_count,
                v.content_speaker_count,
                v.text_embedding_count,
                v.speaker_embedding_count,
                archive_info.dimmed()
            );
        }

        if valid.len() > 5 {
            println!("  ... and {} more valid episodes", valid.len() - 5);
        }
    }

    // if there are invalid episodes, print combined fix commands
    if !invalid.is_empty() {
        println!();
        println!(
            "{} (fix all {} invalid episodes):",
            "=== Fix Commands ===".yellow().bold(),
            invalid.len()
        );
        println!();

        // collect episode IDs for SQL
        let content_ids: Vec<String> = invalid
            .iter()
            .map(|v| format!("'{}'", v.content_id))
            .collect();
        let ids_list = content_ids.join(", ");

        println!("-- 1. Delete from Postgres (cascade deletes related data)");
        println!("DELETE FROM content WHERE id IN ({ids_list});");
        println!();
        println!("-- 2. Re-fetch and re-queue");
        println!("polsearch fetch-episodes");
        println!("polsearch transcribe-plan --month <month>");
        println!();
        println!("-- 3. Process (LanceDB cleanup is automatic)");
        println!("polsearch work");
    }
}
