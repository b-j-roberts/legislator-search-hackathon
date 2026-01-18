//! Hearing repository

use crate::DbError;
use chrono::NaiveDate;
use polsearch_core::Hearing;
use sqlx::PgPool;
use std::collections::{HashMap, HashSet};
use uuid::Uuid;

/// Metadata for a hearing, used for search result enrichment
#[derive(Debug, Clone)]
pub struct HearingMetadata {
    pub title: String,
    pub committee: Option<String>,
    pub date: Option<NaiveDate>,
    pub source_url: Option<String>,
    pub chambers: Option<String>,
    pub congress: Option<i16>,
}

pub struct HearingRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> HearingRepo<'a> {
    #[must_use]
    pub const fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new hearing
    ///
    /// # Errors
    /// Returns `DbError` if the insert fails
    pub async fn create(&self, hearing: &Hearing) -> Result<(), DbError> {
        sqlx::query(
            r"
            INSERT INTO hearings (id, package_id, event_id, title, committee_raw, committee_slug,
                                  chambers, congress, hearing_date, year_month, source_url,
                                  total_statements, total_segments, is_processed, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            ",
        )
        .bind(hearing.id)
        .bind(&hearing.package_id)
        .bind(&hearing.event_id)
        .bind(&hearing.title)
        .bind(&hearing.committee_raw)
        .bind(&hearing.committee_slug)
        .bind(&hearing.chambers)
        .bind(hearing.congress)
        .bind(hearing.hearing_date)
        .bind(&hearing.year_month)
        .bind(&hearing.source_url)
        .bind(hearing.total_statements)
        .bind(hearing.total_segments)
        .bind(hearing.is_processed)
        .bind(hearing.created_at)
        .bind(hearing.updated_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Fetch hearing by ID
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<Hearing>, DbError> {
        let hearing = sqlx::query_as::<_, Hearing>("SELECT * FROM hearings WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool)
            .await?;
        Ok(hearing)
    }

    /// Fetch hearing by package ID
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_package_id(&self, package_id: &str) -> Result<Option<Hearing>, DbError> {
        let hearing =
            sqlx::query_as::<_, Hearing>("SELECT * FROM hearings WHERE package_id = $1")
                .bind(package_id)
                .fetch_optional(self.pool)
                .await?;
        Ok(hearing)
    }

    /// Check if hearing exists by package ID
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn exists_by_package_id(&self, package_id: &str) -> Result<bool, DbError> {
        let exists: (bool,) = sqlx::query_as(
            "SELECT EXISTS(SELECT 1 FROM hearings WHERE package_id = $1)",
        )
        .bind(package_id)
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
            UPDATE hearings
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

    /// Fetch hearings by congress number
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_congress(&self, congress: i16) -> Result<Vec<Hearing>, DbError> {
        let hearings = sqlx::query_as::<_, Hearing>(
            "SELECT * FROM hearings WHERE congress = $1 ORDER BY hearing_date DESC",
        )
        .bind(congress)
        .fetch_all(self.pool)
        .await?;
        Ok(hearings)
    }

    /// Fetch hearings by chamber (supports array contains)
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_chamber(&self, chamber: &str) -> Result<Vec<Hearing>, DbError> {
        let hearings = sqlx::query_as::<_, Hearing>(
            "SELECT * FROM hearings WHERE $1 = ANY(chambers) ORDER BY hearing_date DESC",
        )
        .bind(chamber)
        .fetch_all(self.pool)
        .await?;
        Ok(hearings)
    }

    /// Fetch hearings by committee slug (fuzzy match)
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_committee_fuzzy(&self, query: &str) -> Result<Vec<Hearing>, DbError> {
        let pattern = format!("%{}%", query.to_lowercase());
        let hearings = sqlx::query_as::<_, Hearing>(
            "SELECT * FROM hearings WHERE LOWER(committee_slug) LIKE $1 ORDER BY hearing_date DESC",
        )
        .bind(pattern)
        .fetch_all(self.pool)
        .await?;
        Ok(hearings)
    }

    /// Count all hearings
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn count(&self) -> Result<i64, DbError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM hearings")
            .fetch_one(self.pool)
            .await?;
        Ok(count.0)
    }

    /// Count processed hearings
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn count_processed(&self) -> Result<i64, DbError> {
        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM hearings WHERE is_processed = true")
                .fetch_one(self.pool)
                .await?;
        Ok(count.0)
    }

    /// Get IDs of hearings matching filters for search
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_filtered_ids(
        &self,
        chamber: Option<&str>,
        committee: Option<&str>,
        congress: Option<i16>,
        from_date: Option<&str>,
        to_date: Option<&str>,
    ) -> Result<Vec<Uuid>, DbError> {
        let mut query = String::from("SELECT id FROM hearings WHERE is_processed = true");
        let mut params: Vec<String> = Vec::new();

        if let Some(c) = chamber {
            params.push(format!("'{}' = ANY(chambers)", c));
        }
        if let Some(comm) = committee {
            params.push(format!(
                "LOWER(committee_slug) LIKE '%{}%'",
                comm.to_lowercase()
            ));
        }
        if let Some(cong) = congress {
            params.push(format!("congress = {cong}"));
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

    /// Delete a hearing and all related data
    ///
    /// # Errors
    /// Returns `DbError` if the delete fails
    pub async fn delete(&self, id: Uuid) -> Result<(), DbError> {
        sqlx::query("DELETE FROM hearings WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// Get all package IDs as a set for fast lookup
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_all_package_ids(&self) -> Result<HashSet<String>, DbError> {
        let ids: Vec<(String,)> = sqlx::query_as("SELECT package_id FROM hearings")
            .fetch_all(self.pool)
            .await?;
        Ok(ids.into_iter().map(|(id,)| id).collect())
    }

    /// Batch fetch hearing metadata for search result enrichment
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_metadata_batch(&self, ids: &[Uuid]) -> Result<HashMap<Uuid, HearingMetadata>, DbError> {
        if ids.is_empty() {
            return Ok(HashMap::new());
        }

        let rows: Vec<(
            Uuid,
            String,
            Option<String>,
            Option<NaiveDate>,
            Option<String>,
            Option<Vec<String>>,
            Option<i16>,
        )> = sqlx::query_as(
            "SELECT id, title, committee_raw, hearing_date, source_url, chambers, congress
             FROM hearings WHERE id = ANY($1)",
        )
        .bind(ids)
        .fetch_all(self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|(id, title, committee, date, source_url, chambers, congress)| {
                let chambers_str = chambers.map(|c| c.join(", "));
                (
                    id,
                    HearingMetadata {
                        title,
                        committee,
                        date,
                        source_url,
                        chambers: chambers_str,
                        congress,
                    },
                )
            })
            .collect())
    }

    /// Batch fetch hearing metadata by `package_id` (for FTS results)
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_metadata_batch_by_package_id(
        &self,
        package_ids: &[String],
    ) -> Result<HashMap<String, HearingMetadata>, DbError> {
        if package_ids.is_empty() {
            return Ok(HashMap::new());
        }

        let rows: Vec<(
            String,
            String,
            Option<String>,
            Option<NaiveDate>,
            Option<String>,
            Option<Vec<String>>,
            Option<i16>,
        )> = sqlx::query_as(
            "SELECT package_id, title, committee_raw, hearing_date, source_url, chambers, congress
             FROM hearings WHERE package_id = ANY($1)",
        )
        .bind(package_ids)
        .fetch_all(self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|(pkg_id, title, committee, date, source_url, chambers, congress)| {
                let chambers_str = chambers.map(|c| c.join(", "));
                (
                    pkg_id,
                    HearingMetadata {
                        title,
                        committee,
                        date,
                        source_url,
                        chambers: chambers_str,
                        congress,
                    },
                )
            })
            .collect())
    }
}
