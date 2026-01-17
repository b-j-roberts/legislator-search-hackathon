//! Database layer for `PolSearch`

mod error;
mod repos;

pub use error::DbError;
pub use repos::*;

use sqlx::PgPool;
use sqlx::postgres::PgPoolOptions;

/// Database connection wrapper
#[derive(Clone)]
pub struct Database(PgPool);

impl Database {
    /// Connect to the database with the given URL
    ///
    /// # Errors
    ///
    /// Returns `DbError` if the connection fails
    pub async fn connect(url: &str) -> Result<Self, DbError> {
        let pool = PgPoolOptions::new()
            .max_connections(10)
            .connect(url)
            .await?;
        Ok(Self(pool))
    }

    /// Get the underlying connection pool
    #[must_use]
    pub const fn pool(&self) -> &PgPool {
        &self.0
    }

    /// Get the source repository
    #[must_use]
    pub const fn sources(&self) -> SourceRepo<'_> {
        SourceRepo::new(&self.0)
    }

    /// Get the content repository
    #[must_use]
    pub const fn content(&self) -> ContentRepo<'_> {
        ContentRepo::new(&self.0)
    }

    /// Get the speaker repository
    #[must_use]
    pub const fn speakers(&self) -> SpeakerRepo<'_> {
        SpeakerRepo::new(&self.0)
    }

    /// Get the content speaker repository
    #[must_use]
    pub const fn content_speakers(&self) -> ContentSpeakerRepo<'_> {
        ContentSpeakerRepo::new(&self.0)
    }

    /// Get the transcription batch repository
    #[must_use]
    pub const fn batches(&self) -> TranscriptionBatchRepo<'_> {
        TranscriptionBatchRepo::new(&self.0)
    }

    /// Get the transcription task repository
    #[must_use]
    pub const fn tasks(&self) -> TranscriptionTaskRepo<'_> {
        TranscriptionTaskRepo::new(&self.0)
    }

    /// Get the segment repository
    #[must_use]
    pub const fn segments(&self) -> SegmentRepo<'_> {
        SegmentRepo::new(&self.0)
    }

    // Backward compatibility aliases
    #[must_use]
    pub const fn podcasts(&self) -> SourceRepo<'_> {
        self.sources()
    }

    #[must_use]
    pub const fn episodes(&self) -> ContentRepo<'_> {
        self.content()
    }

    #[must_use]
    pub const fn episode_speakers(&self) -> ContentSpeakerRepo<'_> {
        self.content_speakers()
    }
}
