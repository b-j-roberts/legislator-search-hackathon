//! FTS-only ingestion for fast text search without embeddings

use arrow_array::{Array, Int32Array, RecordBatch, RecordBatchIterator, StringArray};
use arrow_schema::{DataType, Field, Schema};
use color_eyre::eyre::{bail, Result};
use polsearch_core::RollCallVote;
use polsearch_db::Database;
use rayon::prelude::*;
use serde::Deserialize;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Instant;
use tracing::{info, warn};

use super::chunk::TextChunker;
use super::procedural_filter::should_skip_statement;

/// FTS table name
pub const FTS_TABLE_NAME: &str = "text_fts";

/// Raw transcript JSON structure (same as `ingest_hearings`)
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

/// Raw floor speech JSON structure (same as `ingest_floor_speeches`)
#[derive(Debug, Deserialize)]
pub struct FloorSpeechJson {
    pub event_id: String,
    pub granule_id: String,
    pub title: String,
    pub date: String,
    pub chamber: String,
    pub page_type: Option<String>,
    pub source_url: String,
    pub statements: Vec<FloorSpeechStatementJson>,
}

/// Statement entry in floor speech JSON
#[derive(Debug, Deserialize)]
pub struct FloorSpeechStatementJson {
    pub speaker: String,
    pub text: String,
    pub index: i32,
}

/// FTS ingestion statistics
#[derive(Debug, Default)]
pub struct FtsIngestStats {
    pub hearings_processed: usize,
    pub hearings_skipped: usize,
    pub speeches_processed: usize,
    pub speeches_skipped: usize,
    pub votes_processed: usize,
    pub votes_skipped: usize,
    pub segments_created: usize,
}

/// FTS record for writing to `LanceDB`
#[derive(Clone)]
struct FtsRecord {
    id: String,
    content_type: String,
    content_id: String,
    statement_id: Option<String>,
    segment_index: i32,
    text: String,
}

/// Result of parsing a single file
struct ParseResult {
    records: Vec<FtsRecord>,
    skipped: bool,
}

/// FTS ingester for text-only ingestion without embeddings
pub struct FtsIngester {
    db: Database,
    lancedb: lancedb::Connection,
    force: bool,
}

impl FtsIngester {
    /// Creates a new FTS ingester
    ///
    /// # Errors
    /// Returns an error if `LanceDB` fails to initialize
    pub async fn new(db: Database, lancedb_path: &str, force: bool) -> Result<Self> {
        let lancedb = lancedb::connect(lancedb_path).execute().await?;

        Ok(Self { db, lancedb, force })
    }

    /// Get the FTS table schema (no vector column)
    fn fts_schema() -> Arc<Schema> {
        Arc::new(Schema::new(vec![
            Field::new("id", DataType::Utf8, false),
            Field::new("content_type", DataType::Utf8, false),
            Field::new("content_id", DataType::Utf8, false),
            Field::new("statement_id", DataType::Utf8, true),
            Field::new("segment_index", DataType::Int32, false),
            Field::new("text", DataType::Utf8, false),
        ]))
    }

    /// Write FTS records to `LanceDB`
    async fn write_to_lancedb(&self, records: &[FtsRecord]) -> Result<()> {
        if records.is_empty() {
            return Ok(());
        }

        let schema = Self::fts_schema();

        let ids: Vec<&str> = records.iter().map(|r| r.id.as_str()).collect();
        let content_types: Vec<&str> = records.iter().map(|r| r.content_type.as_str()).collect();
        let content_ids: Vec<&str> = records.iter().map(|r| r.content_id.as_str()).collect();
        let statement_ids: Vec<Option<&str>> = records
            .iter()
            .map(|r| r.statement_id.as_deref())
            .collect();
        let segment_indices: Vec<i32> = records.iter().map(|r| r.segment_index).collect();
        let texts: Vec<&str> = records.iter().map(|r| r.text.as_str()).collect();

        let batch = RecordBatch::try_new(
            schema.clone(),
            vec![
                Arc::new(StringArray::from(ids)),
                Arc::new(StringArray::from(content_types)),
                Arc::new(StringArray::from(content_ids)),
                Arc::new(StringArray::from(statement_ids)),
                Arc::new(Int32Array::from(segment_indices)),
                Arc::new(StringArray::from(texts)),
            ],
        )?;

        let table = match self.lancedb.open_table(FTS_TABLE_NAME).execute().await {
            Ok(t) => t,
            Err(_) => {
                info!("Creating {} table", FTS_TABLE_NAME);
                let batches =
                    RecordBatchIterator::new(vec![Ok(batch.clone())].into_iter(), schema.clone());
                self.lancedb
                    .create_table(FTS_TABLE_NAME, Box::new(batches))
                    .execute()
                    .await?
            }
        };

        let batches = RecordBatchIterator::new(vec![Ok(batch)].into_iter(), schema);
        table.add(Box::new(batches)).execute().await?;

        Ok(())
    }

