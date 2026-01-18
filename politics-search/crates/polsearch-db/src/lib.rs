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

    /// Get the hearing repository
    #[must_use]
    pub const fn hearings(&self) -> HearingRepo<'_> {
        HearingRepo::new(&self.0)
    }

    /// Get the hearing statement repository
    #[must_use]
    pub const fn hearing_statements(&self) -> HearingStatementRepo<'_> {
        HearingStatementRepo::new(&self.0)
    }

    /// Get the hearing segment repository
    #[must_use]
    pub const fn hearing_segments(&self) -> HearingSegmentRepo<'_> {
        HearingSegmentRepo::new(&self.0)
    }

    /// Get the committee repository
    #[must_use]
    pub const fn committees(&self) -> CommitteeRepo<'_> {
        CommitteeRepo::new(&self.0)
    }

    /// Get the floor speech repository
    #[must_use]
    pub const fn floor_speeches(&self) -> FloorSpeechRepo<'_> {
        FloorSpeechRepo::new(&self.0)
    }

    /// Get the floor speech statement repository
    #[must_use]
    pub const fn floor_speech_statements(&self) -> FloorSpeechStatementRepo<'_> {
        FloorSpeechStatementRepo::new(&self.0)
    }

    /// Get the floor speech segment repository
    #[must_use]
    pub const fn floor_speech_segments(&self) -> FloorSpeechSegmentRepo<'_> {
        FloorSpeechSegmentRepo::new(&self.0)
    }

    /// Get the legislator repository
    #[must_use]
    pub const fn legislators(&self) -> LegislatorRepo<'_> {
        LegislatorRepo::new(&self.0)
    }

    /// Get the roll call vote repository
    #[must_use]
    pub const fn roll_call_votes(&self) -> RollCallVoteRepo<'_> {
        RollCallVoteRepo::new(&self.0)
    }

    /// Get the individual vote repository
    #[must_use]
    pub const fn individual_votes(&self) -> IndividualVoteRepo<'_> {
        IndividualVoteRepo::new(&self.0)
    }

    /// Get the bill repository
    #[must_use]
    pub const fn bills(&self) -> BillRepo<'_> {
        BillRepo::new(&self.0)
    }

    /// Get the amendment repository
    #[must_use]
    pub const fn amendments(&self) -> AmendmentRepo<'_> {
        AmendmentRepo::new(&self.0)
    }

    /// Get the nomination repository
    #[must_use]
    pub const fn nominations(&self) -> NominationRepo<'_> {
        NominationRepo::new(&self.0)
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
