//! Hearing statement repository

use crate::DbError;
use polsearch_core::HearingStatement;
use sqlx::PgPool;
use uuid::Uuid;

pub struct HearingStatementRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> HearingStatementRepo<'a> {
    #[must_use]
    pub const fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new hearing statement
    ///
    /// # Errors
    /// Returns `DbError` if the insert fails
    pub async fn create(&self, statement: &HearingStatement) -> Result<(), DbError> {
        sqlx::query(
            r"
            INSERT INTO hearing_statements (id, hearing_id, statement_index, speaker_label,
                                             speaker_id, word_count, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ",
        )
        .bind(statement.id)
        .bind(statement.hearing_id)
        .bind(statement.statement_index)
        .bind(&statement.speaker_label)
        .bind(statement.speaker_id)
        .bind(statement.word_count)
        .bind(statement.created_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Batch insert hearing statements
    ///
    /// # Errors
    /// Returns `DbError` if the insert fails
    pub async fn create_batch(&self, statements: &[HearingStatement]) -> Result<(), DbError> {
        if statements.is_empty() {
            return Ok(());
        }

        let mut query_builder = sqlx::QueryBuilder::new(
            "INSERT INTO hearing_statements (id, hearing_id, statement_index, speaker_label, speaker_id, word_count, created_at) "
        );

        query_builder.push_values(statements, |mut b, stmt| {
            b.push_bind(stmt.id)
                .push_bind(stmt.hearing_id)
                .push_bind(stmt.statement_index)
                .push_bind(&stmt.speaker_label)
                .push_bind(stmt.speaker_id)
                .push_bind(stmt.word_count)
                .push_bind(stmt.created_at);
        });

        query_builder.build().execute(self.pool).await?;
        Ok(())
    }

    /// Fetch statements by hearing ID
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_hearing(&self, hearing_id: Uuid) -> Result<Vec<HearingStatement>, DbError> {
        let statements = sqlx::query_as::<_, HearingStatement>(
            r"SELECT id, hearing_id, statement_index, speaker_label, speaker_id, word_count, created_at
              FROM hearing_statements WHERE hearing_id = $1 ORDER BY statement_index",
        )
        .bind(hearing_id)
        .fetch_all(self.pool)
        .await?;
        Ok(statements)
    }

    /// Fetch statement by ID
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<HearingStatement>, DbError> {
        let statement = sqlx::query_as::<_, HearingStatement>(
            r"SELECT id, hearing_id, statement_index, speaker_label, speaker_id, word_count, created_at
              FROM hearing_statements WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(self.pool)
        .await?;
        Ok(statement)
    }

    /// Update speaker ID for a statement
    ///
    /// # Errors
    /// Returns `DbError` if the update fails
    pub async fn set_speaker(&self, id: Uuid, speaker_id: Uuid) -> Result<(), DbError> {
        sqlx::query("UPDATE hearing_statements SET speaker_id = $2 WHERE id = $1")
            .bind(id)
            .bind(speaker_id)
            .execute(self.pool)
            .await?;
        Ok(())
    }

    /// Get speaker label for a statement
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_speaker_label(&self, id: Uuid) -> Result<Option<String>, DbError> {
        let result: Option<(String,)> =
            sqlx::query_as("SELECT speaker_label FROM hearing_statements WHERE id = $1")
                .bind(id)
                .fetch_optional(self.pool)
                .await?;
        Ok(result.map(|(label,)| label))
    }

    /// Count statements for a hearing
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn count_by_hearing(&self, hearing_id: Uuid) -> Result<i64, DbError> {
        let count: (i64,) =
            sqlx::query_as("SELECT COUNT(*) FROM hearing_statements WHERE hearing_id = $1")
                .bind(hearing_id)
                .fetch_one(self.pool)
                .await?;
        Ok(count.0)
    }
}
