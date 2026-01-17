//! Legislator repository

use crate::DbError;
use polsearch_core::Legislator;
use sqlx::PgPool;
use uuid::Uuid;

pub struct LegislatorRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> LegislatorRepo<'a> {
    #[must_use]
    pub const fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new legislator
    ///
    /// # Errors
    /// Returns `DbError` if the insert fails
    pub async fn create(&self, legislator: &Legislator) -> Result<(), DbError> {
        sqlx::query(
            r"
            INSERT INTO legislators (id, bioguide_id, lis_id, first_name, last_name, display_name,
                                     current_party, current_state, current_chamber, is_active,
                                     created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (bioguide_id) DO UPDATE SET
                lis_id = COALESCE(EXCLUDED.lis_id, legislators.lis_id),
                first_name = CASE WHEN EXCLUDED.first_name = '' THEN legislators.first_name ELSE EXCLUDED.first_name END,
                last_name = CASE WHEN EXCLUDED.last_name = '' THEN legislators.last_name ELSE EXCLUDED.last_name END,
                display_name = EXCLUDED.display_name,
                current_party = EXCLUDED.current_party,
                current_state = EXCLUDED.current_state,
                current_chamber = EXCLUDED.current_chamber,
                is_active = EXCLUDED.is_active,
                updated_at = NOW()
            ",
        )
        .bind(legislator.id)
        .bind(&legislator.bioguide_id)
        .bind(&legislator.lis_id)
        .bind(&legislator.first_name)
        .bind(&legislator.last_name)
        .bind(&legislator.display_name)
        .bind(&legislator.current_party)
        .bind(&legislator.current_state)
        .bind(&legislator.current_chamber)
        .bind(legislator.is_active)
        .bind(legislator.created_at)
        .bind(legislator.updated_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Fetch legislator by ID
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<Legislator>, DbError> {
        let legislator = sqlx::query_as::<_, Legislator>("SELECT * FROM legislators WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool)
            .await?;
        Ok(legislator)
    }

    /// Fetch legislator by bioguide ID
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_bioguide(&self, bioguide_id: &str) -> Result<Option<Legislator>, DbError> {
        let legislator =
            sqlx::query_as::<_, Legislator>("SELECT * FROM legislators WHERE bioguide_id = $1")
                .bind(bioguide_id)
                .fetch_optional(self.pool)
                .await?;
        Ok(legislator)
    }

    /// Fetch legislator by LIS ID (Senate only)
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_lis(&self, lis_id: &str) -> Result<Option<Legislator>, DbError> {
        let legislator =
            sqlx::query_as::<_, Legislator>("SELECT * FROM legislators WHERE lis_id = $1")
                .bind(lis_id)
                .fetch_optional(self.pool)
                .await?;
        Ok(legislator)
    }

    /// Check if legislator exists by bioguide ID
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn exists_by_bioguide(&self, bioguide_id: &str) -> Result<bool, DbError> {
        let exists: (bool,) = sqlx::query_as(
            "SELECT EXISTS(SELECT 1 FROM legislators WHERE bioguide_id = $1)",
        )
        .bind(bioguide_id)
        .fetch_one(self.pool)
        .await?;
        Ok(exists.0)
    }

    /// Get all legislators by chamber
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_chamber(&self, chamber: &str) -> Result<Vec<Legislator>, DbError> {
        let legislators = sqlx::query_as::<_, Legislator>(
            "SELECT * FROM legislators WHERE current_chamber = $1 ORDER BY last_name, first_name",
        )
        .bind(chamber)
        .fetch_all(self.pool)
        .await?;
        Ok(legislators)
    }

    /// Get all active legislators
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_active(&self) -> Result<Vec<Legislator>, DbError> {
        let legislators = sqlx::query_as::<_, Legislator>(
            "SELECT * FROM legislators WHERE is_active = true ORDER BY last_name, first_name",
        )
        .fetch_all(self.pool)
        .await?;
        Ok(legislators)
    }

    /// Count all legislators
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn count(&self) -> Result<i64, DbError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM legislators")
            .fetch_one(self.pool)
            .await?;
        Ok(count.0)
    }

    /// Get or create a legislator, returning the ID
    /// Uses `bioguide_id` for House members, `lis_id` for Senate members (with bioguide lookup)
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_or_create(&self, legislator: &Legislator) -> Result<Uuid, DbError> {
        // first try to find by bioguide
        if let Some(existing) = self.get_by_bioguide(&legislator.bioguide_id).await? {
            return Ok(existing.id);
        }

        // for senators, also try by lis_id
        if let Some(ref lis_id) = legislator.lis_id {
            if let Some(existing) = self.get_by_lis(lis_id).await? {
                return Ok(existing.id);
            }
        }

        // create new
        self.create(legislator).await?;
        Ok(legislator.id)
    }
}
