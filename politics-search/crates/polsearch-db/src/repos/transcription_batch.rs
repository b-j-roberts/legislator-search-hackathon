//! Transcription batch repository

use crate::DbError;
use chrono::Utc;
use polsearch_core::{BatchStatus, TranscriptionBatch};
use sqlx::PgPool;
use uuid::Uuid;

pub struct TranscriptionBatchRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> TranscriptionBatchRepo<'a> {
    #[must_use]
    pub const fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new batch
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the insert fails
    pub async fn create(&self, batch: &TranscriptionBatch) -> Result<(), DbError> {
        sqlx::query(
            r"
            INSERT INTO transcription_batches (id, name, status, priority, total_episodes,
                                               completed_episodes, failed_episodes,
                                               created_at, started_at, completed_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ",
        )
        .bind(batch.id)
        .bind(&batch.name)
        .bind(&batch.status)
        .bind(batch.priority)
        .bind(batch.total_episodes)
        .bind(batch.completed_episodes)
        .bind(batch.failed_episodes)
        .bind(batch.created_at)
        .bind(batch.started_at)
        .bind(batch.completed_at)
        .bind(batch.updated_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Fetch batch by ID
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<TranscriptionBatch>, DbError> {
        let batch = sqlx::query_as::<_, TranscriptionBatch>(
            "SELECT * FROM transcription_batches WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(self.pool)
        .await?;
        Ok(batch)
    }

    /// Fetch all batches
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_all(&self) -> Result<Vec<TranscriptionBatch>, DbError> {
        let batches = sqlx::query_as::<_, TranscriptionBatch>(
            "SELECT * FROM transcription_batches ORDER BY created_at DESC",
        )
        .fetch_all(self.pool)
        .await?;
        Ok(batches)
    }

    /// Fetch batches by status
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_by_status(
        &self,
        status: BatchStatus,
    ) -> Result<Vec<TranscriptionBatch>, DbError> {
        let batches = sqlx::query_as::<_, TranscriptionBatch>(
            "SELECT * FROM transcription_batches WHERE status = $1 ORDER BY created_at DESC",
        )
        .bind(status.to_string())
        .fetch_all(self.pool)
        .await?;
        Ok(batches)
    }

    /// Fetch pending batches
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_pending(&self) -> Result<Vec<TranscriptionBatch>, DbError> {
        self.get_by_status(BatchStatus::Pending).await
    }

    /// Fetch running batches
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_running(&self) -> Result<Vec<TranscriptionBatch>, DbError> {
        self.get_by_status(BatchStatus::Running).await
    }

    /// Update a batch
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the update fails
    pub async fn update(&self, batch: &TranscriptionBatch) -> Result<(), DbError> {
        sqlx::query(
            r"
            UPDATE transcription_batches
            SET status = $2, priority = $3, total_episodes = $4, completed_episodes = $5,
                failed_episodes = $6, started_at = $7, completed_at = $8, updated_at = $9
            WHERE id = $1
            ",
        )
        .bind(batch.id)
        .bind(&batch.status)
        .bind(batch.priority)
        .bind(batch.total_episodes)
        .bind(batch.completed_episodes)
        .bind(batch.failed_episodes)
        .bind(batch.started_at)
        .bind(batch.completed_at)
        .bind(Utc::now())
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Mark batch as started
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the update fails
    pub async fn start(&self, id: Uuid) -> Result<(), DbError> {
        sqlx::query(
            "UPDATE transcription_batches SET status = 'running', started_at = $2, updated_at = $2 WHERE id = $1",
        )
        .bind(id)
        .bind(Utc::now())
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Mark batch as completed
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the update fails
    pub async fn complete(&self, id: Uuid) -> Result<(), DbError> {
        sqlx::query(
            "UPDATE transcription_batches SET status = 'completed', completed_at = $2, updated_at = $2 WHERE id = $1",
        )
        .bind(id)
        .bind(Utc::now())
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Mark batch as completed with final content counts
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the update fails
    pub async fn complete_with_counts(
        &self,
        id: Uuid,
        completed_episodes: i32,
        failed_episodes: i32,
    ) -> Result<(), DbError> {
        let now = Utc::now();
        sqlx::query(
            r"
            UPDATE transcription_batches
            SET status = 'completed', completed_at = $2, updated_at = $2,
                completed_episodes = $3, failed_episodes = $4
            WHERE id = $1
            ",
        )
        .bind(id)
        .bind(now)
        .bind(completed_episodes)
        .bind(failed_episodes)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Mark batch as failed
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the update fails
    pub async fn fail(&self, id: Uuid) -> Result<(), DbError> {
        sqlx::query(
            "UPDATE transcription_batches SET status = 'failed', completed_at = $2, updated_at = $2 WHERE id = $1",
        )
        .bind(id)
        .bind(Utc::now())
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Update content counts without changing status
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the update fails
    pub async fn update_counts(
        &self,
        id: Uuid,
        completed_episodes: i32,
        failed_episodes: i32,
    ) -> Result<(), DbError> {
        sqlx::query(
            "UPDATE transcription_batches SET completed_episodes = $2, failed_episodes = $3, updated_at = NOW() WHERE id = $1",
        )
        .bind(id)
        .bind(completed_episodes)
        .bind(failed_episodes)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Increment completed content count
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the update fails
    pub async fn increment_completed(&self, id: Uuid) -> Result<(), DbError> {
        sqlx::query(
            "UPDATE transcription_batches SET completed_episodes = completed_episodes + 1, updated_at = NOW() WHERE id = $1",
        )
        .bind(id)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Increment failed content count
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the update fails
    pub async fn increment_failed(&self, id: Uuid) -> Result<(), DbError> {
        sqlx::query(
            "UPDATE transcription_batches SET failed_episodes = failed_episodes + 1, updated_at = NOW() WHERE id = $1",
        )
        .bind(id)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Delete a batch
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the delete fails
    pub async fn delete(&self, id: Uuid) -> Result<(), DbError> {
        sqlx::query("DELETE FROM transcription_batches WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// Count all batches
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn count(&self) -> Result<i32, DbError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM transcription_batches")
            .fetch_one(self.pool)
            .await?;
        Ok(i32::try_from(count.0).unwrap_or(i32::MAX))
    }
}
