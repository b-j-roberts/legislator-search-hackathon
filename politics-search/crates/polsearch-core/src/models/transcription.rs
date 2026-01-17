//! Transcription batch and task models

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, Type};
use uuid::Uuid;

/// Status of a transcription batch
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[sqlx(type_name = "VARCHAR", rename_all = "lowercase")]
pub enum BatchStatus {
    Pending,
    Running,
    Completed,
    Failed,
}

impl std::fmt::Display for BatchStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Pending => write!(f, "pending"),
            Self::Running => write!(f, "running"),
            Self::Completed => write!(f, "completed"),
            Self::Failed => write!(f, "failed"),
        }
    }
}

/// Status of an individual transcription task
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Type)]
#[sqlx(type_name = "VARCHAR", rename_all = "lowercase")]
pub enum TaskStatus {
    Queued,
    Processing,
    Completed,
    Failed,
}

impl std::fmt::Display for TaskStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Queued => write!(f, "queued"),
            Self::Processing => write!(f, "processing"),
            Self::Completed => write!(f, "completed"),
            Self::Failed => write!(f, "failed"),
        }
    }
}

/// A batch of content to process, created by `transcribe-plan`
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TranscriptionBatch {
    pub id: Uuid,
    pub name: String,
    pub status: String,
    pub priority: i32,
    pub total_episodes: i32,
    pub completed_episodes: i32,
    pub failed_episodes: i32,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub updated_at: DateTime<Utc>,
}

impl TranscriptionBatch {
    #[must_use]
    pub fn new(name: String) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::now_v7(),
            name,
            status: BatchStatus::Pending.to_string(),
            priority: 0,
            total_episodes: 0,
            completed_episodes: 0,
            failed_episodes: 0,
            created_at: now,
            started_at: None,
            completed_at: None,
            updated_at: now,
        }
    }

    /// Returns the progress as a percentage (0.0 to 100.0)
    #[must_use]
    pub fn progress(&self) -> f64 {
        if self.total_episodes == 0 {
            return 0.0;
        }
        f64::from(self.completed_episodes + self.failed_episodes) / f64::from(self.total_episodes)
            * 100.0
    }

    /// Returns the success rate as a percentage (0.0 to 100.0)
    #[must_use]
    pub fn success_rate(&self) -> f64 {
        let processed = self.completed_episodes + self.failed_episodes;
        if processed == 0 {
            return 100.0;
        }
        f64::from(self.completed_episodes) / f64::from(processed) * 100.0
    }

    #[must_use]
    pub fn batch_status(&self) -> BatchStatus {
        match self.status.as_str() {
            "running" => BatchStatus::Running,
            "completed" => BatchStatus::Completed,
            "failed" => BatchStatus::Failed,
            _ => BatchStatus::Pending,
        }
    }
}

/// An individual content processing task within a batch
#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TranscriptionTask {
    pub id: Uuid,
    pub batch_id: Uuid,
    pub content_id: Uuid,
    pub status: String,
    pub error_message: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl TranscriptionTask {
    #[must_use]
    pub fn new(batch_id: Uuid, content_id: Uuid) -> Self {
        let now = Utc::now();
        Self {
            id: Uuid::now_v7(),
            batch_id,
            content_id,
            status: TaskStatus::Queued.to_string(),
            error_message: None,
            started_at: None,
            completed_at: None,
            created_at: now,
            updated_at: now,
        }
    }

    #[must_use]
    pub fn task_status(&self) -> TaskStatus {
        match self.status.as_str() {
            "processing" => TaskStatus::Processing,
            "completed" => TaskStatus::Completed,
            "failed" => TaskStatus::Failed,
            _ => TaskStatus::Queued,
        }
    }
}
