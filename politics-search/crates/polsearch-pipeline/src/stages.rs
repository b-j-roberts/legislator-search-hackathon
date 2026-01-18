//! Pipeline stages for content processing
//!
//! Each stage is a module that handles one step of the pipeline:
//! - download: Fetch audio from URL
//! - embed: Generate text embeddings
//! - chunk: Split long text into embeddable segments
//! - `ingest_hearings`: Parse and ingest congressional hearing transcripts
//! - `ingest_floor_speeches`: Parse and ingest Congressional Record floor speeches
//! - `ingest_fts`: Fast text-only ingestion for FTS (no embeddings)
//! - `procedural_filter`: Filter low-value procedural statements
//! - `crec_parser`: Parse CREC HTML documents

pub mod chunk;
pub mod crec_parser;
pub mod download;
pub mod embed;
pub mod ingest_floor_speeches;
pub mod ingest_fts;
pub mod ingest_hearings;
pub mod procedural_filter;

pub use chunk::TextChunker;
pub use crec_parser::{parse_crec_html, parse_crec_text, CrecStatement};
pub use download::download_audio;
pub use embed::TextEmbedder;
pub use ingest_floor_speeches::{FloorSpeechIngester, FloorSpeechIngestStats, FloorSpeechJson};
pub use ingest_fts::{FtsIngester, FtsIngestStats, FTS_TABLE_NAME};
pub use ingest_hearings::{HearingIngester, IngestStats, TranscriptJson};
pub use procedural_filter::{is_procedural_crec_title, should_skip_statement};
