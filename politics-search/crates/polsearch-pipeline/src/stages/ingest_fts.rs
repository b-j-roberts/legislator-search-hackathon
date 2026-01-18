//! FTS-only ingestion for fast text search without embeddings

use arrow_array::{Int32Array, RecordBatch, RecordBatchIterator, StringArray};
use arrow_schema::{DataType, Field, Schema};
use chrono::NaiveDate;
use color_eyre::eyre::{bail, eyre, Result};
use polsearch_core::RollCallVote;
use polsearch_db::Database;
use serde::Deserialize;
use std::fs;
use std::path::Path;
use std::sync::Arc;
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
struct FtsRecord {
    id: String,
    content_type: String,
    content_id: String,
    statement_id: Option<String>,
    segment_index: i32,
    text: String,
}

/// FTS ingester for text-only ingestion without embeddings
pub struct FtsIngester {
    db: Database,
    chunker: TextChunker,
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

        Ok(Self {
            db,
            chunker: TextChunker::default(),
            lancedb,
            force,
        })
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

    /// Ingest a single hearing JSON file (text-only)
    async fn ingest_hearing_file(&self, path: &Path) -> Result<(usize, usize)> {
        let content = fs::read_to_string(path)?;
        let transcript: TranscriptJson = serde_json::from_str(&content)
            .map_err(|e| eyre!("Failed to parse {}: {}", path.display(), e))?;

        // Check if already exists in postgres
        if !self.force
            && self
                .db
                .hearings()
                .exists_by_package_id(&transcript.package_id)
                .await?
        {
            return Ok((0, 1)); // skipped
        }

        // Parse date
        let _hearing_date = NaiveDate::parse_from_str(&transcript.date, "%Y-%m-%d")
            .map_err(|e| eyre!("Invalid date format: {} - {}", transcript.date, e))?;

        // Process statements and create FTS records
        let mut records = Vec::new();
        let mut segment_index = 0;

        for stmt_json in &transcript.statements {
            if should_skip_statement(&stmt_json.text) {
                continue;
            }

            let statement_id = uuid::Uuid::now_v7();
            let chunks = self.chunker.chunk(&stmt_json.text);

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

        let segments_created = records.len();
        self.write_to_lancedb(&records).await?;

        Ok((segments_created, 0))
    }

    /// Ingest a single floor speech JSON file (text-only)
    async fn ingest_speech_file(&self, path: &Path) -> Result<(usize, usize)> {
        let content = fs::read_to_string(path)?;
        let speech: FloorSpeechJson = serde_json::from_str(&content)
            .map_err(|e| eyre!("Failed to parse {}: {}", path.display(), e))?;

        // Check if already exists
        if !self.force
            && self
                .db
                .floor_speeches()
                .exists_by_event_id(&speech.event_id)
                .await?
        {
            return Ok((0, 1)); // skipped
        }

        // Parse date
        let _speech_date = NaiveDate::parse_from_str(&speech.date, "%Y-%m-%d")
            .map_err(|e| eyre!("Invalid date format: {} - {}", speech.date, e))?;

        // Process statements and create FTS records
        let mut records = Vec::new();
        let mut segment_index = 0;

        for stmt_json in &speech.statements {
            if should_skip_statement(&stmt_json.text) {
                continue;
            }

            let statement_id = uuid::Uuid::now_v7();
            let chunks = self.chunker.chunk(&stmt_json.text);

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

        let segments_created = records.len();
        self.write_to_lancedb(&records).await?;

        Ok((segments_created, 0))
    }

    /// Ingest hearings from a directory (text-only)
    ///
    /// # Errors
    /// Returns an error if directory reading fails
    pub async fn ingest_hearings_directory(
        &mut self,
        path: &Path,
        limit: Option<usize>,
    ) -> Result<FtsIngestStats> {
        let mut stats = FtsIngestStats::default();

        if !path.is_dir() {
            bail!("Path is not a directory: {}", path.display());
        }

        let mut entries: Vec<_> = fs::read_dir(path)?
            .filter_map(Result::ok)
            .filter(|e| e.path().extension().is_some_and(|ext| ext == "json"))
            .collect();

        entries.sort_by_key(std::fs::DirEntry::path);

        if let Some(max) = limit {
            entries.truncate(max);
        }

        let total = entries.len();
        info!("Processing {} hearing files for FTS", total);

        for (i, entry) in entries.into_iter().enumerate() {
            let file_path = entry.path();
            match self.ingest_hearing_file(&file_path).await {
                Ok((segments, skipped)) => {
                    if skipped > 0 {
                        stats.hearings_skipped += 1;
                    } else {
                        stats.hearings_processed += 1;
                        stats.segments_created += segments;
                    }
                    if (i + 1) % 100 == 0 || i + 1 == total {
                        info!(
                            "[{}/{}] Hearings: {} processed, {} skipped, {} segments",
                            i + 1,
                            total,
                            stats.hearings_processed,
                            stats.hearings_skipped,
                            stats.segments_created
                        );
                    }
                }
                Err(e) => {
                    warn!("[{}/{}] Failed {}: {}", i + 1, total, file_path.display(), e);
                }
            }
        }

        Ok(stats)
    }

    /// Ingest floor speeches from a directory (text-only)
    ///
    /// # Errors
    /// Returns an error if directory reading fails
    pub async fn ingest_speeches_directory(
        &mut self,
        path: &Path,
        limit: Option<usize>,
    ) -> Result<FtsIngestStats> {
        let mut stats = FtsIngestStats::default();

        if !path.is_dir() {
            bail!("Path is not a directory: {}", path.display());
        }

        let mut entries: Vec<_> = fs::read_dir(path)?
            .filter_map(Result::ok)
            .filter(|e| e.path().extension().is_some_and(|ext| ext == "json"))
            .collect();

        entries.sort_by_key(std::fs::DirEntry::path);

        if let Some(max) = limit {
            entries.truncate(max);
        }

        let total = entries.len();
        info!("Processing {} floor speech files for FTS", total);

        for (i, entry) in entries.into_iter().enumerate() {
            let file_path = entry.path();
            match self.ingest_speech_file(&file_path).await {
                Ok((segments, skipped)) => {
                    if skipped > 0 {
                        stats.speeches_skipped += 1;
                    } else {
                        stats.speeches_processed += 1;
                        stats.segments_created += segments;
                    }
                    if (i + 1) % 100 == 0 || i + 1 == total {
                        info!(
                            "[{}/{}] Speeches: {} processed, {} skipped, {} segments",
                            i + 1,
                            total,
                            stats.speeches_processed,
                            stats.speeches_skipped,
                            stats.segments_created
                        );
                    }
                }
                Err(e) => {
                    warn!("[{}/{}] Failed {}: {}", i + 1, total, file_path.display(), e);
                }
            }
        }

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
