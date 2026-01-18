//! Amendment repository

use crate::DbError;
use polsearch_core::Amendment;
use sqlx::PgPool;
use uuid::Uuid;

pub struct AmendmentRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> AmendmentRepo<'a> {
    #[must_use]
    pub const fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new amendment
    ///
    /// # Errors
    /// Returns `DbError` if the insert fails
    pub async fn create(&self, amendment: &Amendment) -> Result<(), DbError> {
        sqlx::query(
            r"
            INSERT INTO amendments (id, congress, chamber, amendment_number, purpose, bill_id, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (congress, chamber, amendment_number) DO NOTHING
            ",
        )
        .bind(amendment.id)
        .bind(amendment.congress)
        .bind(&amendment.chamber)
        .bind(amendment.amendment_number)
        .bind(&amendment.purpose)
        .bind(amendment.bill_id)
        .bind(amendment.created_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Get amendment by ID
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<Amendment>, DbError> {
        let amendment = sqlx::query_as::<_, Amendment>("SELECT * FROM amendments WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool)
            .await?;
        Ok(amendment)
    }

    /// Get amendment by congress, chamber, and number
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_identifier(
        &self,
        congress: i16,
        chamber: &str,
        amendment_number: i32,
    ) -> Result<Option<Amendment>, DbError> {
        let amendment = sqlx::query_as::<_, Amendment>(
            "SELECT * FROM amendments WHERE congress = $1 AND chamber = $2 AND amendment_number = $3",
        )
        .bind(congress)
        .bind(chamber)
        .bind(amendment_number)
        .fetch_optional(self.pool)
        .await?;
        Ok(amendment)
    }

    /// Get or create an amendment, returning the ID
    ///
    /// # Errors
    /// Returns `DbError` if the operation fails
    pub async fn get_or_create(&self, amendment: &Amendment) -> Result<Uuid, DbError> {
        if let Some(existing) = self
            .get_by_identifier(amendment.congress, &amendment.chamber, amendment.amendment_number)
            .await?
        {
            return Ok(existing.id);
        }

        self.create(amendment).await?;
        Ok(amendment.id)
    }

    /// Count all amendments
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn count(&self) -> Result<i64, DbError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM amendments")
            .fetch_one(self.pool)
            .await?;
        Ok(count.0)
    }
}
