//! `LanceDB` inspection commands

use arrow_array::RecordBatch;
use color_eyre::eyre::{Result, eyre};
use colored::Colorize;
use futures::TryStreamExt;
use lancedb::index::scalar::FullTextSearchQuery;
use lancedb::query::{ExecutableQuery, QueryBase};
use polsearch_pipeline::stages::TextEmbedder;
use polsearch_util::truncate;

/// List all tables with row counts
pub async fn tables(lancedb_path: &str) -> Result<()> {
    let db = lancedb::connect(lancedb_path).execute().await?;
    let table_names = db.table_names().execute().await?;

    if table_names.is_empty() {
        println!("{}", format!("No tables found in {lancedb_path}").yellow());
        return Ok(());
    }

    println!("{}", format!("Tables in {lancedb_path}:").cyan().bold());
    for name in table_names {
        let table = db.open_table(&name).execute().await?;
        let count = table.count_rows(None).await?;
        println!("  {}: {} rows", name.cyan(), count);
    }

    Ok(())
}

/// Show rows from a specific table
pub async fn show(lancedb_path: &str, table_name: &str, limit: usize) -> Result<()> {
    let db = lancedb::connect(lancedb_path).execute().await?;
    let table = db.open_table(table_name).execute().await?;

    let stream = table.query().limit(limit).execute().await?;
    let batches: Vec<RecordBatch> = stream.try_collect().await?;

    if batches.is_empty() {
        println!("{}", format!("No rows in table '{table_name}'").yellow());
        return Ok(());
    }

    match table_name {
        "text_embeddings" => print_text_embeddings(&batches)?,
        "speaker_embeddings" => print_speaker_embeddings(&batches)?,
        "speaker_centroids" => print_speaker_centroids(&batches)?,
        _ => return Err(eyre!("Unknown table: {}", table_name)),
    }

    Ok(())
}

/// Search text embeddings
pub async fn search(lancedb_path: &str, query: &str, limit: usize, mode: &str) -> Result<()> {
    let db = lancedb::connect(lancedb_path).execute().await?;
    let table = db.open_table("text_embeddings").execute().await?;

    let batches: Vec<RecordBatch> = match mode {
        "vector" => {
            println!("{} \"{}\"", "Vector search for:".cyan(), query);
            let mut embedder = TextEmbedder::new()?;
            let query_embedding = embedder.embed(query)?;

            let stream = table
                .vector_search(query_embedding)?
                .limit(limit)
                .execute()
                .await?;
            stream.try_collect().await?
        }
        "fts" => {
            println!("{} \"{}\"", "Full-text search for:".cyan(), query);
            let stream = table
                .query()
                .full_text_search(FullTextSearchQuery::new(query.to_string()))
                .limit(limit)
                .execute()
                .await?;
            stream.try_collect().await?
        }
        "hybrid" => {
            println!("{} \"{}\"", "Hybrid search for:".cyan(), query);
            let mut embedder = TextEmbedder::new()?;
            let query_embedding = embedder.embed(query)?;

            let stream = table
                .vector_search(query_embedding)?
                .full_text_search(FullTextSearchQuery::new(query.to_string()))
                .limit(limit)
                .execute()
                .await?;
            stream.try_collect().await?
        }
        _ => {
            return Err(eyre!(
                "Unknown search mode: {}. Use: vector, fts, hybrid",
                mode
            ));
        }
    };

    if batches.is_empty() {
        println!("{}", "No results found".yellow());
        return Ok(());
    }

    print_search_results(&batches)?;

    Ok(())
}

fn print_search_results(batches: &[RecordBatch]) -> Result<()> {
    use arrow_array::{Float32Array, Int32Array, StringArray};

    for batch in batches {
        let distances = batch
            .column_by_name("_distance")
            .and_then(|c| c.as_any().downcast_ref::<Float32Array>());

        let segment_indices = batch
            .column_by_name("segment_index")
            .and_then(|c| c.as_any().downcast_ref::<Int32Array>())
            .ok_or_else(|| eyre!("Missing segment_index column"))?;

        let start_times = batch
            .column_by_name("start_time_ms")
            .and_then(|c| c.as_any().downcast_ref::<Int32Array>())
            .ok_or_else(|| eyre!("Missing start_time_ms column"))?;

        let end_times = batch
            .column_by_name("end_time_ms")
            .and_then(|c| c.as_any().downcast_ref::<Int32Array>())
            .ok_or_else(|| eyre!("Missing end_time_ms column"))?;

        let texts = batch
            .column_by_name("text")
            .and_then(|c| c.as_any().downcast_ref::<StringArray>())
            .ok_or_else(|| eyre!("Missing text column"))?;

        for i in 0..batch.num_rows() {
            let distance = distances.map_or(0.0, |d| d.value(i));
            let seg_idx = segment_indices.value(i);
            let start = start_times.value(i);
            let end = end_times.value(i);
            let text = texts.value(i);

            let time_str = format!(
                "{}:{:02}-{}:{:02}",
                start / 60000,
                (start / 1000) % 60,
                end / 60000,
                (end / 1000) % 60
            );

            println!(
                "[{:.3}] seg {} | {} | {}",
                distance,
                seg_idx,
                time_str.dimmed(),
                truncate(text, 80)
            );
        }
    }

    Ok(())
}

