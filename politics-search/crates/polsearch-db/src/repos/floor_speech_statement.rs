//! Floor speech statement repository

use crate::DbError;
use polsearch_core::FloorSpeechStatement;
use sqlx::PgPool;
use uuid::Uuid;

pub struct FloorSpeechStatementRepo<'a> {
    pool: &'a PgPool,
}

impl<'a> FloorSpeechStatementRepo<'a> {
    #[must_use]
    pub const fn new(pool: &'a PgPool) -> Self {
        Self { pool }
    }

    /// Insert a new floor speech statement
    ///
    /// # Errors
    /// Returns `DbError` if the insert fails
    pub async fn create(&self, statement: &FloorSpeechStatement) -> Result<(), DbError> {
        sqlx::query(
            r"
            INSERT INTO floor_speech_statements (id, floor_speech_id, statement_index, speaker_label,
                                                  speaker_id, text, word_count, created_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ",
        )
        .bind(statement.id)
        .bind(statement.floor_speech_id)
        .bind(statement.statement_index)
        .bind(&statement.speaker_label)
        .bind(statement.speaker_id)
        .bind(&statement.text)
        .bind(statement.word_count)
        .bind(statement.created_at)
        .execute(self.pool)
        .await?;
        Ok(())
    }

    /// Batch insert floor speech statements
    ///
    /// # Errors
    /// Returns `DbError` if the insert fails
    pub async fn create_batch(&self, statements: &[FloorSpeechStatement]) -> Result<(), DbError> {
        if statements.is_empty() {
            return Ok(());
        }

        let mut query_builder = sqlx::QueryBuilder::new(
            "INSERT INTO floor_speech_statements (id, floor_speech_id, statement_index, speaker_label, speaker_id, text, word_count, created_at) "
        );

        query_builder.push_values(statements, |mut b, stmt| {
            b.push_bind(stmt.id)
                .push_bind(stmt.floor_speech_id)
                .push_bind(stmt.statement_index)
                .push_bind(&stmt.speaker_label)
                .push_bind(stmt.speaker_id)
                .push_bind(&stmt.text)
                .push_bind(stmt.word_count)
                .push_bind(stmt.created_at);
        });

        query_builder.build().execute(self.pool).await?;
        Ok(())
    }

    /// Fetch statements by floor speech ID
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_floor_speech(
        &self,
        floor_speech_id: Uuid,
    ) -> Result<Vec<FloorSpeechStatement>, DbError> {
        let statements = sqlx::query_as::<_, FloorSpeechStatement>(
            "SELECT * FROM floor_speech_statements WHERE floor_speech_id = $1 ORDER BY statement_index",
        )
        .bind(floor_speech_id)
        .fetch_all(self.pool)
        .await?;
        Ok(statements)
    }

    /// Fetch statement by ID
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn get_by_id(&self, id: Uuid) -> Result<Option<FloorSpeechStatement>, DbError> {
        let statement = sqlx::query_as::<_, FloorSpeechStatement>(
            "SELECT * FROM floor_speech_statements WHERE id = $1",
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
        sqlx::query("UPDATE floor_speech_statements SET speaker_id = $2 WHERE id = $1")
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
            sqlx::query_as("SELECT speaker_label FROM floor_speech_statements WHERE id = $1")
                .bind(id)
                .fetch_optional(self.pool)
                .await?;
        Ok(result.map(|(label,)| label))
    }

    /// Count statements for a floor speech
    ///
    /// # Errors
    /// Returns `DbError` if the query fails
    pub async fn count_by_floor_speech(&self, floor_speech_id: Uuid) -> Result<i64, DbError> {
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM floor_speech_statements WHERE floor_speech_id = $1",
        )
        .bind(floor_speech_id)
        .fetch_one(self.pool)
        .await?;
        Ok(count.0)
    }
}
