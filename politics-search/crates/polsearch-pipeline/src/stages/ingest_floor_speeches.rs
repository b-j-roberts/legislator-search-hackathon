//! Floor speech ingestion from JSON transcript files

use arrow_array::{
    types::Float32Type, Array, FixedSizeListArray, Int32Array, RecordBatch, RecordBatchIterator,
    StringArray,
};
use arrow_schema::{DataType, Field, Schema};
use chrono::{Datelike, NaiveDate};
use color_eyre::eyre::{bail, eyre, Result};
use polsearch_core::{FloorSpeech, FloorSpeechSegment, FloorSpeechStatement};
use polsearch_db::Database;
use serde::Deserialize;
use std::fs;
use std::path::Path;
use std::sync::Arc;
use tracing::{info, warn};

use super::chunk::TextChunker;
use super::embed::TextEmbedder;
use super::procedural_filter::should_skip_statement;

/// Raw floor speech JSON structure (output from fetch-floor-speeches)
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

/// Floor speech ingestion statistics
#[derive(Debug, Default)]
pub struct FloorSpeechIngestStats {
    pub files_processed: usize,
    pub files_skipped: usize,
    pub speeches_created: usize,
    pub statements_created: usize,
    pub segments_created: usize,
    pub embeddings_created: usize,
}

/// Floor speech ingester for processing transcript JSON files
pub struct FloorSpeechIngester {
    db: Database,
    chunker: TextChunker,
    embedder: TextEmbedder,
    lancedb: lancedb::Connection,
    force: bool,
    year_filter: Option<i32>,
}

impl FloorSpeechIngester {
    /// Creates a new floor speech ingester
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

