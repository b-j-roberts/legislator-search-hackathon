//! Content repository

use chrono::{DateTime, Utc};
use std::collections::HashMap;

use crate::DbError;
use polsearch_core::Content;
use sqlx::PgPool;
use uuid::Uuid;

pub struct ContentRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> ContentRepo<'a> {
    #[must_use]
    pub const fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new content
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the insert fails
    pub async fn create(&self, content: &Content) -> Result<(), DbError> {
        sqlx::query(
            r"
            INSERT INTO content (id, source_id, guid, title, description, published_at,
                                  year_month, content_url, thumbnail_url, duration_seconds,
                                  is_processed, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ",
        )
        .bind(content.id)
        .bind(content.source_id)
        .bind(&content.guid)
        .bind(&content.title)
        .bind(&content.description)
        .bind(content.published_at)
        .bind(&content.year_month)
        .bind(&content.content_url)
        .bind(&content.thumbnail_url)
        .bind(content.duration_seconds)
        .bind(content.is_processed)
        .bind(content.created_at)
        .bind(content.updated_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Fetch content by ID
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<Content>, DbError> {
        let content = sqlx::query_as::<_, Content>("SELECT * FROM content WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool)
            .await?;
        Ok(content)
    }

    /// Fetch all content
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_all(&self) -> Result<Vec<Content>, DbError> {
        let content =
            sqlx::query_as::<_, Content>("SELECT * FROM content ORDER BY published_at DESC")
                .fetch_all(self.pool)
                .await?;
        Ok(content)
    }

    /// Fetch content for a source
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_by_source(&self, source_id: Uuid) -> Result<Vec<Content>, DbError> {
        let content = sqlx::query_as::<_, Content>(
            "SELECT * FROM content WHERE source_id = $1 ORDER BY published_at DESC",
        )
        .bind(source_id)
        .fetch_all(self.pool)
        .await?;
        Ok(content)
    }

    /// Fetch content for a year-month
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_by_year_month(&self, year_month: &str) -> Result<Vec<Content>, DbError> {
        let content = sqlx::query_as::<_, Content>(
            "SELECT * FROM content WHERE year_month = $1 ORDER BY published_at DESC",
        )
        .bind(year_month)
        .fetch_all(self.pool)
        .await?;
        Ok(content)
    }

    /// Fetch untranscribed content in a date range
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_untranscribed_in_range(
        &self,
        from_year_month: &str,
        to_year_month: &str,
        source_id: Option<Uuid>,
    ) -> Result<Vec<Content>, DbError> {
        // exclude content that already have any task (queued, processing, completed, or failed)
        let content = if let Some(pid) = source_id {
            sqlx::query_as::<_, Content>(
                r"
                SELECT e.* FROM content e
                WHERE e.year_month >= $1 AND e.year_month <= $2
                  AND e.is_processed = false
                  AND e.source_id = $3
                  AND NOT EXISTS (
                      SELECT 1 FROM transcription_tasks t WHERE t.content_id = e.id
                  )
                ORDER BY e.published_at DESC
                ",
            )
            .bind(from_year_month)
            .bind(to_year_month)
            .bind(pid)
            .fetch_all(self.pool)
            .await?
        } else {
            sqlx::query_as::<_, Content>(
                r"
                SELECT e.* FROM content e
                WHERE e.year_month >= $1 AND e.year_month <= $2
                  AND e.is_processed = false
                  AND NOT EXISTS (
                      SELECT 1 FROM transcription_tasks t WHERE t.content_id = e.id
                  )
                ORDER BY e.published_at DESC
                ",
            )
            .bind(from_year_month)
            .bind(to_year_month)
            .fetch_all(self.pool)
            .await?
        };
        Ok(content)
    }

    /// Update an content
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the update fails
    pub async fn update(&self, content: &Content) -> Result<(), DbError> {
        sqlx::query(
            r"
            UPDATE content
            SET title = $2, description = $3, content_url = $4, thumbnail_url = $5,
                duration_seconds = $6, is_processed = $7, updated_at = $8
            WHERE id = $1
            ",
        )
        .bind(content.id)
        .bind(&content.title)
        .bind(&content.description)
        .bind(&content.content_url)
        .bind(&content.thumbnail_url)
        .bind(content.duration_seconds)
        .bind(content.is_processed)
        .bind(Utc::now())
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Mark an content as transcribed
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the update fails
    pub async fn mark_transcribed(&self, id: Uuid) -> Result<(), DbError> {
        sqlx::query("UPDATE content SET is_processed = true, updated_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// Set the raw data version for an content (called after storing raw archive data)
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the update fails
    pub async fn set_raw_data_version(&self, id: Uuid, version: i32) -> Result<(), DbError> {
        sqlx::query("UPDATE content SET raw_data_version = $2, updated_at = NOW() WHERE id = $1")
            .bind(id)
            .bind(version)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// Delete an content
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the delete fails
    pub async fn delete(&self, id: Uuid) -> Result<(), DbError> {
        sqlx::query("DELETE FROM content WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// Count all content
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn count(&self) -> Result<i32, DbError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM content")
            .fetch_one(self.pool)
            .await?;
        Ok(i32::try_from(count.0).unwrap_or(i32::MAX))
    }

    /// Count transcribed content
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn count_transcribed(&self) -> Result<i32, DbError> {
        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM content WHERE is_processed = true")
                .fetch_one(self.pool)
                .await?;
        Ok(i32::try_from(count.0).unwrap_or(i32::MAX))
    }

    /// Count content for a specific source
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn count_by_source(&self, source_id: Uuid) -> Result<i32, DbError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM content WHERE source_id = $1")
            .bind(source_id)
            .fetch_one(self.pool)
            .await?;
        Ok(i32::try_from(count.0).unwrap_or(i32::MAX))
    }

    /// Count transcribed content for a specific source
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn count_transcribed_by_source(&self, source_id: Uuid) -> Result<i32, DbError> {
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM content WHERE source_id = $1 AND is_processed = true",
        )
        .bind(source_id)
        .fetch_one(self.pool)
        .await?;
        Ok(i32::try_from(count.0).unwrap_or(i32::MAX))
    }

    /// Get the most recent `published_at` for a source (for incremental fetching)
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_latest_published_at(
        &self,
        source_id: Uuid,
    ) -> Result<Option<DateTime<Utc>>, DbError> {
        let result: Option<(DateTime<Utc>,)> = sqlx::query_as(
            "SELECT published_at FROM content WHERE source_id = $1 ORDER BY published_at DESC LIMIT 1",
        )
        .bind(source_id)
        .fetch_optional(self.pool)
        .await?;
        Ok(result.map(|(dt,)| dt))
    }

    /// Count content in a date range with optional source filter
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn count_in_range(
        &self,
        from_year_month: &str,
        to_year_month: &str,
        source_id: Option<Uuid>,
    ) -> Result<i32, DbError> {
        let count: (i64,) = if let Some(pid) = source_id {
            sqlx::query_as(
                r"
                SELECT COUNT(*) FROM content
                WHERE year_month >= $1 AND year_month <= $2 AND source_id = $3
                ",
            )
            .bind(from_year_month)
            .bind(to_year_month)
            .bind(pid)
            .fetch_one(self.pool)
            .await?
        } else {
            sqlx::query_as(
                r"
                SELECT COUNT(*) FROM content
                WHERE year_month >= $1 AND year_month <= $2
                ",
            )
            .bind(from_year_month)
            .bind(to_year_month)
            .fetch_one(self.pool)
            .await?
        };
        Ok(i32::try_from(count.0).unwrap_or(i32::MAX))
    }

    /// Count transcribed content in a date range with optional source filter
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn count_transcribed_in_range(
        &self,
        from_year_month: &str,
        to_year_month: &str,
        source_id: Option<Uuid>,
    ) -> Result<i32, DbError> {
        let count: (i64,) = if let Some(pid) = source_id {
            sqlx::query_as(
                r"
                SELECT COUNT(*) FROM content
                WHERE year_month >= $1 AND year_month <= $2
                  AND source_id = $3 AND is_processed = true
                ",
            )
            .bind(from_year_month)
            .bind(to_year_month)
            .bind(pid)
            .fetch_one(self.pool)
            .await?
        } else {
            sqlx::query_as(
                r"
                SELECT COUNT(*) FROM content
                WHERE year_month >= $1 AND year_month <= $2 AND is_processed = true
                ",
            )
            .bind(from_year_month)
            .bind(to_year_month)
            .fetch_one(self.pool)
            .await?
        };
        Ok(i32::try_from(count.0).unwrap_or(i32::MAX))
    }

    /// Get transcription stats grouped by source
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_stats_by_source(&self) -> Result<Vec<(String, String, i64, i64)>, DbError> {
        let rows: Vec<(String, String, i64, i64)> = sqlx::query_as(
            r"
            SELECT p.name, p.slug,
                   COUNT(e.id) as total,
                   COUNT(CASE WHEN e.is_processed THEN 1 END) as transcribed
            FROM sources p
            LEFT JOIN content e ON e.source_id = p.id
            GROUP BY p.id, p.name, p.slug
            ORDER BY p.tier, p.name
            ",
        )
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Get transcription stats grouped by source for a date range
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_stats_by_source_in_range(
        &self,
        from_year_month: &str,
        to_year_month: &str,
    ) -> Result<Vec<(String, String, i64, i64)>, DbError> {
        let rows: Vec<(String, String, i64, i64)> = sqlx::query_as(
            r"
            SELECT p.name, p.slug,
                   COUNT(e.id) as total,
                   COUNT(CASE WHEN e.is_processed THEN 1 END) as transcribed
            FROM sources p
            LEFT JOIN content e ON e.source_id = p.id
                AND e.year_month >= $1 AND e.year_month <= $2
            GROUP BY p.id, p.name, p.slug
            HAVING COUNT(e.id) > 0
            ORDER BY p.tier, p.name
            ",
        )
        .bind(from_year_month)
        .bind(to_year_month)
        .fetch_all(self.pool)
        .await?;
        Ok(rows)
    }

    /// Fetch transcribed content with optional filters
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_transcribed_filtered(
        &self,
        source_id: Option<Uuid>,
        year_month: Option<&str>,
        limit: Option<usize>,
    ) -> Result<Vec<Content>, DbError> {
        let limit_clause = limit.map(|l| format!("LIMIT {l}")).unwrap_or_default();

        let content = match (source_id, year_month) {
            (Some(pid), Some(ym)) => {
                let query = format!(
                    r"
                    SELECT * FROM content
                    WHERE is_processed = true
                      AND source_id = $1
                      AND year_month = $2
                    ORDER BY published_at DESC
                    {limit_clause}
                    "
                );
                sqlx::query_as::<_, Content>(&query)
                    .bind(pid)
                    .bind(ym)
                    .fetch_all(self.pool)
                    .await?
            }
            (Some(pid), None) => {
                let query = format!(
                    r"
                    SELECT * FROM content
                    WHERE is_processed = true
                      AND source_id = $1
                    ORDER BY published_at DESC
                    {limit_clause}
                    "
                );
                sqlx::query_as::<_, Content>(&query)
                    .bind(pid)
                    .fetch_all(self.pool)
                    .await?
            }
            (None, Some(ym)) => {
                let query = format!(
                    r"
                    SELECT * FROM content
                    WHERE is_processed = true
                      AND year_month = $1
                    ORDER BY published_at DESC
                    {limit_clause}
                    "
                );
                sqlx::query_as::<_, Content>(&query)
                    .bind(ym)
                    .fetch_all(self.pool)
                    .await?
            }
            (None, None) => {
                let query = format!(
                    r"
                    SELECT * FROM content
                    WHERE is_processed = true
                    ORDER BY published_at DESC
                    {limit_clause}
                    "
                );
                sqlx::query_as::<_, Content>(&query)
                    .fetch_all(self.pool)
                    .await?
            }
        };
        Ok(content)
    }

    /// Fetch content by IDs with their source info for search enrichment
    ///
    /// Returns a map of `content_id` to `(source_name, content_title, published_at, content_url)`
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_by_ids_with_sources(
        &self,
        content_ids: &[Uuid],
    ) -> Result<HashMap<Uuid, (String, String, DateTime<Utc>, String)>, DbError> {
        if content_ids.is_empty() {
            return Ok(HashMap::new());
        }

        let rows: Vec<(Uuid, String, String, DateTime<Utc>, String)> = sqlx::query_as(
            r"
            SELECT e.id, p.name, e.title, e.published_at, e.content_url
            FROM content e
            JOIN sources p ON e.source_id = p.id
            WHERE e.id = ANY($1)
            ",
        )
        .bind(content_ids)
        .fetch_all(self.pool)
        .await?;

        let map = rows
            .into_iter()
            .map(|(id, source_name, title, published_at, content_url)| {
                (id, (source_name, title, published_at, content_url))
            })
            .collect();

        Ok(map)
    }
}
