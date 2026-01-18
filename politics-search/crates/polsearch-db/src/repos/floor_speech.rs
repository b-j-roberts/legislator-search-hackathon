//! Floor speech repository

use crate::DbError;
use polsearch_core::FloorSpeech;
use sqlx::PgPool;
use std::collections::HashSet;
use uuid::Uuid;

pub struct FloorSpeechRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> FloorSpeechRepo<'a> {
    #[must_use]
    pub const fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new floor speech
    ///
    /// # Errors
    /// Returns `DbError` if the insert fails
    pub async fn create(&self, speech: &FloorSpeech) -> Result<(), DbError> {
        sqlx::query(
            r"
            INSERT INTO floor_speeches (id, event_id, granule_id, title, chamber, page_type,
                                         speech_date, year_month, source_url,
                                         total_statements, total_segments, is_processed,
                                         created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ",
        )
        .bind(speech.id)
        .bind(&speech.event_id)
        .bind(&speech.granule_id)
        .bind(&speech.title)
        .bind(&speech.chamber)
        .bind(&speech.page_type)
        .bind(speech.speech_date)
        .bind(&speech.year_month)
        .bind(&speech.source_url)
        .bind(speech.total_statements)
        .bind(speech.total_segments)
        .bind(speech.is_processed)
        .bind(speech.created_at)
        .bind(speech.updated_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Fetch floor speech by ID
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<FloorSpeech>, DbError> {
        let speech = sqlx::query_as::<_, FloorSpeech>("SELECT * FROM floor_speeches WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool)
            .await?;
        Ok(speech)
    }

    /// Fetch floor speech by event ID
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_event_id(&self, event_id: &str) -> Result<Option<FloorSpeech>, DbError> {
        let speech =
            sqlx::query_as::<_, FloorSpeech>("SELECT * FROM floor_speeches WHERE event_id = $1")
                .bind(event_id)
                .fetch_optional(self.pool)
                .await?;
        Ok(speech)
    }

    /// Check if floor speech exists by event ID
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn exists_by_event_id(&self, event_id: &str) -> Result<bool, DbError> {
        let exists: (bool,) = sqlx::query_as(
            "SELECT EXISTS(SELECT 1 FROM floor_speeches WHERE event_id = $1)",
        )
        .bind(event_id)
        .fetch_one(self.pool)
        .await?;
        Ok(exists.0)
    }

    /// Update counts and mark as processed
    ///
    /// # Errors
    /// Returns `DbError` if the update fails
    pub async fn mark_processed(
        &self,
        id: Uuid,
        total_statements: i32,
        total_segments: i32,
    ) -> Result<(), DbError> {
        sqlx::query(
            r"
            UPDATE floor_speeches
            SET is_processed = true, total_statements = $2, total_segments = $3, updated_at = NOW()
            WHERE id = $1
            ",
        )
        .bind(id)
        .bind(total_statements)
        .bind(total_segments)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Fetch floor speeches by chamber
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_chamber(&self, chamber: &str) -> Result<Vec<FloorSpeech>, DbError> {
        let speeches = sqlx::query_as::<_, FloorSpeech>(
            "SELECT * FROM floor_speeches WHERE chamber = $1 ORDER BY speech_date DESC",
        )
        .bind(chamber)
        .fetch_all(self.pool)
        .await?;
        Ok(speeches)
    }

    /// Fetch floor speeches by year-month
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_year_month(&self, year_month: &str) -> Result<Vec<FloorSpeech>, DbError> {
        let speeches = sqlx::query_as::<_, FloorSpeech>(
            "SELECT * FROM floor_speeches WHERE year_month = $1 ORDER BY speech_date DESC",
        )
        .bind(year_month)
        .fetch_all(self.pool)
        .await?;
        Ok(speeches)
    }

    /// Count all floor speeches
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn count(&self) -> Result<i64, DbError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM floor_speeches")
            .fetch_one(self.pool)
            .await?;
        Ok(count.0)
    }

    /// Count processed floor speeches
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn count_processed(&self) -> Result<i64, DbError> {
        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM floor_speeches WHERE is_processed = true")
                .fetch_one(self.pool)
                .await?;
        Ok(count.0)
    }

    /// Get IDs of floor speeches matching filters for search
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_filtered_ids(
        &self,
        chamber: Option<&str>,
        from_date: Option<&str>,
        to_date: Option<&str>,
    ) -> Result<Vec<Uuid>, DbError> {
        let mut query = String::from("SELECT id FROM floor_speeches WHERE is_processed = true");
        let mut params: Vec<String> = Vec::new();

        if let Some(c) = chamber {
            params.push(format!("chamber = '{c}'"));
        }
        if let Some(from) = from_date {
            params.push(format!("year_month >= '{from}'"));
        }
        if let Some(to) = to_date {
            params.push(format!("year_month <= '{to}'"));
        }

        if !params.is_empty() {
            query.push_str(" AND ");
            query.push_str(&params.join(" AND "));
        }

        let ids: Vec<(Uuid,)> = sqlx::query_as(&query).fetch_all(self.pool).await?;
        Ok(ids.into_iter().map(|(id,)| id).collect())
    }

    /// Delete a floor speech and all related data
    ///
    /// # Errors
    /// Returns `DbError` if the delete fails
    pub async fn delete(&self, id: Uuid) -> Result<(), DbError> {
        sqlx::query("DELETE FROM floor_speeches WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// Get all event IDs as a set for fast lookup
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_all_event_ids(&self) -> Result<HashSet<String>, DbError> {
        let ids: Vec<(String,)> = sqlx::query_as("SELECT event_id FROM floor_speeches")
            .fetch_all(self.pool)
            .await?;
        Ok(ids.into_iter().map(|(id,)| id).collect())
    }

    /// Batch fetch floor speech metadata (title, chamber, date, source_url) for search result enrichment
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_metadata_batch(
        &self,
        ids: &[Uuid],
    ) -> Result<std::collections::HashMap<Uuid, (String, Option<String>, Option<chrono::NaiveDate>, Option<String>)>, DbError> {
        use std::collections::HashMap;

        if ids.is_empty() {
            return Ok(HashMap::new());
        }

        let rows: Vec<(Uuid, String, Option<String>, Option<chrono::NaiveDate>, Option<String>)> = sqlx::query_as(
            "SELECT id, title, chamber, speech_date, source_url FROM floor_speeches WHERE id = ANY($1)",
        )
        .bind(ids)
        .fetch_all(self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|(id, title, chamber, date, source_url)| (id, (title, chamber, date, source_url)))
            .collect())
    }

    /// Batch fetch floor speech metadata by `event_id` (for FTS results)
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_metadata_batch_by_event_id(
        &self,
        event_ids: &[String],
    ) -> Result<std::collections::HashMap<String, (String, Option<String>, Option<chrono::NaiveDate>, Option<String>)>, DbError> {
        use std::collections::HashMap;

        if event_ids.is_empty() {
            return Ok(HashMap::new());
        }

        let rows: Vec<(String, String, Option<String>, Option<chrono::NaiveDate>, Option<String>)> = sqlx::query_as(
            "SELECT event_id, title, chamber, speech_date, source_url FROM floor_speeches WHERE event_id = ANY($1)",
        )
        .bind(event_ids)
        .fetch_all(self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|(event_id, title, chamber, date, source_url)| (event_id, (title, chamber, date, source_url)))
            .collect())
    }
}
