use clap::{Parser, Subcommand, ValueEnum};
use color_eyre::eyre::Result;
use tracing_subscriber::EnvFilter;

mod cli;
mod commands;

#[derive(Parser)]
#[command(name = "polsearch")]
#[command(about = "Political content transcription and search CLI")]
#[command(version)]
#[command(styles = cli::get_styles())]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Print version information
    Version,

    /// Load podcasts from YAML into the database
    Seed,

    /// Fetch episodes from RSS feeds for all podcasts
    FetchContent,

    /// List all podcasts with episode counts
    ListSources,

    /// Create a transcription batch for episodes
    TranscribePlan {
        /// Single month (e.g., 2026-01)
        #[arg(long)]
        month: Option<String>,

        /// Entire year (e.g., 2026)
        #[arg(long)]
        year: Option<i32>,

        /// Start of date range (e.g., 2024-06)
        #[arg(long)]
        from: Option<String>,

        /// End of date range (e.g., 2025-01)
        #[arg(long)]
        to: Option<String>,

        /// Filter to a specific podcast by slug
        #[arg(long)]
        podcast: Option<String>,

        /// Batch priority (higher = processed first)
        #[arg(long, default_value = "0")]
        priority: i32,
    },

    /// Show global progress and active batches
    Status,

    /// Show transcription statistics
    Stats {
        /// Filter to a specific podcast by slug
        #[arg(long)]
        podcast: Option<String>,

        /// Start of date range (e.g., 2024-06)
        #[arg(long)]
        from: Option<String>,

        /// End of date range (e.g., 2025-01)
        #[arg(long)]
        to: Option<String>,

        /// Show per-podcast breakdown
        #[arg(long)]
        detailed: bool,
    },

    /// Backfill missing data for transcribed episodes
    Backfill {
        #[command(subcommand)]
        command: BackfillCommands,
    },

    /// Merge duplicate speakers
    MergeSpeakers {
        /// Speaker ID to merge from
        #[arg(long)]
        from: String,

        /// Speaker ID to merge into
        #[arg(long)]
        into: String,
    },

    /// List and inspect speakers
    Speakers {
        #[command(subcommand)]
        command: SpeakersCommands,
    },

    /// Inspect `LanceDB` tables
    Db {
        #[command(subcommand)]
        command: DbCommands,

        /// `LanceDB` storage path
        #[arg(long, default_value = "~/.polsearch/lancedb", global = true)]
        lancedb_path: String,
    },

    /// Verify transcribed episodes have complete data in Postgres and `LanceDB`
    Verify {
        /// Filter to a specific podcast by slug
        #[arg(long)]
        podcast: Option<String>,

        /// Filter to a specific month (e.g., 2024-06)
        #[arg(long)]
        month: Option<String>,

        /// Maximum number of episodes to check
        #[arg(long)]
        limit: Option<usize>,

        /// `LanceDB` storage path
        #[arg(long, default_value = "~/.polsearch/lancedb")]
        lancedb_path: String,
    },

    /// Search transcribed podcast content
    Search {
        /// Search query
        query: String,

        /// Number of results to return
        #[arg(long, default_value = "10")]
        limit: usize,

        /// Number of results to skip (for pagination)
        #[arg(long, default_value = "0")]
        offset: usize,

        /// Group results by podcast and episode
        #[arg(long)]
        group: bool,

        /// Search mode
        #[arg(long, value_enum, default_value = "hybrid")]
        mode: SearchMode,

        /// Filter by podcast slug (fuzzy match supported)
        #[arg(long)]
        podcast: Option<String>,

        /// Start of date range (e.g., 2024-06)
        #[arg(long)]
        from: Option<String>,

        /// End of date range (e.g., 2025-01)
        #[arg(long)]
        to: Option<String>,

        /// Filter by speaker slug
        #[arg(long)]
        speaker: Option<String>,

        /// `LanceDB` storage path
        #[arg(long, default_value = "~/.polsearch/lancedb")]
        lancedb_path: String,

        /// Output format
        #[arg(long, short = 'f', default_value = "text")]
        format: OutputFormat,

        /// Include N segments before and after each match for context (RAG mode)
        #[arg(long, default_value = "0")]
        context: usize,
    },
}

/// Search mode for text embeddings
#[derive(Clone, Copy, Debug, ValueEnum)]
pub enum SearchMode {
    /// Combines vector semantic search + full-text search
    Hybrid,
    /// Semantic similarity search using embeddings
    Vector,
    /// Keyword-based full-text search (matches any terms)
    Fts,
    /// Exact phrase matching (matches the exact phrase)
    Phrase,
}

