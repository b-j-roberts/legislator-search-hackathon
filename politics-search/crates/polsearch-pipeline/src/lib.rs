//! `PolSearch` ingestion pipeline
//!
//! This crate provides pipeline stages that:
//! - Download podcast audio files
//! - Generate text embeddings (384-dim, fastembed)

pub mod config;
pub mod stages;

pub use config::Config;
