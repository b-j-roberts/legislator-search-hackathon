//! Archive store for raw transcript and diarization data

use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};

use bytemuck::{Pod, Zeroable, cast_slice};
use rusqlite::{Connection, params};
use uuid::Uuid;

use crate::ArchiveError;

/// Raw transcript segment data for archival
#[derive(Debug, Clone)]
pub struct TranscriptSegmentRaw {
    pub segment_index: i32,
    pub token_confidences: Vec<f32>,
    pub token_start_times_ms: Vec<i64>,
    pub token_end_times_ms: Vec<i64>,
}

/// Raw diarization segment data for archival
#[derive(Debug, Clone)]
pub struct DiarizationSegmentRaw {
    pub segment_index: i32,
    pub quality_score: f32,
}

/// Archive store for raw transcript and diarization data
///
/// Stores data in `SQLite` files organized by podcast ID:
/// `{base_path}/{podcast_id}/raw_data.sqlite`
pub struct ArchiveStore(PathBuf);

impl ArchiveStore {
    /// Create a new archive store at the given base path
    pub fn new(base_path: impl AsRef<Path>) -> Self {
        Self(base_path.as_ref().to_path_buf())
    }

    /// Create archive store at the default location (`~/.polsearch/archive`)
    pub fn default_location() -> Option<Self> {
        let home = dirs::home_dir()?;
        Some(Self::new(home.join(".polsearch").join("archive")))
    }

    /// Get the `SQLite` database path for a podcast
    fn db_path(&self, podcast_id: Uuid) -> PathBuf {
        self.0.join(podcast_id.to_string()).join("raw_data.sqlite")
    }

    /// Ensure the archive directory exists and return a connection
    fn get_connection(&self, podcast_id: Uuid) -> Result<Connection, ArchiveError> {
        let db_path = self.db_path(podcast_id);
        let dir = db_path.parent().expect("db_path should have parent");

        if !dir.exists() {
            fs::create_dir_all(dir).map_err(|e| ArchiveError::CreateDir {
                path: dir.to_path_buf(),
                source: e,
            })?;
        }

        let conn = Connection::open(&db_path)?;
        self.ensure_schema(&conn)?;
        Ok(conn)
    }

    /// Create tables if they don't exist
    fn ensure_schema(&self, conn: &Connection) -> Result<(), ArchiveError> {
        conn.execute_batch(
            r"
            CREATE TABLE IF NOT EXISTS transcript_raw (
                content_id TEXT NOT NULL,
                segment_index INTEGER NOT NULL,
                token_confidences BLOB,
                token_start_times BLOB,
                token_end_times BLOB,
                PRIMARY KEY (content_id, segment_index)
            );

            CREATE TABLE IF NOT EXISTS diarization_raw (
                content_id TEXT NOT NULL,
                segment_index INTEGER NOT NULL,
                quality_score REAL,
                PRIMARY KEY (content_id, segment_index)
            );

            CREATE INDEX IF NOT EXISTS idx_transcript_episode ON transcript_raw(content_id);
            CREATE INDEX IF NOT EXISTS idx_diarization_episode ON diarization_raw(content_id);
            ",
        )?;
        Ok(())
    }

    /// Store raw transcript data for an episode
    pub fn store_transcript_raw(
        &self,
        podcast_id: Uuid,
        content_id: Uuid,
        segments: &[TranscriptSegmentRaw],
    ) -> Result<(), ArchiveError> {
        let conn = self.get_connection(podcast_id)?;
        let content_id_str = content_id.to_string();

        let mut stmt = conn.prepare(
            r"
            INSERT OR REPLACE INTO transcript_raw
                (content_id, segment_index, token_confidences, token_start_times, token_end_times)
            VALUES (?1, ?2, ?3, ?4, ?5)
            ",
        )?;

        for segment in segments {
            let confidences = compress_f32_array(&segment.token_confidences)?;
            let start_times = compress_i64_array(&segment.token_start_times_ms)?;
            let end_times = compress_i64_array(&segment.token_end_times_ms)?;

            stmt.execute(params![
                &content_id_str,
                segment.segment_index,
                confidences,
                start_times,
                end_times,
            ])?;
        }

        tracing::debug!(
            podcast_id = %podcast_id,
            content_id = %content_id,
            segments = segments.len(),
            "Stored raw transcript data"
        );

        Ok(())
    }

