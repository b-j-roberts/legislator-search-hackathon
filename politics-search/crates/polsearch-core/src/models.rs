//! Domain models

mod amendment;
mod bill;
mod committee;
mod content;
mod content_speaker;
mod content_type;
mod content_variant;
mod floor_speech;
mod floor_speech_segment;
mod floor_speech_statement;
mod hearing;
mod hearing_segment;
mod hearing_statement;
mod individual_vote;
mod legislator;
mod nomination;
mod roll_call_vote;
mod segment;
mod source;
mod speaker;
mod speaker_alias;
mod transcription;

pub use amendment::Amendment;
pub use bill::Bill;
pub use committee::Committee;
pub use content::Content;
pub use content_speaker::ContentSpeaker;
pub use content_type::ContentType;
pub use content_variant::{ContentVariant, VariantType};
pub use floor_speech::FloorSpeech;
pub use floor_speech_segment::FloorSpeechSegment;
pub use floor_speech_statement::FloorSpeechStatement;
pub use hearing::Hearing;
pub use hearing_segment::HearingSegment;
pub use hearing_statement::HearingStatement;
pub use individual_vote::IndividualVote;
pub use legislator::Legislator;
pub use nomination::Nomination;
pub use roll_call_vote::RollCallVote;
pub use segment::Segment;
pub use source::{Source, SourceType};
pub use speaker::Speaker;
pub use speaker_alias::SpeakerAlias;
pub use transcription::{BatchStatus, TaskStatus, TranscriptionBatch, TranscriptionTask};

// Re-export old names as aliases for gradual migration
pub type Podcast = Source;
pub type Episode = Content;
pub type EpisodeSpeaker = ContentSpeaker;
