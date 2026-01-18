//! Individual vote repository

use crate::DbError;
use polsearch_core::IndividualVote;
use sqlx::PgPool;
use uuid::Uuid;

pub struct IndividualVoteRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> IndividualVoteRepo<'a> {
    #[must_use]
    pub const fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new individual vote
    ///
    /// # Errors
    /// Returns `DbError` if the insert fails
    pub async fn create(&self, vote: &IndividualVote) -> Result<(), DbError> {
        sqlx::query(
            r"
            INSERT INTO individual_votes (id, roll_call_vote_id, legislator_id, position,
                                          raw_position, party_at_vote, state_at_vote, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ",
        )
        .bind(vote.id)
        .bind(vote.roll_call_vote_id)
        .bind(vote.legislator_id)
        .bind(&vote.position)
        .bind(&vote.raw_position)
        .bind(&vote.party_at_vote)
        .bind(&vote.state_at_vote)
        .bind(vote.created_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Batch insert individual votes
    ///
    /// # Errors
    /// Returns `DbError` if the insert fails
    pub async fn create_batch(&self, votes: &[IndividualVote]) -> Result<(), DbError> {
        if votes.is_empty() {
            return Ok(());
        }

        let mut query_builder = sqlx::QueryBuilder::new(
            "INSERT INTO individual_votes (id, roll_call_vote_id, legislator_id, position, raw_position, party_at_vote, state_at_vote, created_at) "
        );

        query_builder.push_values(votes, |mut b, vote| {
            b.push_bind(vote.id)
                .push_bind(vote.roll_call_vote_id)
                .push_bind(vote.legislator_id)
                .push_bind(&vote.position)
                .push_bind(&vote.raw_position)
                .push_bind(&vote.party_at_vote)
                .push_bind(&vote.state_at_vote)
                .push_bind(vote.created_at);
        });

        query_builder.build().execute(self.pool).await?;
        Ok(())
    }

    /// Fetch votes for a roll call
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_roll_call(
        &self,
        roll_call_vote_id: Uuid,
    ) -> Result<Vec<IndividualVote>, DbError> {
        let votes = sqlx::query_as::<_, IndividualVote>(
            "SELECT * FROM individual_votes WHERE roll_call_vote_id = $1 ORDER BY position",
        )
        .bind(roll_call_vote_id)
        .fetch_all(self.pool)
        .await?;
        Ok(votes)
    }

    /// Fetch votes by legislator
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_legislator(
        &self,
        legislator_id: Uuid,
    ) -> Result<Vec<IndividualVote>, DbError> {
        let votes = sqlx::query_as::<_, IndividualVote>(
            "SELECT * FROM individual_votes WHERE legislator_id = $1 ORDER BY created_at DESC",
        )
        .bind(legislator_id)
        .fetch_all(self.pool)
        .await?;
        Ok(votes)
    }

    /// Count votes for a roll call
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn count_by_roll_call(&self, roll_call_vote_id: Uuid) -> Result<i64, DbError> {
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM individual_votes WHERE roll_call_vote_id = $1",
        )
        .bind(roll_call_vote_id)
        .fetch_one(self.pool)
        .await?;
        Ok(count.0)
    }

    /// Count total individual votes
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn count(&self) -> Result<i64, DbError> {
        let count: (i64,) = sqlx::query_as("SELECT COUNT(*) FROM individual_votes")
            .fetch_one(self.pool)
            .await?;
        Ok(count.0)
    }

    /// Get vote counts by position for a roll call
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_position_counts(
        &self,
        roll_call_vote_id: Uuid,
    ) -> Result<Vec<(String, i64)>, DbError> {
        let counts: Vec<(String, i64)> = sqlx::query_as(
            "SELECT position, COUNT(*) FROM individual_votes WHERE roll_call_vote_id = $1 GROUP BY position",
        )
        .bind(roll_call_vote_id)
        .fetch_all(self.pool)
        .await?;
        Ok(counts)
    }

    /// Get vote counts by party for a roll call
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_party_counts(
        &self,
        roll_call_vote_id: Uuid,
    ) -> Result<Vec<(String, String, i64)>, DbError> {
        let counts: Vec<(String, String, i64)> = sqlx::query_as(
            r"SELECT party_at_vote, position, COUNT(*)
              FROM individual_votes
              WHERE roll_call_vote_id = $1
              GROUP BY party_at_vote, position
              ORDER BY party_at_vote, position",
        )
        .bind(roll_call_vote_id)
        .fetch_all(self.pool)
        .await?;
        Ok(counts)
    }
}
