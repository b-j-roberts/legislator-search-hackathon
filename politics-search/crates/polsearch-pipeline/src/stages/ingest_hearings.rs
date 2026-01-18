//! Hearing ingestion from JSON transcript files

use arrow_array::{
    types::Float32Type, Array, FixedSizeListArray, Int32Array, RecordBatch, RecordBatchIterator,
    StringArray,
};
use arrow_schema::{DataType, Field, Schema};
use chrono::{Datelike, NaiveDate};
use color_eyre::eyre::{bail, eyre, Result};
use colored::Colorize;
use polsearch_core::{Hearing, HearingSegment, HearingStatement};
use polsearch_db::Database;
use serde::Deserialize;
use std::fs;
use std::path::Path;
use std::sync::Arc;
use std::time::Instant;
use tracing::warn;

use super::chunk::TextChunker;
use super::embed::TextEmbedder;
use super::procedural_filter::should_skip_statement;

/// Raw transcript JSON structure
#[derive(Debug, Deserialize)]
pub struct TranscriptJson {
    pub event_id: String,
    pub package_id: String,
    pub title: String,
    pub date: String,
    pub committee: Option<String>,
    pub chamber: String,
    pub congress: i16,
    pub source_url: String,
    pub statements: Vec<StatementJson>,
}

/// Statement entry in transcript JSON
#[derive(Debug, Deserialize)]
pub struct StatementJson {
    pub speaker: String,
    pub text: String,
    pub index: i32,
}

/// Ingestion statistics
#[derive(Debug, Default)]
pub struct IngestStats {
    pub files_processed: usize,
    pub files_skipped: usize,
    pub hearings_created: usize,
    pub statements_created: usize,
    pub segments_created: usize,
    pub embeddings_created: usize,
}

/// Hearing ingester for processing transcript JSON files
pub struct HearingIngester {
    db: Database,
    chunker: TextChunker,
    embedder: TextEmbedder,
    lancedb: lancedb::Connection,
    force: bool,
    year_filter: Option<i32>,
}

impl HearingIngester {
    /// Creates a new hearing ingester
    ///
    /// # Errors
    /// Returns an error if embedding model or `LanceDB` fails to initialize
    pub async fn new(db: Database, lancedb_path: &str, force: bool, year_filter: Option<i32>) -> Result<Self> {
        let embedder = TextEmbedder::new()?;
        let lancedb = lancedb::connect(lancedb_path).execute().await?;

        Ok(Self {
            db,
            chunker: TextChunker::default(),
            embedder,
            lancedb,
            force,
            year_filter,
        })
    }

