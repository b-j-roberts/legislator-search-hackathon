//! Roll call vote repository

use crate::DbError;
use polsearch_core::RollCallVote;
use sqlx::PgPool;
use uuid::Uuid;

pub struct RollCallVoteRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> RollCallVoteRepo<'a> {
    #[must_use]
    pub const fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new roll call vote
    ///
    /// # Errors
    /// Returns `DbError` if the insert fails
    pub async fn create(&self, vote: &RollCallVote) -> Result<(), DbError> {
        sqlx::query(
            r"
            INSERT INTO roll_call_votes (id, vote_id, congress, chamber, session, vote_number,
                                         vote_date, year_month, question, vote_type, category,
                                         subject, result, result_text, requires, yea_count,
                                         nay_count, present_count, not_voting_count, bill_id,
                                         amendment_id, nomination_id, source_url, created_at,
                                         updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
                    $18, $19, $20, $21, $22, $23, $24, $25)
            ",
        )
        .bind(vote.id)
        .bind(&vote.vote_id)
        .bind(vote.congress)
        .bind(&vote.chamber)
        .bind(&vote.session)
        .bind(vote.vote_number)
        .bind(vote.vote_date)
        .bind(&vote.year_month)
        .bind(&vote.question)
        .bind(&vote.vote_type)
        .bind(&vote.category)
        .bind(&vote.subject)
        .bind(&vote.result)
        .bind(&vote.result_text)
        .bind(&vote.requires)
        .bind(vote.yea_count)
        .bind(vote.nay_count)
        .bind(vote.present_count)
        .bind(vote.not_voting_count)
        .bind(vote.bill_id)
        .bind(vote.amendment_id)
        .bind(vote.nomination_id)
        .bind(&vote.source_url)
        .bind(vote.created_at)
        .bind(vote.updated_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Fetch vote by ID
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<RollCallVote>, DbError> {
        let vote =
            sqlx::query_as::<_, RollCallVote>("SELECT * FROM roll_call_votes WHERE id = $1")
                .bind(id)
                .fetch_optional(self.pool)
                .await?;
        Ok(vote)
    }

    /// Fetch vote by `vote_id` (e.g., "h1-116.2019")
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_vote_id(&self, vote_id: &str) -> Result<Option<RollCallVote>, DbError> {
        let vote =
            sqlx::query_as::<_, RollCallVote>("SELECT * FROM roll_call_votes WHERE vote_id = $1")
                .bind(vote_id)
                .fetch_optional(self.pool)
                .await?;
        Ok(vote)
    }

    /// Check if vote exists by `vote_id`
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn exists_by_vote_id(&self, vote_id: &str) -> Result<bool, DbError> {
        let exists: (bool,) = sqlx::query_as(
            "SELECT EXISTS(SELECT 1 FROM roll_call_votes WHERE vote_id = $1)",
        )
        .bind(vote_id)
        .fetch_one(self.pool)
        .await?;
        Ok(exists.0)
    }

    /// Get votes by congress
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_congress(&self, congress: i16) -> Result<Vec<RollCallVote>, DbError> {
        let votes = sqlx::query_as::<_, RollCallVote>(
            "SELECT * FROM roll_call_votes WHERE congress = $1 ORDER BY vote_date DESC",
        )
        .bind(congress)
        .fetch_all(self.pool)
        .await?;
        Ok(votes)
    }

    /// Get votes by chamber
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_chamber(&self, chamber: &str) -> Result<Vec<RollCallVote>, DbError> {
        let votes = sqlx::query_as::<_, RollCallVote>(
            "SELECT * FROM roll_call_votes WHERE chamber = $1 ORDER BY vote_date DESC",
        )
        .bind(chamber)
        .fetch_all(self.pool)
        .await?;
        Ok(votes)
    }

    /// Get votes by category
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_category(&self, category: &str) -> Result<Vec<RollCallVote>, DbError> {
        let votes = sqlx::query_as::<_, RollCallVote>(
            "SELECT * FROM roll_call_votes WHERE category = $1 ORDER BY vote_date DESC",
        )
        .bind(category)
        .fetch_all(self.pool)
        .await?;
        Ok(votes)
    }

    /// Count all votes
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn count(&self) -> Result<i64, DbError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM roll_call_votes")
            .fetch_one(self.pool)
            .await?;
        Ok(count.0)
    }

    /// Count votes by congress
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn count_by_congress(&self, congress: i16) -> Result<i64, DbError> {
        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM roll_call_votes WHERE congress = $1")
                .bind(congress)
                .fetch_one(self.pool)
                .await?;
        Ok(count.0)
    }

    /// Count votes by chamber
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn count_by_chamber(&self, chamber: &str) -> Result<i64, DbError> {
        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM roll_call_votes WHERE chamber = $1")
                .bind(chamber)
                .fetch_one(self.pool)
                .await?;
        Ok(count.0)
    }

    /// Get votes for a bill
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_bill(&self, bill_id: Uuid) -> Result<Vec<RollCallVote>, DbError> {
        let votes = sqlx::query_as::<_, RollCallVote>(
            "SELECT * FROM roll_call_votes WHERE bill_id = $1 ORDER BY vote_date DESC",
        )
        .bind(bill_id)
        .fetch_all(self.pool)
        .await?;
        Ok(votes)
    }

    /// Get votes for a nomination
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_nomination(&self, nomination_id: Uuid) -> Result<Vec<RollCallVote>, DbError> {
        let votes = sqlx::query_as::<_, RollCallVote>(
            "SELECT * FROM roll_call_votes WHERE nomination_id = $1 ORDER BY vote_date DESC",
        )
        .bind(nomination_id)
        .fetch_all(self.pool)
        .await?;
        Ok(votes)
    }

    /// Get all votes with pagination
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_all_paginated(
        &self,
        offset: i64,
        limit: i64,
    ) -> Result<Vec<RollCallVote>, DbError> {
        let votes = sqlx::query_as::<_, RollCallVote>(
            "SELECT * FROM roll_call_votes ORDER BY vote_date DESC LIMIT $1 OFFSET $2",
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(self.pool)
        .await?;
        Ok(votes)
    }

    /// Get votes by their `vote_ids` (string identifiers like "h1-116.2019")
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_vote_ids(&self, vote_ids: &[String]) -> Result<Vec<RollCallVote>, DbError> {
        if vote_ids.is_empty() {
            return Ok(Vec::new());
        }

        let votes = sqlx::query_as::<_, RollCallVote>(
            "SELECT * FROM roll_call_votes WHERE vote_id = ANY($1) ORDER BY vote_date DESC",
        )
        .bind(vote_ids)
        .fetch_all(self.pool)
        .await?;
        Ok(votes)
    }

    /// Get votes by their UUIDs
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_ids(&self, ids: &[Uuid]) -> Result<Vec<RollCallVote>, DbError> {
        if ids.is_empty() {
            return Ok(Vec::new());
        }

        let votes = sqlx::query_as::<_, RollCallVote>(
            "SELECT * FROM roll_call_votes WHERE id = ANY($1) ORDER BY vote_date DESC",
        )
        .bind(ids)
        .fetch_all(self.pool)
        .await?;
        Ok(votes)
    }

    /// Count votes by year
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn count_by_year(&self, year: i32) -> Result<i64, DbError> {
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM roll_call_votes WHERE EXTRACT(YEAR FROM vote_date) = $1",
        )
        .bind(year)
        .fetch_one(self.pool)
        .await?;
        Ok(count.0)
    }

    /// Get votes by year with pagination
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_year_paginated(
        &self,
        year: i32,
        offset: i64,
        limit: i64,
    ) -> Result<Vec<RollCallVote>, DbError> {
        let votes = sqlx::query_as::<_, RollCallVote>(
            "SELECT * FROM roll_call_votes WHERE EXTRACT(YEAR FROM vote_date) = $1 ORDER BY vote_date DESC LIMIT $2 OFFSET $3",
        )
        .bind(year)
        .bind(limit)
        .bind(offset)
        .fetch_all(self.pool)
        .await?;
        Ok(votes)
    }
}
