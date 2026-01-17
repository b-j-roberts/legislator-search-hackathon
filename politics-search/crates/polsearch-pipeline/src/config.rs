//! Runtime configuration for the ingestion pipeline
//!
//! Uses figment2 for layered config with precedence:
//! `defaults → config/ingestion.yaml → env vars → CLI args`

use clap::{CommandFactory, Parser, error::ErrorKind};
use figment2::{
    Figment,
    providers::{Env, Format, Serialized, Yaml},
};
use serde::{Deserialize, Serialize};
use serde_inline_default::serde_inline_default;
use std::path::{Path, PathBuf};

/// Pipeline configuration - supports YAML file, env vars, and CLI args
///
/// Precedence: defaults < config file < env vars < CLI args
#[serde_inline_default]
#[derive(Parser, Debug, Clone, Serialize, Deserialize)]
#[command(author, version, about = "PolSearch ingestion pipeline")]
pub struct Config {
    /// Path to config file
    #[arg(short, long, default_value = "config/ingestion.yaml")]
    #[serde(skip)]
    pub config_path: PathBuf,

    // === Concurrency ===
    /// Max episodes processed in parallel
    #[arg(long, env = "PODSEARCH_MAX_CONCURRENT_EPISODES")]
    #[serde_inline_default(5)]
    pub max_concurrent_episodes: usize,

    /// `FluidAudio` semaphore permits (transcribe + diarize)
    #[arg(long, env = "PODSEARCH_FLUIDAUDIO_CONCURRENCY")]
    #[serde_inline_default(1)]
    pub fluidaudio_concurrency: usize,

    // === Audio handling ===
    /// Directory for downloaded audio files
    #[arg(long, env = "PODSEARCH_AUDIO_DIR")]
    #[serde_inline_default(PathBuf::from("./audio"))]
    pub audio_dir: PathBuf,

    /// Delete audio files after processing
    #[arg(long, env = "PODSEARCH_DELETE_AFTER_PROCESSING")]
    #[serde_inline_default(true)]
    pub delete_after_processing: bool,

    // === Storage ===
    /// `LanceDB` path (local or s3://)
    #[arg(long, env = "PODSEARCH_LANCEDB_PATH")]
    #[serde_inline_default(String::from("./data/lancedb"))]
    pub lancedb_path: String,

    /// Database URL
    #[arg(long, env = "DATABASE_URL")]
    pub database_url: Option<String>,
}

impl Config {
    /// Load config with layered precedence:
    /// defaults < YAML file < env vars < CLI args
    ///
    /// # Errors
    /// Returns an error if config parsing fails or validation errors occur
    pub fn load() -> color_eyre::Result<Self> {
        // first parse CLI to get config file path
        let cli = Self::parse();

        // build layered config
        let config: Self = Figment::new()
            .merge(Yaml::file(&cli.config_path)) // 1. config file
            .merge(Env::prefixed("PODSEARCH_")) // 2. env vars
            .merge(Serialized::defaults(cli)) // 3. CLI args (highest)
            .extract()?;

        config.validate();
        Ok(config)
    }

    /// Load config from a specific path (for testing or daemon command)
    ///
    /// # Errors
    /// Returns an error if config parsing fails or validation errors occur
    pub fn load_from(config_path: &Path) -> color_eyre::Result<Self> {
        let config: Self = Figment::new()
            .merge(Yaml::file(config_path))
            .merge(Env::prefixed("PODSEARCH_"))
            .extract()?;

        config.validate();
        Ok(config)
    }

    fn validate(&self) {
        if self.database_url.is_none() {
            let mut cmd = Self::command();
            cmd.error(
                ErrorKind::MissingRequiredArgument,
                "database_url is required (set via --database-url, DATABASE_URL env, or config file)",
            )
            .exit();
        }
    }

    // Convenience getters
    #[must_use]
    pub const fn max_concurrent_episodes(&self) -> usize {
        self.max_concurrent_episodes
    }

    #[must_use]
    pub const fn fluidaudio_concurrency(&self) -> usize {
        self.fluidaudio_concurrency
    }

    #[must_use]
    pub fn audio_dir(&self) -> &Path {
        &self.audio_dir
    }

    #[must_use]
    pub const fn delete_after_processing(&self) -> bool {
        self.delete_after_processing
    }

    #[must_use]
    pub fn lancedb_path(&self) -> &str {
        &self.lancedb_path
    }

    /// # Panics
    /// Panics if `database_url` is not configured via `DATABASE_URL` env or config file
    #[expect(clippy::expect_used)]
    #[must_use]
    pub fn database_url(&self) -> &str {
        self.database_url
            .as_deref()
            .expect("database_url is required - set via DATABASE_URL env or config file")
    }
}
