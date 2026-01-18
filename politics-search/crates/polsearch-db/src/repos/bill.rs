//! Bill repository

use crate::DbError;
use polsearch_core::Bill;
use sqlx::PgPool;
use uuid::Uuid;

pub struct BillRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> BillRepo<'a> {
    #[must_use]
    pub const fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new bill
    ///
    /// # Errors
    /// Returns `DbError` if the insert fails
    pub async fn create(&self, bill: &Bill) -> Result<(), DbError> {
        sqlx::query(
            r"
            INSERT INTO bills (id, congress, bill_type, bill_number, title, created_at)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (congress, bill_type, bill_number) DO NOTHING
            ",
        )
        .bind(bill.id)
        .bind(bill.congress)
        .bind(&bill.bill_type)
        .bind(bill.bill_number)
        .bind(&bill.title)
        .bind(bill.created_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Get bill by ID
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<Bill>, DbError> {
        let bill = sqlx::query_as::<_, Bill>("SELECT * FROM bills WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool)
            .await?;
        Ok(bill)
    }

    /// Get bill by congress, type, and number
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_identifier(
        &self,
        congress: i16,
        bill_type: &str,
        bill_number: i32,
    ) -> Result<Option<Bill>, DbError> {
        let bill = sqlx::query_as::<_, Bill>(
            "SELECT * FROM bills WHERE congress = $1 AND bill_type = $2 AND bill_number = $3",
        )
        .bind(congress)
        .bind(bill_type)
        .bind(bill_number)
        .fetch_optional(self.pool)
        .await?;
        Ok(bill)
    }

    /// Get or create a bill, returning the ID
    ///
    /// # Errors
    /// Returns `DbError` if the operation fails
    pub async fn get_or_create(&self, bill: &Bill) -> Result<Uuid, DbError> {
        if let Some(existing) =
            self.get_by_identifier(bill.congress, &bill.bill_type, bill.bill_number)
                .await?
        {
            return Ok(existing.id);
        }

        self.create(bill).await?;
        Ok(bill.id)
    }

    /// Count all bills
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn count(&self) -> Result<i64, DbError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM bills")
            .fetch_one(self.pool)
            .await?;
        Ok(count.0)
    }
}