    /// Store raw diarization data for an episode
    pub fn store_diarization_raw(
        &self,
        podcast_id: Uuid,
        content_id: Uuid,
        segments: &[DiarizationSegmentRaw],
    ) -> Result<(), ArchiveError> {
        let conn = self.get_connection(podcast_id)?;
        let content_id_str = content_id.to_string();

        let mut stmt = conn.prepare(
            r"
            INSERT OR REPLACE INTO diarization_raw
                (content_id, segment_index, quality_score)
            VALUES (?1, ?2, ?3)
            ",
        )?;

        for segment in segments {
            stmt.execute(params![
                &content_id_str,
                segment.segment_index,
                segment.quality_score,
            ])?;
        }

        tracing::debug!(
            podcast_id = %podcast_id,
            content_id = %content_id,
            segments = segments.len(),
            "Stored raw diarization data"
        );

        Ok(())
    }

    /// Check if raw data exists for an episode
    pub fn has_raw_data(&self, podcast_id: Uuid, content_id: Uuid) -> Result<bool, ArchiveError> {
        let db_path = self.db_path(podcast_id);
        if !db_path.exists() {
            return Ok(false);
        }

        let conn = Connection::open(&db_path)?;
        let content_id_str = content_id.to_string();

        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM transcript_raw WHERE content_id = ?1",
            [&content_id_str],
            |row| row.get(0),
        )?;

        Ok(count > 0)
    }

    /// Check if archive database exists for a podcast
    pub fn archive_exists(&self, podcast_id: Uuid) -> bool {
        self.db_path(podcast_id).exists()
    }

    /// Count `transcript_raw` segments for an episode
    pub fn count_transcript_raw(
        &self,
        podcast_id: Uuid,
        content_id: Uuid,
    ) -> Result<usize, ArchiveError> {
        let db_path = self.db_path(podcast_id);
        if !db_path.exists() {
            return Ok(0);
        }

        let conn = Connection::open(&db_path)?;
        let content_id_str = content_id.to_string();

        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM transcript_raw WHERE content_id = ?1",
            [&content_id_str],
            |row| row.get(0),
        )?;

        Ok(count as usize)
    }

    /// Count `diarization_raw` segments for an episode
    pub fn count_diarization_raw(
        &self,
        podcast_id: Uuid,
        content_id: Uuid,
    ) -> Result<usize, ArchiveError> {
        let db_path = self.db_path(podcast_id);
        if !db_path.exists() {
            return Ok(0);
        }

        let conn = Connection::open(&db_path)?;
        let content_id_str = content_id.to_string();

        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM diarization_raw WHERE content_id = ?1",
            [&content_id_str],
            |row| row.get(0),
        )?;

        Ok(count as usize)
    }
}

// bytemuck requires these traits for safe casting
#[derive(Clone, Copy, Pod, Zeroable)]
#[repr(C)]
struct F32Wrapper(f32);

#[derive(Clone, Copy, Pod, Zeroable)]
#[repr(C)]
struct I64Wrapper(i64);

/// Compress a f32 array using zstd
fn compress_f32_array(data: &[f32]) -> Result<Vec<u8>, ArchiveError> {
    let bytes: &[u8] = cast_slice(data);
    let mut encoder = zstd::Encoder::new(Vec::new(), 3)?;
    encoder.write_all(bytes)?;
    Ok(encoder.finish()?)
}

/// Compress an i64 array using zstd
fn compress_i64_array(data: &[i64]) -> Result<Vec<u8>, ArchiveError> {
    let bytes: &[u8] = cast_slice(data);
    let mut encoder = zstd::Encoder::new(Vec::new(), 3)?;
    encoder.write_all(bytes)?;
    Ok(encoder.finish()?)
}

/// Decompress a f32 array from zstd
// TODO: used when archive retrieval API is implemented
#[allow(dead_code)]
fn decompress_f32_array(data: &[u8]) -> Result<Vec<f32>, ArchiveError> {
    let mut decoder = zstd::Decoder::new(data)?;
    let mut bytes = Vec::new();
    decoder.read_to_end(&mut bytes)?;

    // ensure alignment
    let float_count = bytes.len() / std::mem::size_of::<f32>();
    let floats: Vec<f32> = bytes
        .chunks_exact(std::mem::size_of::<f32>())
        .map(|chunk| f32::from_le_bytes(chunk.try_into().expect("chunk size is 4")))
        .collect();

    debug_assert_eq!(floats.len(), float_count);
    Ok(floats)
}

/// Decompress an i64 array from zstd
// TODO: used when archive retrieval API is implemented
#[allow(dead_code)]
fn decompress_i64_array(data: &[u8]) -> Result<Vec<i64>, ArchiveError> {
    let mut decoder = zstd::Decoder::new(data)?;
    let mut bytes = Vec::new();
    decoder.read_to_end(&mut bytes)?;

    let int_count = bytes.len() / std::mem::size_of::<i64>();
    let ints: Vec<i64> = bytes
        .chunks_exact(std::mem::size_of::<i64>())
        .map(|chunk| i64::from_le_bytes(chunk.try_into().expect("chunk size is 8")))
        .collect();

    debug_assert_eq!(ints.len(), int_count);
    Ok(ints)
}
