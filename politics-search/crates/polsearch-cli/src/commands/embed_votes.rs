//! Embed congressional vote data for semantic search

use arrow_array::{
    types::Float32Type, Array, FixedSizeListArray, Int32Array, RecordBatch, RecordBatchIterator,
    StringArray,
};
use arrow_schema::{DataType, Field, Schema};
use color_eyre::eyre::Result;
use colored::Colorize;
use polsearch_core::RollCallVote;
use polsearch_pipeline::stages::TextEmbedder;
use std::sync::Arc;
use std::time::Instant;

use super::get_database;

/// Format seconds as human-readable duration (e.g., "2m 30s" or "1h 5m")
fn format_eta(seconds: f64) -> String {
    if seconds < 60.0 {
        format!("{}s", seconds.round() as u64)
    } else if seconds < 3600.0 {
        let mins = (seconds / 60.0).floor() as u64;
        let secs = (seconds % 60.0).round() as u64;
        format!("{}m {}s", mins, secs)
    } else {
        let hours = (seconds / 3600.0).floor() as u64;
        let mins = ((seconds % 3600.0) / 60.0).round() as u64;
        format!("{}h {}m", hours, mins)
    }
}

/// Embedding statistics
#[derive(Debug, Default)]
pub struct EmbedStats {
    pub votes_processed: usize,
    pub votes_skipped: usize,
    pub embeddings_created: usize,
}

/// Run the embed votes command
pub async fn run(
    limit: Option<usize>,
    force: bool,
    dry_run: bool,
    year: Option<i32>,
    lancedb_path: &str,
) -> Result<()> {
    let db = get_database().await?;

    let total_count = if let Some(y) = year {
        db.roll_call_votes().count_by_year(y).await?
    } else {
        db.roll_call_votes().count().await?
    };

    let year_msg = year.map_or(String::new(), |y| format!(" from {}", y));
    println!(
        "{}",
        format!("Found {} votes{} in database", total_count, year_msg).cyan()
    );

    if dry_run {
        let process_count = limit.map_or(total_count as usize, |l| l.min(total_count as usize));
        println!(
            "{}",
            format!(
                "[DRY RUN] Would embed {} votes{}{}",
                process_count,
                year_msg,
                if force { " (force mode)" } else { "" }
            )
            .yellow()
        );
        return Ok(());
    }

    if force {
        println!(
            "{}",
            "Force mode enabled - will re-embed all votes".yellow()
        );
    }

    let lancedb = lancedb::connect(lancedb_path).execute().await?;
    let mut embedder = TextEmbedder::new()?;
    let mut stats = EmbedStats::default();

    // Fetch votes in batches for pagination
    const BATCH_SIZE: i64 = 500;
    let mut offset = 0i64;
    let max_votes = limit.map_or(i64::MAX, |l| l as i64);

    println!("{}", "Embedding votes...".cyan());
    let start = Instant::now();

    loop {
        let remaining = max_votes - offset;
        if remaining <= 0 {
            break;
        }

        let fetch_size = BATCH_SIZE.min(remaining);
        let votes = if let Some(y) = year {
            db.roll_call_votes()
                .get_by_year_paginated(y, offset, fetch_size)
                .await?
        } else {
            db.roll_call_votes()
                .get_all_paginated(offset, fetch_size)
                .await?
        };

        if votes.is_empty() {
            break;
        }

        // Filter out already embedded if not forcing
        let votes_to_embed: Vec<&RollCallVote> = if force {
            votes.iter().collect()
        } else {
            let mut filtered = Vec::new();
            for vote in &votes {
                let exists = check_vote_embedded(&lancedb, &vote.id.to_string()).await?;
                if !exists {
                    filtered.push(vote);
                } else {
                    stats.votes_skipped += 1;
                }
            }
            filtered
        };

        if !votes_to_embed.is_empty() {
            embed_and_write_batch(&lancedb, &mut embedder, &votes_to_embed, &mut stats).await?;
        }

        let processed = offset + votes.len() as i64;
        {
            let elapsed = start.elapsed().as_secs_f64();
            let eta_str = if processed > 0 && elapsed > 0.0 {
                let rate = processed as f64 / elapsed;
                let remaining = total_count as f64 - processed as f64;
                let eta_seconds = remaining / rate;
                format!(" - ETA: {}", format_eta(eta_seconds))
            } else {
                String::new()
            };

            println!(
                "  Processed {}/{} votes ({} embedded, {} skipped){}",
                processed.to_string().cyan(),
                total_count.to_string().dimmed(),
                stats.embeddings_created.to_string().green(),
                stats.votes_skipped.to_string().yellow(),
                eta_str.dimmed()
            );
        }

        offset += votes.len() as i64;

        if votes.len() < BATCH_SIZE as usize {
            break;
        }
    }

    let duration = start.elapsed();
    println!();
    println!("{}", "Embedding complete:".green().bold());
    println!(
        "  Votes embedded:  {}",
        stats.embeddings_created.to_string().cyan()
    );
    println!(
        "  Votes skipped:   {}",
        stats.votes_skipped.to_string().yellow()
    );
    println!(
        "  Time elapsed:    {:.1}s",
        duration.as_secs_f64()
    );

    Ok(())
}

