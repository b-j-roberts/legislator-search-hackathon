//! Floor speech segment repository

use crate::DbError;
use polsearch_core::FloorSpeechSegment;
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

pub struct FloorSpeechSegmentRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> FloorSpeechSegmentRepo<'a> {
    #[must_use]
    pub const fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new floor speech segment
    ///
    /// # Errors
    /// Returns `DbError` if the insert fails
    pub async fn create(&self, segment: &FloorSpeechSegment) -> Result<(), DbError> {
        sqlx::query(
            r"
            INSERT INTO floor_speech_segments (id, floor_speech_id, statement_id, segment_index,
                                                chunk_index, text_preview, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ",
        )
        .bind(segment.id)
        .bind(segment.floor_speech_id)
        .bind(segment.statement_id)
        .bind(segment.segment_index)
        .bind(segment.chunk_index)
        .bind(&segment.text_preview)
        .bind(segment.created_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Batch insert floor speech segments
    ///
    /// # Errors
    /// Returns `DbError` if the insert fails
    pub async fn create_batch(&self, segments: &[FloorSpeechSegment]) -> Result<(), DbError> {
        if segments.is_empty() {
            return Ok(());
        }

        let mut query_builder = sqlx::QueryBuilder::new(
            "INSERT INTO floor_speech_segments (id, floor_speech_id, statement_id, segment_index, chunk_index, text_preview, created_at) ",
        );

        query_builder.push_values(segments, |mut b, seg| {
            b.push_bind(seg.id)
                .push_bind(seg.floor_speech_id)
                .push_bind(seg.statement_id)
                .push_bind(seg.segment_index)
                .push_bind(seg.chunk_index)
                .push_bind(&seg.text_preview)
                .push_bind(seg.created_at);
        });

        query_builder.build().execute(self.pool).await?;
        Ok(())
    }

    /// Fetch segments by floor speech ID
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_floor_speech(
        &self,
        floor_speech_id: Uuid,
    ) -> Result<Vec<FloorSpeechSegment>, DbError> {
        let segments = sqlx::query_as::<_, FloorSpeechSegment>(
            "SELECT * FROM floor_speech_segments WHERE floor_speech_id = $1 ORDER BY segment_index",
        )
        .bind(floor_speech_id)
        .fetch_all(self.pool)
        .await?;
        Ok(segments)
    }

    /// Count segments for a floor speech
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn count_by_floor_speech(&self, floor_speech_id: Uuid) -> Result<i64, DbError> {
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM floor_speech_segments WHERE floor_speech_id = $1",
        )
        .bind(floor_speech_id)
        .fetch_one(self.pool)
        .await?;
        Ok(count.0)
    }

    /// Get speaker labels for segments (via statements)
    /// Returns a map of (`floor_speech_id`, `segment_index`) -> `speaker_label`
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_speakers_for_segments(
        &self,
        segment_keys: &[(Uuid, i32)],
    ) -> Result<HashMap<(Uuid, i32), Option<String>>, DbError> {
        if segment_keys.is_empty() {
            return Ok(HashMap::new());
        }

        let floor_speech_ids: Vec<Uuid> = segment_keys.iter().map(|(id, _)| *id).collect();
        let segment_indices: Vec<i32> = segment_keys.iter().map(|(_, idx)| *idx).collect();

        let rows: Vec<(Uuid, i32, String)> = sqlx::query_as(
            r"
            SELECT fs.floor_speech_id, fs.segment_index, fst.speaker_label
            FROM floor_speech_segments fs
            JOIN floor_speech_statements fst ON fs.statement_id = fst.id
            WHERE fs.floor_speech_id = ANY($1) AND fs.segment_index = ANY($2)
            ",
        )
        .bind(&floor_speech_ids)
        .bind(&segment_indices)
        .fetch_all(self.pool)
        .await?;

        let map = rows
            .into_iter()
            .map(|(fsid, sidx, label)| ((fsid, sidx), Some(label)))
            .collect();

        Ok(map)
    }
}