    /// Parse a single hearing JSON file (pure CPU work, no async)
    fn parse_hearing_file(path: &Path, skip_ids: &HashSet<String>) -> Option<ParseResult> {
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(e) => {
                warn!("Failed to read {}: {}", path.display(), e);
                return None;
            }
        };

        let transcript: TranscriptJson = match serde_json::from_str(&content) {
            Ok(t) => t,
            Err(e) => {
                warn!("Failed to parse {}: {}", path.display(), e);
                return None;
            }
        };

        // Check if should skip
        if skip_ids.contains(&transcript.package_id) {
            return Some(ParseResult {
                records: vec![],
                skipped: true,
            });
        }

        let chunker = TextChunker::default();
        let mut records = Vec::new();
        let mut segment_index = 0;

        for stmt_json in &transcript.statements {
            if should_skip_statement(&stmt_json.text) {
                continue;
            }

            let statement_id = uuid::Uuid::now_v7();
            let chunks = chunker.chunk(&stmt_json.text);

            for chunk_text in &chunks {
                let segment_id = uuid::Uuid::now_v7();
                records.push(FtsRecord {
                    id: segment_id.to_string(),
                    content_type: "hearing".to_string(),
                    content_id: transcript.package_id.clone(),
                    statement_id: Some(statement_id.to_string()),
                    segment_index,
                    text: chunk_text.clone(),
                });
                segment_index += 1;
            }
        }

