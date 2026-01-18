//! Nomination repository

use crate::DbError;
use polsearch_core::Nomination;
use sqlx::PgPool;
use uuid::Uuid;

pub struct NominationRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> NominationRepo<'a> {
    #[must_use]
    pub const fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new nomination
    ///
    /// # Errors
    /// Returns `DbError` if the insert fails
    pub async fn create(&self, nomination: &Nomination) -> Result<(), DbError> {
        sqlx::query(
            r"
            INSERT INTO nominations (id, congress, nomination_number, name, position, created_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (congress, nomination_number) DO NOTHING
            ",
        )
        .bind(nomination.id)
        .bind(nomination.congress)
        .bind(&nomination.nomination_number)
        .bind(&nomination.name)
        .bind(&nomination.position)
        .bind(nomination.created_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Get nomination by ID
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<Nomination>, DbError> {
        let nomination =
            sqlx::query_as::<_, Nomination>("SELECT * FROM nominations WHERE id = $1")
                .bind(id)
                .fetch_optional(self.pool)
                .await?;
        Ok(nomination)
    }

    /// Get nomination by congress and number
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_identifier(
        &self,
        congress: i16,
        nomination_number: &str,
    ) -> Result<Option<Nomination>, DbError> {
        let nomination = sqlx::query_as::<_, Nomination>(
            "SELECT * FROM nominations WHERE congress = $1 AND nomination_number = $2",
        )
        .bind(congress)
        .bind(nomination_number)
        .fetch_optional(self.pool)
        .await?;
        Ok(nomination)
    }

    /// Get or create a nomination, returning the ID
    ///
    /// # Errors
    /// Returns `DbError` if the operation fails
    pub async fn get_or_create(&self, nomination: &Nomination) -> Result<Uuid, DbError> {
        if let Some(existing) = self
            .get_by_identifier(nomination.congress, &nomination.nomination_number)
            .await?
        {
            return Ok(existing.id);
        }

        self.create(nomination).await?;
        Ok(nomination.id)
    }

    /// Count all nominations
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn count(&self) -> Result<i64, DbError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM nominations")
            .fetch_one(self.pool)
            .await?;
        Ok(count.0)
    }
}
