//! Segment repository

use chrono::Utc;
use std::collections::HashMap;

use crate::DbError;
use polsearch_core::Segment;
use sqlx::PgPool;
use uuid::Uuid;

pub struct SegmentRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> SegmentRepo<'a> {
    #[must_use]
    pub const fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new segment
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the insert fails
    pub async fn create(&self, segment: &Segment) -> Result<(), DbError> {
        sqlx::query(
            r"
            INSERT INTO segments (id, content_id, content_speaker_id, start_time_ms,
                                  end_time_ms, segment_index, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ",
        )
        .bind(segment.id)
        .bind(segment.content_id)
        .bind(segment.content_speaker_id)
        .bind(segment.start_time_ms)
        .bind(segment.end_time_ms)
        .bind(segment.segment_index)
        .bind(segment.created_at)
        .bind(segment.updated_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Insert multiple segments
    ///
    /// # Errors
    ///
    /// Returns `DbError` if any insert fails
    pub async fn create_many(&self, segments: &[Segment]) -> Result<(), DbError> {
        for segment in segments {
            self.create(segment).await?;
        }
        Ok(())
    }

    /// Fetch segment by ID
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<Segment>, DbError> {
        let segment = sqlx::query_as::<_, Segment>("SELECT * FROM segments WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool)
            .await?;
        Ok(segment)
    }

    /// Fetch all segments
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_all(&self) -> Result<Vec<Segment>, DbError> {
        let segments = sqlx::query_as::<_, Segment>(
            "SELECT * FROM segments ORDER BY content_id, segment_index",
        )
        .fetch_all(self.pool)
        .await?;
        Ok(segments)
    }

    /// Fetch segments for an content
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_by_content(&self, content_id: Uuid) -> Result<Vec<Segment>, DbError> {
        let segments = sqlx::query_as::<_, Segment>(
            "SELECT * FROM segments WHERE content_id = $1 ORDER BY segment_index",
        )
        .bind(content_id)
        .fetch_all(self.pool)
        .await?;
        Ok(segments)
    }

    /// Fetch segments for an content speaker
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_by_content_speaker(
        &self,
        content_speaker_id: Uuid,
    ) -> Result<Vec<Segment>, DbError> {
        let segments = sqlx::query_as::<_, Segment>(
            "SELECT * FROM segments WHERE content_speaker_id = $1 ORDER BY segment_index",
        )
        .bind(content_speaker_id)
        .fetch_all(self.pool)
        .await?;
        Ok(segments)
    }

    /// Update a segment
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the update fails
    pub async fn update(&self, segment: &Segment) -> Result<(), DbError> {
        sqlx::query(
            r"
            UPDATE segments
            SET content_speaker_id = $2, start_time_ms = $3, end_time_ms = $4, segment_index = $5, updated_at = $6
            WHERE id = $1
            ",
        )
        .bind(segment.id)
        .bind(segment.content_speaker_id)
        .bind(segment.start_time_ms)
        .bind(segment.end_time_ms)
        .bind(segment.segment_index)
        .bind(Utc::now())
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Delete a segment
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the delete fails
    pub async fn delete(&self, id: Uuid) -> Result<(), DbError> {
        sqlx::query("DELETE FROM segments WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// Delete all segments for an content
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the delete fails
    pub async fn delete_by_content(&self, content_id: Uuid) -> Result<(), DbError> {
        sqlx::query("DELETE FROM segments WHERE content_id = $1")
            .bind(content_id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// Count all segments
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn count(&self) -> Result<i32, DbError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM segments")
            .fetch_one(self.pool)
            .await?;
        Ok(i32::try_from(count.0).unwrap_or(i32::MAX))
    }

    /// Count segments for an content
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn count_by_content(&self, content_id: Uuid) -> Result<i32, DbError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM segments WHERE content_id = $1")
            .bind(content_id)
            .fetch_one(self.pool)
            .await?;
        Ok(i32::try_from(count.0).unwrap_or(i32::MAX))
    }

    /// Get speaker names for segments by `(content_id, segment_index)` pairs
    ///
    /// Returns a map of `(content_id, segment_index)` to `speaker_name` (if available)
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_speakers_for_segments(
        &self,
        pairs: &[(Uuid, i32)],
    ) -> Result<HashMap<(Uuid, i32), Option<String>>, DbError> {
        if pairs.is_empty() {
            return Ok(HashMap::new());
        }

        // build a query that fetches all relevant segments with their speaker info
        let content_ids: Vec<Uuid> = pairs.iter().map(|(id, _)| *id).collect();

        let rows: Vec<(Uuid, i32, Option<String>)> = sqlx::query_as(
            r"
            SELECT s.content_id, s.segment_index, sp.name
            FROM segments s
            LEFT JOIN content_speakers es ON s.content_speaker_id = es.id
            LEFT JOIN speakers sp ON es.speaker_id = sp.id
            WHERE s.content_id = ANY($1)
            ",
        )
        .bind(&content_ids)
        .fetch_all(self.pool)
        .await?;

        let map: HashMap<(Uuid, i32), Option<String>> = rows
            .into_iter()
            .map(|(ep_id, seg_idx, name)| ((ep_id, seg_idx), name))
            .collect();

        Ok(map)
    }
}