        Some(ParseResult {
            records,
            skipped: false,
        })
    }

    /// Parse a single floor speech JSON file (pure CPU work, no async)
    fn parse_speech_file(path: &Path, skip_ids: &HashSet<String>) -> Option<ParseResult> {
        let content = match fs::read_to_string(path) {
            Ok(c) => c,
            Err(e) => {
                warn!("Failed to read {}: {}", path.display(), e);
                return None;
            }
        };

        let speech: FloorSpeechJson = match serde_json::from_str(&content) {
            Ok(s) => s,
            Err(e) => {
                warn!("Failed to parse {}: {}", path.display(), e);
                return None;
            }
        };

        // Check if should skip
        if skip_ids.contains(&speech.event_id) {
            return Some(ParseResult {
                records: vec![],
                skipped: true,
            });
        }

        let chunker = TextChunker::default();
        let mut records = Vec::new();
        let mut segment_index = 0;

        for stmt_json in &speech.statements {
            if should_skip_statement(&stmt_json.text) {
                continue;
            }

            let statement_id = uuid::Uuid::now_v7();
            let chunks = chunker.chunk(&stmt_json.text);

            for chunk_text in &chunks {
                let segment_id = uuid::Uuid::now_v7();
                records.push(FtsRecord {
                    id: segment_id.to_string(),
                    content_type: "floor_speech".to_string(),
                    content_id: speech.event_id.clone(),
                    statement_id: Some(statement_id.to_string()),
                    segment_index,
                    text: chunk_text.clone(),
                });
                segment_index += 1;
            }
        }

        Some(ParseResult {
            records,
            skipped: false,
        })
    }

    /// Get existing hearing content IDs from `LanceDB` FTS table
    async fn get_existing_hearing_ids(&self) -> Result<HashSet<String>> {
        if self.force {
            return Ok(HashSet::new());
        }
        self.get_existing_content_ids("hearing").await
    }

    /// Get existing floor speech content IDs from `LanceDB` FTS table
    async fn get_existing_speech_ids(&self) -> Result<HashSet<String>> {
        if self.force {
            return Ok(HashSet::new());
        }
        self.get_existing_content_ids("floor_speech").await
    }

    /// Get existing content IDs from `LanceDB` FTS table for a given content type
    async fn get_existing_content_ids(&self, content_type: &str) -> Result<HashSet<String>> {
        use arrow_array::cast::AsArray;
        use futures::TryStreamExt;
        use lancedb::query::{ExecutableQuery, QueryBase};

        let table = match self.lancedb.open_table(FTS_TABLE_NAME).execute().await {
            Ok(t) => t,
            Err(_) => return Ok(HashSet::new()),
        };

        let filter = format!("content_type = '{content_type}'");

        let batches: Vec<RecordBatch> = table
            .query()
            .select(lancedb::query::Select::columns(&["content_id"]))
            .only_if(filter)
            .execute()
            .await?
            .try_collect()
            .await?;

        let mut ids = HashSet::new();
        for batch in batches {
            if let Some(col) = batch.column_by_name("content_id") {
                let string_array = col.as_string::<i32>();
                for i in 0..string_array.len() {
                    if !string_array.is_null(i) {
                        ids.insert(string_array.value(i).to_string());
                    }
                }
            }
        }

        Ok(ids)
    }

    /// Ingest hearings from a directory using parallel processing
    ///
    /// # Errors
    /// Returns an error if directory reading fails
    pub async fn ingest_hearings_directory(
        &mut self,
        path: &Path,
        limit: Option<usize>,
    ) -> Result<FtsIngestStats> {
        if !path.is_dir() {
            bail!("Path is not a directory: {}", path.display());
        }

        let mut entries: Vec<PathBuf> = fs::read_dir(path)?
            .filter_map(Result::ok)
            .filter(|e| e.path().extension().is_some_and(|ext| ext == "json"))
            .map(|e| e.path())
            .collect();

        entries.sort();

        if let Some(max) = limit {
            entries.truncate(max);
        }

        let total = entries.len();
        info!("Processing {} hearing files for FTS (parallel)", total);

        // Get existing IDs to skip
        let skip_ids = self.get_existing_hearing_ids().await?;
        info!("Found {} existing hearings to skip", skip_ids.len());

        // Progress tracking
        let processed_count = AtomicUsize::new(0);
        let start_time = Instant::now();

        // Parse files in parallel
        let results: Vec<ParseResult> = entries
            .par_iter()
            .filter_map(|path| {
                let result = Self::parse_hearing_file(path, &skip_ids);
                let count = processed_count.fetch_add(1, Ordering::Relaxed) + 1;
                if count % 500 == 0 || count == total {
                    let elapsed = start_time.elapsed().as_secs_f64();
                    let rate = count as f64 / elapsed;
                    let remaining = total - count;
                    let eta_secs = if rate > 0.0 {
                        remaining as f64 / rate
                    } else {
                        0.0
                    };
                    info!(
                        "[{}/{}] Parsing hearings... {:.0} files/sec, ETA: {:.0}s",
                        count, total, rate, eta_secs
                    );
                }
                result
            })
            .collect();

        // Aggregate stats and records
        let mut stats = FtsIngestStats::default();
        let mut all_records = Vec::new();

        for result in results {
            if result.skipped {
                stats.hearings_skipped += 1;
            } else {
                stats.hearings_processed += 1;
                stats.segments_created += result.records.len();
                all_records.extend(result.records);
            }
        }

        // Write to LanceDB in batches
        const BATCH_SIZE: usize = 10000;
        let total_records = all_records.len();
        for (i, chunk) in all_records.chunks(BATCH_SIZE).enumerate() {
            self.write_to_lancedb(chunk).await?;
            info!(
                "Written batch {}/{} ({} records)",
                i + 1,
                total_records.div_ceil(BATCH_SIZE),
                chunk.len()
            );
        }

        info!(
            "Hearings complete: {} processed, {} skipped, {} segments",
            stats.hearings_processed, stats.hearings_skipped, stats.segments_created
        );

        Ok(stats)
    }

    /// Ingest floor speeches from a directory using parallel processing
    ///
    /// # Errors
    /// Returns an error if directory reading fails
    pub async fn ingest_speeches_directory(
        &mut self,
        path: &Path,
        limit: Option<usize>,
    ) -> Result<FtsIngestStats> {
        if !path.is_dir() {
            bail!("Path is not a directory: {}", path.display());
        }

        let mut entries: Vec<PathBuf> = fs::read_dir(path)?
            .filter_map(Result::ok)
            .filter(|e| e.path().extension().is_some_and(|ext| ext == "json"))
            .map(|e| e.path())
            .collect();

        entries.sort();

        if let Some(max) = limit {
            entries.truncate(max);
        }

        let total = entries.len();
        info!("Processing {} floor speech files for FTS (parallel)", total);

        // Get existing IDs to skip
        let skip_ids = self.get_existing_speech_ids().await?;
        info!("Found {} existing speeches to skip", skip_ids.len());

        // Progress tracking
        let processed_count = AtomicUsize::new(0);
        let start_time = Instant::now();

        // Parse files in parallel
        let results: Vec<ParseResult> = entries
            .par_iter()
            .filter_map(|path| {
                let result = Self::parse_speech_file(path, &skip_ids);
                let count = processed_count.fetch_add(1, Ordering::Relaxed) + 1;
                if count % 500 == 0 || count == total {
                    let elapsed = start_time.elapsed().as_secs_f64();
                    let rate = count as f64 / elapsed;
                    let remaining = total - count;
                    let eta_secs = if rate > 0.0 {
                        remaining as f64 / rate
                    } else {
                        0.0
                    };
                    info!(
                        "[{}/{}] Parsing speeches... {:.0} files/sec, ETA: {:.0}s",
                        count, total, rate, eta_secs
                    );
                }
                result
            })
            .collect();

        // Aggregate stats and records
        let mut stats = FtsIngestStats::default();
        let mut all_records = Vec::new();

        for result in results {
            if result.skipped {
                stats.speeches_skipped += 1;
            } else {
                stats.speeches_processed += 1;
                stats.segments_created += result.records.len();
                all_records.extend(result.records);
            }
        }

        // Write to LanceDB in batches
        const BATCH_SIZE: usize = 10000;
        let total_records = all_records.len();
        for (i, chunk) in all_records.chunks(BATCH_SIZE).enumerate() {
            self.write_to_lancedb(chunk).await?;
            info!(
                "Written batch {}/{} ({} records)",
                i + 1,
                total_records.div_ceil(BATCH_SIZE),
                chunk.len()
            );
        }

        info!(
            "Speeches complete: {} processed, {} skipped, {} segments",
            stats.speeches_processed, stats.speeches_skipped, stats.segments_created
        );

        Ok(stats)
    }

    /// Ingest votes from `PostgreSQL` (text-only)
    ///
    /// # Errors
    /// Returns an error if database operations fail
    pub async fn ingest_votes(&mut self, limit: Option<usize>) -> Result<FtsIngestStats> {
        let mut stats = FtsIngestStats::default();

        let total_count = self.db.roll_call_votes().count().await?;
        info!("Found {} votes in database", total_count);

        const BATCH_SIZE: i64 = 500;
        let mut offset = 0i64;
        let max_votes = limit.map_or(i64::MAX, |l| l as i64);

        loop {
            let remaining = max_votes - offset;
            if remaining <= 0 {
                break;
            }

            let fetch_size = BATCH_SIZE.min(remaining);
            let votes = self
                .db
                .roll_call_votes()
                .get_all_paginated(offset, fetch_size)
                .await?;

            if votes.is_empty() {
                break;
            }

            // Filter out already processed if not forcing
            let votes_to_process: Vec<&RollCallVote> = if self.force {
                votes.iter().collect()
            } else {
                let mut filtered = Vec::new();
                for vote in &votes {
                    let exists = self.check_vote_exists(&vote.id.to_string()).await?;
                    if !exists {
                        filtered.push(vote);
                    } else {
                        stats.votes_skipped += 1;
                    }
                }
                filtered
            };

            if !votes_to_process.is_empty() {
                let records: Vec<FtsRecord> = votes_to_process
                    .iter()
                    .map(|v| {
                        let text = build_vote_text(v);
                        FtsRecord {
                            id: v.id.to_string(),
                            content_type: "vote".to_string(),
                            content_id: v.id.to_string(),
                            statement_id: None,
                            segment_index: 0,
                            text,
                        }
                    })
                    .collect();

                stats.votes_processed += records.len();
                stats.segments_created += records.len();
                self.write_to_lancedb(&records).await?;
            }

            let processed = offset + votes.len() as i64;
            if processed % 500 == 0 || votes.len() < BATCH_SIZE as usize {
                info!(
                    "Votes: {}/{} processed, {} skipped",
                    stats.votes_processed, total_count, stats.votes_skipped
                );
            }

            offset += votes.len() as i64;

            if votes.len() < BATCH_SIZE as usize {
                break;
            }
        }

        Ok(stats)
    }

    /// Check if a vote already exists in the FTS table
    async fn check_vote_exists(&self, vote_id: &str) -> Result<bool> {
        use futures::TryStreamExt;
        use lancedb::query::{ExecutableQuery, QueryBase};

        let table = match self.lancedb.open_table(FTS_TABLE_NAME).execute().await {
            Ok(t) => t,
            Err(_) => return Ok(false),
        };

        let filter = format!("content_type = 'vote' AND id = '{vote_id}'");

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

    /// Create FTS index on the text column
    ///
    /// # Errors
    /// Returns an error if index creation fails
    pub async fn create_fts_index(&self) -> Result<()> {
        use lancedb::index::Index;
        use lancedb::table::OptimizeAction;

        let table = self.lancedb.open_table(FTS_TABLE_NAME).execute().await?;

        info!("Creating FTS index on {}.text column", FTS_TABLE_NAME);
        table
            .create_index(
                &["text"],
                Index::FTS(lancedb::index::scalar::FtsIndexBuilder::default()),
            )
            .execute()
            .await?;

        info!("Optimizing table");
        table.optimize(OptimizeAction::All).await?;

        Ok(())
    }
}

/// Build searchable text from vote data
fn build_vote_text(vote: &RollCallVote) -> String {
    let mut parts = vec![vote.question.clone()];

    if let Some(ref subject) = vote.subject {
        if !subject.is_empty() {
            parts.push(subject.clone());
        }
    }

    if let Some(ref result_text) = vote.result_text {
        if !result_text.is_empty() {
            parts.push(result_text.clone());
        }
    }

    parts.join(". ")
}