fn print_text_embeddings(batches: &[RecordBatch]) -> Result<()> {
    use arrow_array::{Int32Array, StringArray};

    for batch in batches {
        let segment_indices = batch
            .column_by_name("segment_index")
            .and_then(|c| c.as_any().downcast_ref::<Int32Array>())
            .ok_or_else(|| eyre!("Missing segment_index column"))?;

        let start_times = batch
            .column_by_name("start_time_ms")
            .and_then(|c| c.as_any().downcast_ref::<Int32Array>())
            .ok_or_else(|| eyre!("Missing start_time_ms column"))?;

        let end_times = batch
            .column_by_name("end_time_ms")
            .and_then(|c| c.as_any().downcast_ref::<Int32Array>())
            .ok_or_else(|| eyre!("Missing end_time_ms column"))?;

        let texts = batch
            .column_by_name("text")
            .and_then(|c| c.as_any().downcast_ref::<StringArray>())
            .ok_or_else(|| eyre!("Missing text column"))?;

        for i in 0..batch.num_rows() {
            let seg_idx = segment_indices.value(i);
            let start = start_times.value(i);
            let end = end_times.value(i);
            let text = texts.value(i);

            let time_str = format!(
                "{}:{:02}-{}:{:02}",
                start / 60000,
                (start / 1000) % 60,
                end / 60000,
                (end / 1000) % 60
            );

            println!(
                "[{}] {} | {}",
                seg_idx,
                time_str.dimmed(),
                truncate(text, 60)
            );
        }
    }

    Ok(())
}

fn print_speaker_embeddings(batches: &[RecordBatch]) -> Result<()> {
    use arrow_array::{Int32Array, StringArray};

    for batch in batches {
        let content_ids = batch
            .column_by_name("content_id")
            .and_then(|c| c.as_any().downcast_ref::<StringArray>())
            .ok_or_else(|| eyre!("Missing content_id column"))?;

        let speaker_labels = batch
            .column_by_name("speaker_label")
            .and_then(|c| c.as_any().downcast_ref::<StringArray>())
            .ok_or_else(|| eyre!("Missing speaker_label column"))?;

        let durations = batch
            .column_by_name("duration_ms")
            .and_then(|c| c.as_any().downcast_ref::<Int32Array>())
            .ok_or_else(|| eyre!("Missing duration_ms column"))?;

        for i in 0..batch.num_rows() {
            let content_id = content_ids.value(i);
            let speaker = speaker_labels.value(i);
            let duration_ms = durations.value(i);

            let duration_str = format!("{}:{:02}", duration_ms / 60000, (duration_ms / 1000) % 60);

            println!(
                "{} | {} | {}",
                content_id.dimmed(),
                speaker.cyan(),
                duration_str
            );
        }
    }

    Ok(())
}

fn print_speaker_centroids(batches: &[RecordBatch]) -> Result<()> {
    use arrow_array::{Int32Array, StringArray};

    for batch in batches {
        let speaker_ids = batch
            .column_by_name("speaker_id")
            .and_then(|c| c.as_any().downcast_ref::<StringArray>())
            .ok_or_else(|| eyre!("Missing speaker_id column"))?;

        let sample_counts = batch
            .column_by_name("sample_count")
            .and_then(|c| c.as_any().downcast_ref::<Int32Array>())
            .ok_or_else(|| eyre!("Missing sample_count column"))?;

        for i in 0..batch.num_rows() {
            let speaker_id = speaker_ids.value(i);
            let count = sample_counts.value(i);

            println!("{} | {} samples", speaker_id.dimmed(), count);
        }
    }

    Ok(())
}
