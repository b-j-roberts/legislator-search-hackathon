//! Roll call vote model - congressional vote metadata

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// A congressional roll call vote with metadata
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct RollCallVote {
    pub id: Uuid,
    /// Unique vote identifier (e.g., "h1-116.2019" or "s323-116.2019")
    pub vote_id: String,
    /// Congress number (e.g., 116, 117, 118, 119)
    pub congress: i16,
    /// Chamber: "House" or "Senate"
    pub chamber: String,
    /// Session year (e.g., "2019", "2020")
    pub session: String,
    /// Vote number within session
    pub vote_number: i32,
    /// Date and time of the vote
    pub vote_date: DateTime<Utc>,
    /// Year-month for filtering (e.g., "2019-01")
    pub year_month: String,
    /// What was voted on
    pub question: String,
    /// Type of vote (e.g., "On Passage", "On the Nomination")
    pub vote_type: Option<String>,
    /// Category (e.g., "passage", "amendment", "nomination", "quorum")
    pub category: Option<String>,
    /// Subject description
    pub subject: Option<String>,
    /// Result (e.g., "Passed", "Failed", "Nomination Confirmed")
    pub result: String,
    /// Full result text (e.g., "Passed (215-206)")
    pub result_text: Option<String>,
    /// Voting threshold required (e.g., "1/2", "2/3")
    pub requires: Option<String>,
    /// Denormalized counts
    pub yea_count: i32,
    pub nay_count: i32,
    pub present_count: i32,
    pub not_voting_count: i32,
    /// Optional foreign keys to related entities
    pub bill_id: Option<Uuid>,
    pub amendment_id: Option<Uuid>,
    pub nomination_id: Option<Uuid>,
    /// URL to the source data
    pub source_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl RollCallVote {
    /// Creates a new roll call vote
    #[must_use]
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        vote_id: String,
        congress: i16,
        chamber: String,
        session: String,
        vote_number: i32,
        vote_date: DateTime<Utc>,
        question: String,
        result: String,
    ) -> Self {
        let year_month = vote_date.format("%Y-%m").to_string();
        Self {
            id: Uuid::now_v7(),
            vote_id,
            congress,
            chamber,
            session,
            vote_number,
            vote_date,
            year_month,
            question,
            vote_type: None,
            category: None,
            subject: None,
            result,
            result_text: None,
            requires: None,
            yea_count: 0,
            nay_count: 0,
            present_count: 0,
            not_voting_count: 0,
            bill_id: None,
            amendment_id: None,
            nomination_id: None,
            source_url: None,
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    /// Sets optional vote metadata
    #[must_use]
    pub fn with_metadata(
        mut self,
        vote_type: Option<String>,
        category: Option<String>,
        subject: Option<String>,
        result_text: Option<String>,
        requires: Option<String>,
        source_url: Option<String>,
    ) -> Self {
        self.vote_type = vote_type;
        self.category = category;
        self.subject = subject;
        self.result_text = result_text;
        self.requires = requires;
        self.source_url = source_url;
        self
    }

    /// Sets vote counts
    #[must_use]
    pub const fn with_counts(
        mut self,
        yea: i32,
        nay: i32,
        present: i32,
        not_voting: i32,
    ) -> Self {
        self.yea_count = yea;
        self.nay_count = nay;
        self.present_count = present;
        self.not_voting_count = not_voting;
        self
    }

    /// Sets related bill reference
    #[must_use]
    pub const fn with_bill(mut self, bill_id: Uuid) -> Self {
        self.bill_id = Some(bill_id);
        self
    }

    /// Sets related nomination reference
    #[must_use]
    pub const fn with_nomination(mut self, nomination_id: Uuid) -> Self {
        self.nomination_id = Some(nomination_id);
        self
    }

    /// Total votes cast (yea + nay + present)
    #[must_use]
    pub const fn total_voting(&self) -> i32 {
        self.yea_count + self.nay_count + self.present_count
    }

    /// Returns true if this is a House vote
    #[must_use]
    pub fn is_house(&self) -> bool {
        self.chamber == "House"
    }

    /// Returns true if this is a Senate vote
    #[must_use]
    pub fn is_senate(&self) -> bool {
        self.chamber == "Senate"
    }
}
