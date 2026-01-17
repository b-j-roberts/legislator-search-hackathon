//! Hearing segment repository

use crate::DbError;
use polsearch_core::HearingSegment;
use sqlx::PgPool;
use std::collections::HashMap;
use uuid::Uuid;

pub struct HearingSegmentRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> HearingSegmentRepo<'a> {
    #[must_use]
    pub const fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new hearing segment
    ///
    /// # Errors
    /// Returns `DbError` if the insert fails
    pub async fn create(&self, segment: &HearingSegment) -> Result<(), DbError> {
        sqlx::query(
            r"
            INSERT INTO hearing_segments (id, hearing_id, statement_id, segment_index,
                                           chunk_index, created_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ",
        )
        .bind(segment.id)
        .bind(segment.hearing_id)
        .bind(segment.statement_id)
        .bind(segment.segment_index)
        .bind(segment.chunk_index)
        .bind(segment.created_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Batch insert hearing segments
    ///
    /// # Errors
    /// Returns `DbError` if the insert fails
    pub async fn create_batch(&self, segments: &[HearingSegment]) -> Result<(), DbError> {
        if segments.is_empty() {
            return Ok(());
        }

        let mut query_builder = sqlx::QueryBuilder::new(
            "INSERT INTO hearing_segments (id, hearing_id, statement_id, segment_index, chunk_index, created_at) ",
        );

        query_builder.push_values(segments, |mut b, seg| {
            b.push_bind(seg.id)
                .push_bind(seg.hearing_id)
                .push_bind(seg.statement_id)
                .push_bind(seg.segment_index)
                .push_bind(seg.chunk_index)
                .push_bind(seg.created_at);
        });

        query_builder.build().execute(self.pool).await?;
        Ok(())
    }

    /// Fetch segments by hearing ID
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_hearing(&self, hearing_id: Uuid) -> Result<Vec<HearingSegment>, DbError> {
        let segments = sqlx::query_as::<_, HearingSegment>(
            r"SELECT id, hearing_id, statement_id, segment_index, chunk_index, created_at
              FROM hearing_segments WHERE hearing_id = $1 ORDER BY segment_index",
        )
        .bind(hearing_id)
        .fetch_all(self.pool)
        .await?;
        Ok(segments)
    }

    /// Count segments for a hearing
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn count_by_hearing(&self, hearing_id: Uuid) -> Result<i64, DbError> {
        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM hearing_segments WHERE hearing_id = $1")
                .bind(hearing_id)
                .fetch_one(self.pool)
                .await?;
        Ok(count.0)
    }

    /// Get speaker labels for segments (via statements)
    /// Returns a map of (`hearing_id`, `segment_index`) -> `speaker_label`
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

        let hearing_ids: Vec<Uuid> = segment_keys.iter().map(|(id, _)| *id).collect();
        let segment_indices: Vec<i32> = segment_keys.iter().map(|(_, idx)| *idx).collect();

        let rows: Vec<(Uuid, i32, String)> = sqlx::query_as(
            r"
            SELECT hs.hearing_id, hs.segment_index, hst.speaker_label
            FROM hearing_segments hs
            JOIN hearing_statements hst ON hs.statement_id = hst.id
            WHERE hs.hearing_id = ANY($1) AND hs.segment_index = ANY($2)
            ",
        )
        .bind(&hearing_ids)
        .bind(&segment_indices)
        .fetch_all(self.pool)
        .await?;

        let map = rows
            .into_iter()
            .map(|(hid, sidx, label)| ((hid, sidx), Some(label)))
            .collect();

        Ok(map)
    }
}