/// Check if a vote has already been embedded
async fn check_vote_embedded(lancedb: &lancedb::Connection, vote_id: &str) -> Result<bool> {
    let table = match lancedb.open_table("text_embeddings").execute().await {
        Ok(t) => t,
        Err(_) => return Ok(false),
    };

    let filter = format!("content_type = 'vote' AND id = '{vote_id}'");

    use futures::TryStreamExt;
    use lancedb::query::{ExecutableQuery, QueryBase};

    let batches: Vec<RecordBatch> = table
        .query()
        .only_if(filter)
        .limit(1)
        .execute()
        .await?
        .try_collect()
        .await?;

    Ok(batches.iter().any(|b| b.num_rows() > 0))
}

/// Build embedding text from vote data
fn build_vote_text(vote: &RollCallVote) -> String {
    let mut parts = vec![vote.question.clone()];

    if let Some(ref subject) = vote.subject {
        if !subject.is_empty() {
            parts.push(subject.clone());
        }
    }

    if let Some(ref vote_type) = vote.vote_type {
        if !vote_type.is_empty() {
            parts.push(vote_type.clone());
        }
    }

    parts.join(". ")
}

/// Embed a batch of votes and write to `LanceDB`
async fn embed_and_write_batch(
    lancedb: &lancedb::Connection,
    embedder: &mut TextEmbedder,
    votes: &[&RollCallVote],
    stats: &mut EmbedStats,
) -> Result<()> {
    if votes.is_empty() {
        return Ok(());
    }

    // Build texts for embedding
    let texts: Vec<String> = votes.iter().map(|v| build_vote_text(v)).collect();
    let text_refs: Vec<&str> = texts.iter().map(String::as_str).collect();

    // Generate embeddings
    let embeddings = embedder.embed_batch(&text_refs)?;

    // Build Arrow arrays
    let schema = Arc::new(Schema::new(vec![
        Field::new("id", DataType::Utf8, false),
        Field::new("content_type", DataType::Utf8, false),
        Field::new("content_id", DataType::Utf8, false),
        Field::new("statement_id", DataType::Utf8, true),
        Field::new("segment_index", DataType::Int32, false),
        Field::new("start_time_ms", DataType::Int32, false),
        Field::new("end_time_ms", DataType::Int32, false),
        Field::new("text", DataType::Utf8, false),
        Field::new(
            "vector",
            DataType::FixedSizeList(Arc::new(Field::new("item", DataType::Float32, true)), 384),
            false,
        ),
    ]));

    let ids: Vec<String> = votes.iter().map(|v| v.id.to_string()).collect();
    let content_types: Vec<&str> = vec!["vote"; votes.len()];
    // use vote UUID for content_id (matches hearings/floor speeches pattern)
    let content_ids: Vec<String> = votes.iter().map(|v| v.id.to_string()).collect();
    let statement_ids: Vec<Option<String>> = vec![None; votes.len()];
    let segment_indices: Vec<i32> = vec![0; votes.len()];
    let start_times: Vec<i32> = vec![0; votes.len()];
    let end_times: Vec<i32> = vec![0; votes.len()];

    // Create embedding array
    let embedding_lists: Vec<Option<Vec<Option<f32>>>> = embeddings
        .iter()
        .map(|e| Some(e.iter().copied().map(Some).collect()))
        .collect();
    let vector_array =
        FixedSizeListArray::from_iter_primitive::<Float32Type, _, _>(embedding_lists, 384);

    let batch = RecordBatch::try_new(
        schema.clone(),
        vec![
            Arc::new(StringArray::from(ids)),
            Arc::new(StringArray::from(content_types)),
            Arc::new(StringArray::from(content_ids)),
            Arc::new(StringArray::from(
                statement_ids
                    .iter()
                    .map(|s| s.as_deref())
                    .collect::<Vec<_>>(),
            )),
            Arc::new(Int32Array::from(segment_indices)),
            Arc::new(Int32Array::from(start_times)),
            Arc::new(Int32Array::from(end_times)),
            Arc::new(StringArray::from(texts)),
            Arc::new(vector_array) as Arc<dyn Array>,
        ],
    )?;

    // Open or create the table
    let table = match lancedb.open_table("text_embeddings").execute().await {
        Ok(t) => t,
        Err(_) => {
            println!("{}", "Creating text_embeddings table...".cyan());
            let batches =
                RecordBatchIterator::new(vec![Ok(batch.clone())].into_iter(), schema.clone());
            lancedb
                .create_table("text_embeddings", Box::new(batches))
                .execute()
                .await?
        }
    };

    let batches = RecordBatchIterator::new(vec![Ok(batch)].into_iter(), schema);
    table.add(Box::new(batches)).execute().await?;

    stats.votes_processed += votes.len();
    stats.embeddings_created += votes.len();

    Ok(())
}
