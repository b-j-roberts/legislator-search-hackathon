//! Content speaker repository

use chrono::Utc;

use crate::DbError;
use polsearch_core::ContentSpeaker;
use sqlx::PgPool;
use uuid::Uuid;

pub struct ContentSpeakerRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> ContentSpeakerRepo<'a> {
    #[must_use]
    pub const fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new content speaker
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the insert fails
    pub async fn create(&self, es: &ContentSpeaker) -> Result<(), DbError> {
        sqlx::query(
            r"
            INSERT INTO content_speakers (id, content_id, local_speaker_label, speaker_id,
                                          match_confidence, speaking_time_seconds, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ",
        )
        .bind(es.id)
        .bind(es.content_id)
        .bind(&es.local_speaker_label)
        .bind(es.speaker_id)
        .bind(es.match_confidence)
        .bind(es.speaking_time_seconds)
        .bind(es.created_at)
        .bind(es.updated_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Fetch content speaker by ID
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<ContentSpeaker>, DbError> {
        let es =
            sqlx::query_as::<_, ContentSpeaker>("SELECT * FROM content_speakers WHERE id = $1")
                .bind(id)
                .fetch_optional(self.pool)
                .await?;
        Ok(es)
    }

    /// Fetch all content speakers
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_all(&self) -> Result<Vec<ContentSpeaker>, DbError> {
        let speakers = sqlx::query_as::<_, ContentSpeaker>(
            "SELECT * FROM content_speakers ORDER BY content_id, local_speaker_label",
        )
        .fetch_all(self.pool)
        .await?;
        Ok(speakers)
    }

    /// Fetch content speakers for an content
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_by_content(&self, content_id: Uuid) -> Result<Vec<ContentSpeaker>, DbError> {
        let speakers = sqlx::query_as::<_, ContentSpeaker>(
            "SELECT * FROM content_speakers WHERE content_id = $1 ORDER BY local_speaker_label",
        )
        .bind(content_id)
        .fetch_all(self.pool)
        .await?;
        Ok(speakers)
    }

    /// Fetch content speakers linked to a global speaker
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_by_speaker(&self, speaker_id: Uuid) -> Result<Vec<ContentSpeaker>, DbError> {
        let speakers = sqlx::query_as::<_, ContentSpeaker>(
            "SELECT * FROM content_speakers WHERE speaker_id = $1",
        )
        .bind(speaker_id)
        .fetch_all(self.pool)
        .await?;
        Ok(speakers)
    }

    /// Update an content speaker
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the update fails
    pub async fn update(&self, es: &ContentSpeaker) -> Result<(), DbError> {
        sqlx::query(
            r"
            UPDATE content_speakers
            SET speaker_id = $2, match_confidence = $3, speaking_time_seconds = $4, updated_at = $5
            WHERE id = $1
            ",
        )
        .bind(es.id)
        .bind(es.speaker_id)
        .bind(es.match_confidence)
        .bind(es.speaking_time_seconds)
        .bind(Utc::now())
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Link content speaker to a global speaker
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the update fails
    pub async fn link_to_speaker(
        &self,
        id: Uuid,
        speaker_id: Uuid,
        confidence: f32,
    ) -> Result<(), DbError> {
        sqlx::query(
            "UPDATE content_speakers SET speaker_id = $2, match_confidence = $3, updated_at = NOW() WHERE id = $1",
        )
        .bind(id)
        .bind(speaker_id)
        .bind(confidence)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Delete an content speaker
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the delete fails
    pub async fn delete(&self, id: Uuid) -> Result<(), DbError> {
        sqlx::query("DELETE FROM content_speakers WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// Count all content speakers
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn count(&self) -> Result<i32, DbError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM content_speakers")
            .fetch_one(self.pool)
            .await?;
        Ok(i32::try_from(count.0).unwrap_or(i32::MAX))
    }

    /// Get content IDs where a specific speaker appears
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_content_ids_by_speaker(&self, speaker_id: Uuid) -> Result<Vec<Uuid>, DbError> {
        let ids: Vec<(Uuid,)> = sqlx::query_as(
            "SELECT DISTINCT content_id FROM content_speakers WHERE speaker_id = $1",
        )
        .bind(speaker_id)
        .fetch_all(self.pool)
        .await?;
        Ok(ids.into_iter().map(|(id,)| id).collect())
    }
}
