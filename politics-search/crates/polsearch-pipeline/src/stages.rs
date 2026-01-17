//! Pipeline stages for content processing
//!
//! Each stage is a module that handles one step of the pipeline:
//! - download: Fetch audio from URL
//! - embed: Generate text embeddings

pub mod download;
pub mod embed;

pub use download::download_audio;
pub use embed::TextEmbedder;
