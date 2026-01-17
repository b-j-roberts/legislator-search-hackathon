//! Transcription task repository

use crate::DbError;
use chrono::Utc;
use polsearch_core::{TaskStatus, TranscriptionTask};
use sqlx::PgPool;
use uuid::Uuid;

pub struct TranscriptionTaskRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> TranscriptionTaskRepo<'a> {
    #[must_use]
    pub const fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new task
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the insert fails
    pub async fn create(&self, task: &TranscriptionTask) -> Result<(), DbError> {
        sqlx::query(
            r"
            INSERT INTO transcription_tasks (id, batch_id, content_id, status,
                                             error_message, started_at, completed_at, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ",
        )
        .bind(task.id)
        .bind(task.batch_id)
        .bind(task.content_id)
        .bind(&task.status)
        .bind(&task.error_message)
        .bind(task.started_at)
        .bind(task.completed_at)
        .bind(task.created_at)
        .bind(task.updated_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Insert multiple tasks
    ///
    /// # Errors
    ///
    /// Returns `DbError` if any insert fails
    pub async fn create_many(&self, tasks: &[TranscriptionTask]) -> Result<(), DbError> {
        for task in tasks {
            self.create(task).await?;
        }
        Ok(())
    }

    /// Fetch task by ID
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<TranscriptionTask>, DbError> {
        let task = sqlx::query_as::<_, TranscriptionTask>(
            "SELECT * FROM transcription_tasks WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(self.pool)
        .await?;
        Ok(task)
    }

    /// Fetch all tasks
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_all(&self) -> Result<Vec<TranscriptionTask>, DbError> {
        let tasks =
            sqlx::query_as::<_, TranscriptionTask>("SELECT * FROM transcription_tasks ORDER BY id")
                .fetch_all(self.pool)
                .await?;
        Ok(tasks)
    }

    /// Fetch tasks for a batch
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_by_batch(&self, batch_id: Uuid) -> Result<Vec<TranscriptionTask>, DbError> {
        let tasks = sqlx::query_as::<_, TranscriptionTask>(
            "SELECT * FROM transcription_tasks WHERE batch_id = $1 ORDER BY id",
        )
        .bind(batch_id)
        .fetch_all(self.pool)
        .await?;
        Ok(tasks)
    }

    /// Fetch tasks by status
    ///
    /// Orders by batch priority (highest first), then batch creation date (oldest first),
    /// then by `started_at` (retried tasks first)
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_by_status(
        &self,
        status: TaskStatus,
    ) -> Result<Vec<TranscriptionTask>, DbError> {
        let tasks = sqlx::query_as::<_, TranscriptionTask>(
            r"
            SELECT t.* FROM transcription_tasks t
            JOIN transcription_batches b ON t.batch_id = b.id
            WHERE t.status = $1
            ORDER BY b.priority DESC, b.created_at ASC, t.started_at ASC NULLS LAST, t.id
            ",
        )
        .bind(status.to_string())
        .fetch_all(self.pool)
        .await?;
        Ok(tasks)
    }

    /// Fetch queued tasks for a batch
    ///
    /// Tasks with a `started_at` timestamp are prioritized (retried tasks first)
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_queued_for_batch(
        &self,
        batch_id: Uuid,
    ) -> Result<Vec<TranscriptionTask>, DbError> {
        let tasks = sqlx::query_as::<_, TranscriptionTask>(
            "SELECT * FROM transcription_tasks WHERE batch_id = $1 AND status = 'queued' ORDER BY started_at ASC NULLS LAST, id",
        )
        .bind(batch_id)
        .fetch_all(self.pool)
        .await?;
        Ok(tasks)
    }

    /// Fetch failed tasks for a batch
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_failed_for_batch(
        &self,
        batch_id: Uuid,
    ) -> Result<Vec<TranscriptionTask>, DbError> {
        let tasks = sqlx::query_as::<_, TranscriptionTask>(
            "SELECT * FROM transcription_tasks WHERE batch_id = $1 AND status = 'failed' ORDER BY id",
        )
        .bind(batch_id)
        .fetch_all(self.pool)
        .await?;
        Ok(tasks)
    }

    /// Update a task
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the update fails
    pub async fn update(&self, task: &TranscriptionTask) -> Result<(), DbError> {
        sqlx::query(
            r"
            UPDATE transcription_tasks
            SET status = $2, error_message = $3, started_at = $4, completed_at = $5, updated_at = $6
            WHERE id = $1
            ",
        )
        .bind(task.id)
        .bind(&task.status)
        .bind(&task.error_message)
        .bind(task.started_at)
        .bind(task.completed_at)
        .bind(Utc::now())
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Mark task as started
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the update fails
    pub async fn start(&self, id: Uuid) -> Result<(), DbError> {
        sqlx::query(
            "UPDATE transcription_tasks SET status = 'processing', started_at = $2, updated_at = $2 WHERE id = $1",
        )
        .bind(id)
        .bind(Utc::now())
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Mark task as completed and update batch `completed_content` count
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the update fails
    pub async fn complete(&self, id: Uuid) -> Result<(), DbError> {
        let now = Utc::now();

        // update task status
        sqlx::query(
            "UPDATE transcription_tasks SET status = 'completed', completed_at = $2, updated_at = $2 WHERE id = $1",
        )
        .bind(id)
        .bind(now)
        .execute(self.pool)
        .await?;

        // update batch completed_content by counting actual completed tasks
        sqlx::query(
            r"
            UPDATE transcription_batches
            SET completed_content = (
                SELECT COUNT(*) FROM transcription_tasks
                WHERE batch_id = transcription_batches.id AND status = 'completed'
            ),
            updated_at = $2
            WHERE id = (SELECT batch_id FROM transcription_tasks WHERE id = $1)
            ",
        )
        .bind(id)
        .bind(now)
        .execute(self.pool)
        .await?;

        Ok(())
    }

    /// Mark task as failed with error message and update batch `failed_content` count
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the update fails
    pub async fn fail(&self, id: Uuid, error: &str) -> Result<(), DbError> {
        let now = Utc::now();

        // update task status
        sqlx::query(
            r"
            UPDATE transcription_tasks
            SET status = 'failed', error_message = $2, completed_at = $3, updated_at = $3
            WHERE id = $1
            ",
        )
        .bind(id)
        .bind(error)
        .bind(now)
        .execute(self.pool)
        .await?;

        // update batch failed_content by counting actual failed tasks
        sqlx::query(
            r"
            UPDATE transcription_batches
            SET failed_content = (
                SELECT COUNT(*) FROM transcription_tasks
                WHERE batch_id = transcription_batches.id AND status = 'failed'
            ),
            updated_at = $2
            WHERE id = (SELECT batch_id FROM transcription_tasks WHERE id = $1)
            ",
        )
        .bind(id)
        .bind(now)
        .execute(self.pool)
        .await?;

        Ok(())
    }

    /// Delete a task
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the delete fails
    pub async fn delete(&self, id: Uuid) -> Result<(), DbError> {
        sqlx::query("DELETE FROM transcription_tasks WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// Count all tasks
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn count(&self) -> Result<i32, DbError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM transcription_tasks")
            .fetch_one(self.pool)
            .await?;
        Ok(i32::try_from(count.0).unwrap_or(i32::MAX))
    }

    /// Count tasks by status
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn count_by_status(&self, status: TaskStatus) -> Result<i32, DbError> {
        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM transcription_tasks WHERE status = $1")
                .bind(status.to_string())
                .fetch_one(self.pool)
                .await?;
        Ok(i32::try_from(count.0).unwrap_or(i32::MAX))
    }

    /// Check if there's a completed task for an content
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn has_completed_for_content(&self, content_id: Uuid) -> Result<bool, DbError> {
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM transcription_tasks WHERE content_id = $1 AND status = 'completed'",
        )
        .bind(content_id)
        .fetch_one(self.pool)
        .await?;
        Ok(count.0 > 0)
    }

    /// Requeue tasks stuck in processing for longer than the specified minutes
    ///
    /// Returns the requeued tasks
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the update fails
    pub async fn requeue_stale_processing(
        &self,
        stale_minutes: i64,
    ) -> Result<Vec<TranscriptionTask>, DbError> {
        let tasks = sqlx::query_as::<_, TranscriptionTask>(
            r"
            UPDATE transcription_tasks
            SET status = 'queued', updated_at = NOW()
            WHERE status = 'processing'
              AND started_at < NOW() - make_interval(mins => $1::int)
            RETURNING *
            ",
        )
        .bind(stale_minutes)
        .fetch_all(self.pool)
        .await?;
        Ok(tasks)
    }

    /// Check if a batch has any pending tasks (queued or processing)
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn has_pending_for_batch(&self, batch_id: Uuid) -> Result<bool, DbError> {
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM transcription_tasks WHERE batch_id = $1 AND status IN ('queued', 'processing')",
        )
        .bind(batch_id)
        .fetch_one(self.pool)
        .await?;
        Ok(count.0 > 0)
    }

    /// Count completed and failed tasks for a batch
    ///
    /// Returns (`completed_count`, `failed_count`)
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn count_final_for_batch(&self, batch_id: Uuid) -> Result<(i32, i32), DbError> {
        let row: (i64, i64) = sqlx::query_as(
            r"
            SELECT
                COUNT(*) FILTER (WHERE status = 'completed'),
                COUNT(*) FILTER (WHERE status = 'failed')
            FROM transcription_tasks
            WHERE batch_id = $1
            ",
        )
        .bind(batch_id)
        .fetch_one(self.pool)
        .await?;
        Ok((
            i32::try_from(row.0).unwrap_or(i32::MAX),
            i32::try_from(row.1).unwrap_or(i32::MAX),
        ))
    }
}
