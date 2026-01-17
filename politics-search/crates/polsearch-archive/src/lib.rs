//! Archive storage for raw transcription and diarization data
//!
//! Stores raw data that would be expensive to regenerate (requires re-running ASR/diarization)
//! in `SQLite` files organized by podcast ID at `~/.polsearch/archive/{podcast_id}/raw_data.sqlite`

mod error;
mod store;

pub use error::ArchiveError;
pub use store::{ArchiveStore, DiarizationSegmentRaw, TranscriptSegmentRaw};