/// Output format for search results
#[derive(Clone, Copy, Debug, ValueEnum)]
pub enum OutputFormat {
    /// Human-readable text output (default)
    Text,
    /// JSON output for programmatic use
    Json,
}

#[derive(Subcommand)]
enum DbCommands {
    /// List all tables with row counts
    Tables,

    /// Show rows from a table
    Show {
        /// Table name (`text_embeddings`, `speaker_embeddings`, `speaker_centroids`)
        table: String,

        /// Number of rows to show
        #[arg(long, default_value = "10")]
        limit: usize,
    },

    /// Search text embeddings
    Search {
        /// Search query
        query: String,

        /// Number of results to return
        #[arg(long, default_value = "10")]
        limit: usize,

        /// Search mode: vector (semantic), fts (full-text), hybrid (both)
        #[arg(long, default_value = "vector")]
        mode: String,
    },

    /// Create FTS index on text column
    Index,
}

#[derive(Subcommand)]
enum SpeakersCommands {
    /// List all speakers with their podcast appearances
    List {
        /// Only show speakers with at least this many appearances
        #[arg(long)]
        min_appearances: Option<i32>,
    },
}

#[derive(Subcommand)]
enum BackfillCommands {
    /// Backfill speaker matching for already-transcribed episodes
    Speakers {
        /// `LanceDB` storage path (defaults to ~/.polsearch/lancedb)
        #[arg(long, default_value = "~/.polsearch/lancedb")]
        lancedb_path: String,
    },

    /// Backfill audio duration for transcribed episodes missing it
    Duration,

    /// Backfill batch status and counts from task data
    Batches,
}


#[tokio::main]
async fn main() -> Result<()> {
    color_eyre::install()?;
    dotenvy::dotenv().ok();

    // default to info level, but set lance file_audit to debug
    #[expect(clippy::expect_used)]
    let filter = EnvFilter::from_default_env().add_directive(
        "lance_io::utils::file_audit=debug"
            .parse()
            .expect("valid directive"),
    );

    tracing_subscriber::fmt().with_env_filter(filter).init();

    let cli = Cli::parse();

    match cli.command {
        Commands::Version => {
            println!("polsearch {}", env!("CARGO_PKG_VERSION"));
        }
        Commands::Seed => commands::seed::run().await?,
        Commands::FetchContent => commands::fetch_episodes::run().await?,
        Commands::ListSources => commands::list_podcasts::run().await?,
        Commands::TranscribePlan {
            month,
            year,
            from,
            to,
            podcast,
            priority,
        } => commands::transcribe_plan::run(month, year, from, to, podcast, priority).await?,
        Commands::Status => commands::status::run().await?,
        Commands::Stats {
            podcast,
            from,
            to,
            detailed,
        } => commands::stats::run(podcast, from, to, detailed).await?,
        Commands::Backfill { command } => match command {
            BackfillCommands::Speakers { lancedb_path } => {
                let expanded = shellexpand::tilde(&lancedb_path).to_string();
                commands::backfill_speakers::run(&expanded).await?;
            }
            BackfillCommands::Duration => {
                commands::backfill_duration::run().await?;
            }
            BackfillCommands::Batches => {
                commands::backfill_batches::run().await?;
            }
        },
        Commands::MergeSpeakers { from, into } => {
            commands::merge_speakers::run(&from, &into).await?;
        }
        Commands::Speakers { command } => match command {
            SpeakersCommands::List { min_appearances } => {
                commands::speakers::list(min_appearances).await?;
            }
        },
        Commands::Db {
            command,
            lancedb_path,
        } => {
            let expanded = shellexpand::tilde(&lancedb_path).to_string();
            match command {
                DbCommands::Tables => commands::db::tables(&expanded).await?,
                DbCommands::Show { table, limit } => {
                    commands::db::show(&expanded, &table, limit).await?;
                }
                DbCommands::Search { query, limit, mode } => {
                    commands::db::search(&expanded, &query, limit, &mode).await?;
                }
                DbCommands::Index => commands::db::create_fts_index(&expanded).await?,
            }
        }
        Commands::Verify {
            podcast,
            month,
            limit,
            lancedb_path,
        } => {
            let expanded = shellexpand::tilde(&lancedb_path).to_string();
            commands::verify::run(podcast, month, limit, &expanded).await?;
        }
        Commands::Search {
            query,
            limit,
            offset,
            group,
            mode,
            podcast,
            from,
            to,
            speaker,
            lancedb_path,
            format,
            context,
        } => {
            let expanded = shellexpand::tilde(&lancedb_path).to_string();
            commands::search::run(
                &query, limit, offset, group, mode, podcast, from, to, speaker, &expanded, format,
                context,
            )
            .await?;
        }
    }

    Ok(())
}