    /// Ingest a single transcript JSON file
    ///
    /// # Errors
    /// Returns an error if parsing or database operations fail
    pub async fn ingest_file(&mut self, path: &Path) -> Result<IngestStats> {
        let mut stats = IngestStats::default();

        let content = fs::read_to_string(path)?;
        let transcript: TranscriptJson = serde_json::from_str(&content)
            .map_err(|e| eyre!("Failed to parse {}: {}", path.display(), e))?;

        // Check if already exists
        if !self.force && self.db.hearings().exists_by_package_id(&transcript.package_id).await? {
            stats.files_skipped += 1;
            return Ok(stats);
        }

        // Delete existing if force mode
        if self.force {
            if let Some(existing) = self.db.hearings().get_by_package_id(&transcript.package_id).await? {
                self.db.hearings().delete(existing.id).await?;
            }
        }

        // Parse date
        let hearing_date = NaiveDate::parse_from_str(&transcript.date, "%Y-%m-%d")
            .map_err(|e| eyre!("Invalid date format: {} - {}", transcript.date, e))?;

        // Skip if year doesn't match filter
        if let Some(target_year) = self.year_filter {
            if hearing_date.year() != target_year {
                stats.files_skipped += 1;
                return Ok(stats);
            }
        }

        // Create hearing record
        let hearing = Hearing::new(
            transcript.package_id.clone(),
            transcript.event_id.clone(),
            transcript.title.clone(),
            transcript.committee.clone(),
            &transcript.chamber,
            transcript.congress,
            hearing_date,
            transcript.source_url.clone(),
        );
        self.db.hearings().create(&hearing).await?;
        stats.hearings_created += 1;

        // Process statements and create segments
        let mut all_statements = Vec::new();
        let mut all_segments = Vec::new();
        let mut all_texts = Vec::new();
        let mut segment_index = 0;

        for stmt_json in &transcript.statements {
            // Skip procedural statements
            if should_skip_statement(&stmt_json.text) {
                continue;
            }

            let word_count = stmt_json.text.split_whitespace().count() as i32;
            let statement = HearingStatement::new(
                hearing.id,
                stmt_json.index,
                stmt_json.speaker.clone(),
                word_count,
            );
            all_statements.push(statement.clone());
            stats.statements_created += 1;

            // Chunk the statement
            let chunks = self.chunker.chunk(&stmt_json.text);
            for (chunk_idx, chunk_text) in chunks.iter().enumerate() {
                let segment = HearingSegment::new(
                    hearing.id,
                    statement.id,
                    segment_index,
                    chunk_idx as i32,
                );
                all_segments.push(segment.clone());
                all_texts.push((segment.id, hearing.id, statement.id, segment_index, chunk_text.clone()));
                segment_index += 1;
                stats.segments_created += 1;
            }
        }

        // Batch insert statements and segments
        self.db.hearing_statements().create_batch(&all_statements).await?;
        self.db.hearing_segments().create_batch(&all_segments).await?;

        // Generate embeddings and write to LanceDB
        if !all_texts.is_empty() {
            let text_refs: Vec<&str> = all_texts.iter().map(|(_, _, _, _, t)| t.as_str()).collect();
            let embeddings = self.embedder.embed_batch(&text_refs)?;
            stats.embeddings_created += embeddings.len();

            self.write_to_lancedb(&all_texts, &embeddings).await?;
        }

        // Mark hearing as processed
        self.db.hearings().mark_processed(
            hearing.id,
            stats.statements_created as i32,
            stats.segments_created as i32,
        ).await?;

        stats.files_processed += 1;
        Ok(stats)
    }

