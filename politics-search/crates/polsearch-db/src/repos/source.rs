//! Source repository

use crate::DbError;
use chrono::{DateTime, Utc};
use polsearch_core::Source;
use polsearch_util::slugify;
use sqlx::PgPool;
use strsim::jaro_winkler;
use uuid::Uuid;

pub struct SourceRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> SourceRepo<'a> {
    #[must_use]
    pub const fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new source
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the insert fails
    pub async fn create(&self, source: &Source) -> Result<(), DbError> {
        sqlx::query(
            r"
            INSERT INTO sources (id, name, slug, url, artwork_url, known_hosts, tier,
                                  last_fetched_at, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ",
        )
        .bind(source.id)
        .bind(&source.name)
        .bind(&source.slug)
        .bind(&source.url)
        .bind(&source.artwork_url)
        .bind(serde_json::to_value(&source.known_hosts).unwrap_or_default())
        .bind(source.tier)
        .bind(source.last_fetched_at)
        .bind(source.created_at)
        .bind(source.updated_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Fetch source by ID
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<Source>, DbError> {
        let source = sqlx::query_as::<_, Source>("SELECT * FROM sources WHERE id = $1")
            .bind(id)
            .fetch_optional(self.pool)
            .await?;
        Ok(source)
    }

    /// Fetch source by slug
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_by_slug(&self, slug: &str) -> Result<Option<Source>, DbError> {
        let source = sqlx::query_as::<_, Source>("SELECT * FROM sources WHERE slug = $1")
            .bind(slug)
            .fetch_optional(self.pool)
            .await?;
        Ok(source)
    }

    /// Find source by fuzzy matching against name or slug
    ///
    /// Tries exact slug match first, then falls back to fuzzy matching
    /// using Jaro-Winkler similarity. Returns the best match if score > 0.7.
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn find_by_fuzzy_match(&self, query: &str) -> Result<Option<Source>, DbError> {
        let normalized = slugify(query);

        // fast path: exact slug match
        if let Some(source) = self.get_by_slug(&normalized).await? {
            return Ok(Some(source));
        }

        // fuzzy match against all sources
        let sources = self.get_all().await?;
        let query_lower = query.to_lowercase();

        let best = sources
            .into_iter()
            .map(|p| {
                let slug_score = jaro_winkler(&normalized, &p.slug);
                let name_score = jaro_winkler(&query_lower, &p.name.to_lowercase());
                let score = slug_score.max(name_score);
                (p, score)
            })
            .filter(|(_, score)| *score > 0.7)
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

        Ok(best.map(|(p, _)| p))
    }

    /// Fetch all sources
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn get_all(&self) -> Result<Vec<Source>, DbError> {
        let sources = sqlx::query_as::<_, Source>("SELECT * FROM sources ORDER BY tier, name")
            .fetch_all(self.pool)
            .await?;
        Ok(sources)
    }

    /// Update a source
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the update fails
    pub async fn update(&self, source: &Source) -> Result<(), DbError> {
        sqlx::query(
            r"
            UPDATE sources
            SET name = $2, slug = $3, url = $4, artwork_url = $5, known_hosts = $6,
                tier = $7, last_fetched_at = $8, updated_at = $9
            WHERE id = $1
            ",
        )
        .bind(source.id)
        .bind(&source.name)
        .bind(&source.slug)
        .bind(&source.url)
        .bind(&source.artwork_url)
        .bind(serde_json::to_value(&source.known_hosts).unwrap_or_default())
        .bind(source.tier)
        .bind(source.last_fetched_at)
        .bind(Utc::now())
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Delete a source
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the delete fails
    pub async fn delete(&self, id: Uuid) -> Result<(), DbError> {
        sqlx::query("DELETE FROM sources WHERE id = $1")
            .bind(id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// Update last fetched timestamp
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the update fails
    pub async fn update_last_fetched(&self, id: Uuid, at: DateTime<Utc>) -> Result<(), DbError> {
        sqlx::query("UPDATE sources SET last_fetched_at = $2, updated_at = NOW() WHERE id = $1")
            .bind(id)
            .bind(at)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// Count all sources
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the query fails
    pub async fn count(&self) -> Result<i32, DbError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM sources")
            .fetch_one(self.pool)
            .await?;
        Ok(i32::try_from(count.0).unwrap_or(i32::MAX))
    }
}
