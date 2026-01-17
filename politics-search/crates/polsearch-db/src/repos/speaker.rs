//! Speaker repository

use chrono::Utc;

use crate::DbError;
use polsearch_core::Speaker;
use sqlx::PgPool;
use uuid::Uuid;

pub struct SpeakerRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> SpeakerRepo<'a> {
    #[must_use]
    pub const fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new speaker
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the insert fails
    pub async fn create(&self, speaker: &Speaker) -> Result<(), DbError> {
        sqlx::query(
            r"
            INSERT INTO speakers (id, merged_into_id, name, slug, total_appearances,
                                  is_verified, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ",
        )
        .bind(speaker.id)
        .bind(speaker.merged_into_id)
        .bind(&speaker.name)
        .bind(&speaker.slug)
        .bind(speaker.total_appearances)
        .bind(speaker.is_verified)
        .bind(speaker.created_at)
        .bind(speaker.updated_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Fetch speaker by ID
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<Speaker>, DbError> {
        let speaker = sqlx::query_as::<_, Speaker>("SELECT * FROM speakers WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool)
            .await?;
        Ok(speaker)
    }

    /// Fetch speaker by slug
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_by_slug(&self, slug: &str) -> Result<Option<Speaker>, DbError> {
        let speaker = sqlx::query_as::<_, Speaker>("SELECT * FROM speakers WHERE slug = $1")
            .bind(slug)
            .fetch_optional(self.pool)
            .await?;
        Ok(speaker)
    }

    /// Fetch all non-merged speakers
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_all(&self) -> Result<Vec<Speaker>, DbError> {
        let speakers = sqlx::query_as::<_, Speaker>(
            "SELECT * FROM speakers WHERE merged_into_id IS NULL ORDER BY total_appearances DESC",
        )
        .fetch_all(self.pool)
        .await?;
        Ok(speakers)
    }

    /// Follow the merge chain to find the canonical speaker
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_canonical(&self, id: Uuid) -> Result<Option<Speaker>, DbError> {
        let speaker = sqlx::query_as::<_, Speaker>(
            r"
            WITH RECURSIVE canonical AS (
                SELECT * FROM speakers WHERE id = $1
                UNION ALL
                SELECT s.* FROM speakers s
                INNER JOIN canonical c ON s.id = c.merged_into_id
            )
            SELECT * FROM canonical WHERE merged_into_id IS NULL
            ",
        )
        .bind(id)
        .fetch_optional(self.pool)
        .await?;
        Ok(speaker)
    }

    /// Update a speaker
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the update fails
    pub async fn update(&self, speaker: &Speaker) -> Result<(), DbError> {
        sqlx::query(
            r"
            UPDATE speakers
            SET merged_into_id = $2, name = $3, slug = $4, total_appearances = $5, is_verified = $6, updated_at = $7
            WHERE id = $1
            ",
        )
        .bind(speaker.id)
        .bind(speaker.merged_into_id)
        .bind(&speaker.name)
        .bind(&speaker.slug)
        .bind(speaker.total_appearances)
        .bind(speaker.is_verified)
        .bind(Utc::now())
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Merge one speaker into another
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the merge fails or is invalid
    pub async fn merge(&self, from_id: Uuid, into_id: Uuid) -> Result<(), DbError> {
        if from_id == into_id {
            return Err(DbError::InvalidOperation(
                "Cannot merge speaker into itself".into(),
            ));
        }

        // check for circular merge
        let into_speaker = self.get_by_id(into_id).await?;
        if let Some(s) = into_speaker
            && s.merged_into_id == Some(from_id)
        {
            return Err(DbError::InvalidOperation("Circular merge detected".into()));
        }

        sqlx::query("UPDATE speakers SET merged_into_id = $2, updated_at = NOW() WHERE id = $1")
            .bind(from_id)
            .bind(into_id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// Delete a speaker
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the delete fails
    pub async fn delete(&self, id: Uuid) -> Result<(), DbError> {
        sqlx::query("DELETE FROM speakers WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// Increment appearance count
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the update fails
    pub async fn increment_appearances(&self, id: Uuid) -> Result<(), DbError> {
        sqlx::query("UPDATE speakers SET total_appearances = total_appearances + 1, updated_at = NOW() WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// Count non-merged speakers
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn count(&self) -> Result<i32, DbError> {
        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM speakers WHERE merged_into_id IS NULL")
                .fetch_one(self.pool)
                .await?;
        Ok(i32::try_from(count.0).unwrap_or(i32::MAX))
    }
}
