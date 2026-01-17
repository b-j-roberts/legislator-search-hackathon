//! Repository implementations

mod content;
mod content_speaker;
mod source;
mod segment;
mod speaker;
mod transcription_batch;
mod transcription_task;

pub use content::ContentRepo;
pub use content_speaker::ContentSpeakerRepo;
pub use source::SourceRepo;
pub use segment::SegmentRepo;
pub use speaker::SpeakerRepo;
pub use transcription_batch::TranscriptionBatchRepo;
pub use transcription_task::TranscriptionTaskRepo;

// Backward compatibility aliases
pub type PodcastRepo<'a> = SourceRepo<'a>;
pub type EpisodeRepo<'a> = ContentRepo<'a>;
pub type EpisodeSpeakerRepo<'a> = ContentSpeakerRepo<'a>;
