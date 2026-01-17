//! Committee repository

use crate::DbError;
use polsearch_core::Committee;
use sqlx::PgPool;
use uuid::Uuid;

pub struct CommitteeRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> CommitteeRepo<'a> {
    #[must_use]
    pub const fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new committee
    ///
    /// # Errors
    /// Returns `DbError` if the insert fails
    pub async fn create(&self, committee: &Committee) -> Result<(), DbError> {
        sqlx::query(
            r"
            INSERT INTO committees (id, name, slug, chamber, created_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (slug) DO NOTHING
            ",
        )
        .bind(committee.id)
        .bind(&committee.name)
        .bind(&committee.slug)
        .bind(&committee.chamber)
        .bind(committee.created_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Find or create a committee by name
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn find_or_create(
        &self,
        name: &str,
        slug: &str,
        chamber: Option<&str>,
    ) -> Result<Committee, DbError> {
        if let Some(existing) = self.get_by_slug(slug).await? {
            return Ok(existing);
        }

        let committee = Committee::new(
            name.to_string(),
            slug.to_string(),
            chamber.map(String::from),
        );
        self.create(&committee).await?;
        Ok(committee)
    }

    /// Fetch committee by slug
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_slug(&self, slug: &str) -> Result<Option<Committee>, DbError> {
        let committee =
            sqlx::query_as::<_, Committee>("SELECT * FROM committees WHERE slug = $1")
                .bind(slug)
                .fetch_optional(self.pool)
                .await?;
        Ok(committee)
    }

    /// Fetch all committees
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_all(&self) -> Result<Vec<Committee>, DbError> {
        let committees =
            sqlx::query_as::<_, Committee>("SELECT * FROM committees ORDER BY name")
                .fetch_all(self.pool)
                .await?;
        Ok(committees)
    }

    /// Fetch committees by chamber
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_chamber(&self, chamber: &str) -> Result<Vec<Committee>, DbError> {
        let committees = sqlx::query_as::<_, Committee>(
            "SELECT * FROM committees WHERE chamber = $1 ORDER BY name",
        )
        .bind(chamber)
        .fetch_all(self.pool)
        .await?;
        Ok(committees)
    }

    /// Search committees by fuzzy name match
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn search(&self, query: &str) -> Result<Vec<Committee>, DbError> {
        let pattern = format!("%{}%", query.to_lowercase());
        let committees = sqlx::query_as::<_, Committee>(
            "SELECT * FROM committees WHERE LOWER(name) LIKE $1 OR LOWER(slug) LIKE $1 ORDER BY name",
        )
        .bind(pattern)
        .fetch_all(self.pool)
        .await?;
        Ok(committees)
    }

    /// Get committees with hearing counts
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    #[allow(clippy::type_complexity)]
    pub async fn get_with_counts(&self) -> Result<Vec<(Committee, i64)>, DbError> {
        let rows: Vec<(Uuid, String, String, Option<String>, chrono::DateTime<chrono::Utc>, i64)> = sqlx::query_as(
            r"
            SELECT c.id, c.name, c.slug, c.chamber, c.created_at,
                   COUNT(h.id) as hearing_count
            FROM committees c
            LEFT JOIN hearings h ON h.committee_slug = c.slug
            GROUP BY c.id, c.name, c.slug, c.chamber, c.created_at
            ORDER BY hearing_count DESC, c.name
            ",
        )
        .fetch_all(self.pool)
        .await?;

        Ok(rows
            .into_iter()
            .map(|(id, name, slug, chamber, created_at, count)| {
                (
                    Committee {
                        id,
                        name,
                        slug,
                        chamber,
                        created_at,
                    },
                    count,
                )
            })
            .collect())
    }

    /// Count all committees
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn count(&self) -> Result<i64, DbError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM committees")
            .fetch_one(self.pool)
            .await?;
        Ok(count.0)
    }
}