    /// Ingest a single floor speech JSON file
    ///
    /// # Errors
    /// Returns an error if parsing or database operations fail
    pub async fn ingest_file(&mut self, path: &Path) -> Result<FloorSpeechIngestStats> {
        let mut stats = FloorSpeechIngestStats::default();

        let content = fs::read_to_string(path)?;
        let speech_json: FloorSpeechJson = serde_json::from_str(&content)
            .map_err(|e| eyre!("Failed to parse {}: {}", path.display(), e))?;

        // check if already exists
        if !self.force
            && self
                .db
                .floor_speeches()
                .exists_by_event_id(&speech_json.event_id)
                .await?
        {
            stats.files_skipped += 1;
            return Ok(stats);
        }

        // delete existing if force mode
        if self.force {
            if let Some(existing) = self
                .db
                .floor_speeches()
                .get_by_event_id(&speech_json.event_id)
                .await?
            {
                self.db.floor_speeches().delete(existing.id).await?;
            }
        }

        // parse date
        let speech_date = NaiveDate::parse_from_str(&speech_json.date, "%Y-%m-%d")
            .map_err(|e| eyre!("Invalid date format: {} - {}", speech_json.date, e))?;

        // skip if year doesn't match filter
        if let Some(target_year) = self.year_filter {
            if speech_date.year() != target_year {
                stats.files_skipped += 1;
                return Ok(stats);
            }
        }

        // create floor speech record
        let floor_speech = FloorSpeech::new(
            speech_json.event_id.clone(),
            speech_json.granule_id.clone(),
            speech_json.title.clone(),
            speech_json.chamber.clone(),
            speech_date,
            speech_json.source_url.clone(),
        );
        self.db.floor_speeches().create(&floor_speech).await?;
        stats.speeches_created += 1;

        // process statements and create segments
        let mut all_statements = Vec::new();
        let mut all_segments = Vec::new();
        let mut all_texts = Vec::new();
        let mut segment_index = 0;

        for stmt_json in &speech_json.statements {
            // skip procedural statements
            if should_skip_statement(&stmt_json.text) {
                continue;
            }

            let statement = FloorSpeechStatement::new(
                floor_speech.id,
                stmt_json.index,
                stmt_json.speaker.clone(),
                stmt_json.text.clone(),
            );
            all_statements.push(statement.clone());
            stats.statements_created += 1;

            // chunk the statement
            let chunks = self.chunker.chunk(&stmt_json.text);
            for (chunk_idx, chunk_text) in chunks.iter().enumerate() {
                let segment = FloorSpeechSegment::new(
                    floor_speech.id,
                    statement.id,
                    segment_index,
                    chunk_idx as i32,
                    chunk_text,
                );
                all_segments.push(segment.clone());
                all_texts.push((
                    segment.id,
                    floor_speech.id,
                    statement.id,
                    segment_index,
                    chunk_text.clone(),
                ));
                segment_index += 1;
                stats.segments_created += 1;
            }
        }

        // batch insert statements and segments
        self.db
            .floor_speech_statements()
            .create_batch(&all_statements)
            .await?;
        self.db
            .floor_speech_segments()
            .create_batch(&all_segments)
            .await?;

        // generate embeddings and write to LanceDB
        if !all_texts.is_empty() {
            let text_refs: Vec<&str> = all_texts.iter().map(|(_, _, _, _, t)| t.as_str()).collect();
            let embeddings = self.embedder.embed_batch(&text_refs)?;
            stats.embeddings_created += embeddings.len();

            self.write_to_lancedb(&all_texts, &embeddings).await?;
        }

        // mark floor speech as processed
        self.db
            .floor_speeches()
            .mark_processed(
                floor_speech.id,
                stats.statements_created as i32,
                stats.segments_created as i32,
            )
            .await?;

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
        let content_types: Vec<&str> = vec!["floor_speech"; texts.len()];
        let content_ids: Vec<String> = texts
            .iter()
            .map(|(_, cid, _, _, _)| cid.to_string())
            .collect();
        let statement_ids: Vec<String> = texts
            .iter()
            .map(|(_, _, sid, _, _)| sid.to_string())
            .collect();
        let segment_indices: Vec<i32> = texts.iter().map(|(_, _, _, idx, _)| *idx).collect();
        let text_values: Vec<&str> = texts.iter().map(|(_, _, _, _, t)| t.as_str()).collect();

        // floor speech segments don't have timestamps, use 0
        let start_times: Vec<i32> = vec![0; texts.len()];
        let end_times: Vec<i32> = vec![0; texts.len()];

        // create embedding array
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
                Arc::new(StringArray::from(statement_ids)),
                Arc::new(Int32Array::from(segment_indices)),
                Arc::new(Int32Array::from(start_times)),
                Arc::new(Int32Array::from(end_times)),
                Arc::new(StringArray::from(text_values)),
                Arc::new(vector_array) as Arc<dyn Array>,
            ],
        )?;

        // open or create the table
        let table = match self.lancedb.open_table("text_embeddings").execute().await {
            Ok(t) => t,
            Err(_) => {
                info!("Creating text_embeddings table");
                let batches =
                    RecordBatchIterator::new(vec![Ok(batch.clone())].into_iter(), schema.clone());
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
    ) -> Result<FloorSpeechIngestStats> {
        let mut total_stats = FloorSpeechIngestStats::default();

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
        info!("Processing {} floor speech files", total);

        for (i, entry) in entries.into_iter().enumerate() {
            let file_path = entry.path();
            match self.ingest_file(&file_path).await {
                Ok(stats) => {
                    if stats.files_skipped > 0 {
                        info!(
                            "[{}/{}] Skipped {} (already exists)",
                            i + 1,
                            total,
                            file_path.display()
                        );
                    } else {
                        info!(
                            "[{}/{}] Processed {} ({} segments)",
                            i + 1,
                            total,
                            file_path.display(),
                            stats.segments_created
                        );
                    }
                    total_stats.files_processed += stats.files_processed;
                    total_stats.files_skipped += stats.files_skipped;
                    total_stats.speeches_created += stats.speeches_created;
                    total_stats.statements_created += stats.statements_created;
                    total_stats.segments_created += stats.segments_created;
                    total_stats.embeddings_created += stats.embeddings_created;
                }
                Err(e) => {
                    warn!(
                        "[{}/{}] Failed to process {}: {}",
                        i + 1,
                        total,
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
            .filter(|e| e.path().extension().is_some_and(|ext| ext == "json"))
            .collect();

        if let Some(max) = limit {
            entries.truncate(max);
        }

        for entry in entries {
            let file_path = entry.path();
            match fs::read_to_string(&file_path) {
                Ok(content) => match serde_json::from_str::<FloorSpeechJson>(&content) {
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