    /// Write embeddings to `LanceDB`
    async fn write_to_lancedb(
        &self,
        texts: &[(uuid::Uuid, uuid::Uuid, uuid::Uuid, i32, String)],
        embeddings: &[Vec<f32>],
    ) -> Result<()> {
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
                DataType::FixedSizeList(
                    Arc::new(Field::new("item", DataType::Float32, true)),
                    384,
                ),
                false,
            ),
        ]));

        let ids: Vec<String> = texts.iter().map(|(id, _, _, _, _)| id.to_string()).collect();
        let content_types: Vec<&str> = vec!["hearing"; texts.len()];
        let content_ids: Vec<String> = texts.iter().map(|(_, cid, _, _, _)| cid.to_string()).collect();
        let statement_ids: Vec<String> = texts.iter().map(|(_, _, sid, _, _)| sid.to_string()).collect();
        let segment_indices: Vec<i32> = texts.iter().map(|(_, _, _, idx, _)| *idx).collect();
        let text_values: Vec<&str> = texts.iter().map(|(_, _, _, _, t)| t.as_str()).collect();

        // Hearing segments don't have timestamps, use 0
        let start_times: Vec<i32> = vec![0; texts.len()];
        let end_times: Vec<i32> = vec![0; texts.len()];

        // Create embedding array using from_iter_primitive
        let embedding_lists: Vec<Option<Vec<Option<f32>>>> = embeddings
            .iter()
            .map(|e| Some(e.iter().copied().map(Some).collect()))
            .collect();
        let vector_array =
            FixedSizeListArray::from_iter_primitive::<Float32Type, _, _>(
                embedding_lists,
                384,
            );

        let batch = RecordBatch::try_new(
            schema.clone(),
            vec![
                Arc::new(StringArray::from(ids)),
                Arc::new(StringArray::from(content_types)),
                Arc::new(StringArray::from(content_ids)),
                Arc::new(StringArray::from(statement_ids)),
                Arc::new(Int32Array::from(segment_indices)),
                Arc::new(Int32Array::from(start_times)),
                Arc::new(Int32Array::from(end_times)),
                Arc::new(StringArray::from(text_values)),
                Arc::new(vector_array) as Arc<dyn Array>,
            ],
        )?;

        // Open or create the table
        let table = match self.lancedb.open_table("text_embeddings").execute().await {
            Ok(t) => t,
            Err(_) => {
                println!("{}", "Creating text_embeddings table...".cyan());
                let batches = RecordBatchIterator::new(vec![Ok(batch.clone())].into_iter(), schema.clone());
                self.lancedb
                    .create_table("text_embeddings", Box::new(batches))
                    .execute()
                    .await?
            }
        };

        let batches = RecordBatchIterator::new(vec![Ok(batch)].into_iter(), schema);
        table.add(Box::new(batches)).execute().await?;

        Ok(())
    }

    /// Ingest all JSON files in a directory
    ///
    /// # Errors
    /// Returns an error if directory reading fails
    pub async fn ingest_directory(
        &mut self,
        path: &Path,
        limit: Option<usize>,
    ) -> Result<IngestStats> {
        let mut total_stats = IngestStats::default();

        if !path.is_dir() {
            bail!("Path is not a directory: {}", path.display());
        }

        let mut entries: Vec<_> = fs::read_dir(path)?
            .filter_map(Result::ok)
            .filter(|e| {
                e.path()
                    .extension()
                    .is_some_and(|ext| ext == "json")
            })
            .collect();

        entries.sort_by_key(|a| a.path());

        if let Some(max) = limit {
            entries.truncate(max);
        }

        let total = entries.len();
        println!("{}", format!("Processing {} transcript files...", total).cyan());

        for (i, entry) in entries.into_iter().enumerate() {
            let file_path = entry.path();
            let progress = format!("[{}/{}]", i + 1, total).dimmed();
            let start = Instant::now();
            match self.ingest_file(&file_path).await {
                Ok(stats) => {
                    let duration = start.elapsed();
                    if stats.files_skipped > 0 {
                        println!("{} {} {}", progress, "Skipped".yellow(), file_path.display());
                    } else {
                        println!(
                            "{} {} {} ({} segments, {:.1}s)",
                            progress,
                            "Processed".green(),
                            file_path.display(),
                            stats.segments_created.to_string().cyan(),
                            duration.as_secs_f64()
                        );
                    }
                    total_stats.files_processed += stats.files_processed;
                    total_stats.files_skipped += stats.files_skipped;
                    total_stats.hearings_created += stats.hearings_created;
                    total_stats.statements_created += stats.statements_created;
                    total_stats.segments_created += stats.segments_created;
                    total_stats.embeddings_created += stats.embeddings_created;
                }
                Err(e) => {
                    println!(
                        "{} {} {}: {}",
                        progress,
                        "Failed".red(),
                        file_path.display(),
                        e
                    );
                }
            }
        }

        Ok(total_stats)
    }

    /// Validate JSON files without ingesting
    ///
    /// # Errors
    /// Returns an error if directory reading fails
    pub fn validate_directory(&self, path: &Path, limit: Option<usize>) -> Result<(usize, usize)> {
        if !path.is_dir() {
            bail!("Path is not a directory: {}", path.display());
        }

        let mut valid = 0;
        let mut invalid = 0;

        let mut entries: Vec<_> = fs::read_dir(path)?
            .filter_map(Result::ok)
            .filter(|e| {
                e.path()
                    .extension()
                    .is_some_and(|ext| ext == "json")
            })
            .collect();

        if let Some(max) = limit {
            entries.truncate(max);
        }

        for entry in entries {
            let file_path = entry.path();
            match fs::read_to_string(&file_path) {
                Ok(content) => match serde_json::from_str::<TranscriptJson>(&content) {
                    Ok(_) => valid += 1,
                    Err(e) => {
                        warn!("Invalid JSON {}: {}", file_path.display(), e);
                        invalid += 1;
                    }
                },
                Err(e) => {
                    warn!("Cannot read {}: {}", file_path.display(), e);
                    invalid += 1;
                }
            }
        }

        Ok((valid, invalid))
    }
}
