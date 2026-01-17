//! Domain models

mod content;
mod content_speaker;
mod content_variant;
mod segment;
mod source;
mod speaker;
mod speaker_alias;
mod transcription;

pub use content::Content;
pub use content_speaker::ContentSpeaker;
pub use content_variant::{ContentVariant, VariantType};
pub use segment::Segment;
pub use source::{Source, SourceType};
pub use speaker::Speaker;
pub use speaker_alias::SpeakerAlias;
pub use transcription::{BatchStatus, TaskStatus, TranscriptionBatch, TranscriptionTask};

// Re-export old names as aliases for gradual migration
pub type Podcast = Source;
pub type Episode = Content;
pub type EpisodeSpeaker = ContentSpeaker;
