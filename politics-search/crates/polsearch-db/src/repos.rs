//! Repository implementations

mod amendment;
mod bill;
mod committee;
mod content;
mod content_speaker;
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
mod transcription_batch;
mod transcription_task;

pub use amendment::AmendmentRepo;
pub use bill::BillRepo;
pub use committee::CommitteeRepo;
pub use content::ContentRepo;
pub use content_speaker::ContentSpeakerRepo;
pub use floor_speech::{FloorSpeechMetadata, FloorSpeechRepo};
pub use floor_speech_segment::FloorSpeechSegmentRepo;
pub use floor_speech_statement::FloorSpeechStatementRepo;
pub use hearing::{HearingMetadata, HearingRepo};
pub use hearing_segment::HearingSegmentRepo;
pub use hearing_statement::HearingStatementRepo;
pub use individual_vote::IndividualVoteRepo;
pub use legislator::LegislatorRepo;
pub use nomination::NominationRepo;
pub use roll_call_vote::RollCallVoteRepo;
pub use segment::SegmentRepo;
pub use source::SourceRepo;
pub use speaker::SpeakerRepo;
pub use transcription_batch::TranscriptionBatchRepo;
pub use transcription_task::TranscriptionTaskRepo;

// Backward compatibility aliases
pub type PodcastRepo<'a> = SourceRepo<'a>;
pub type EpisodeRepo<'a> = ContentRepo<'a>;
pub type EpisodeSpeakerRepo<'a> = ContentSpeakerRepo<'a>;
