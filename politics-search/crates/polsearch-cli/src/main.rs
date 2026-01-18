use clap::{Parser, Subcommand, ValueEnum};
use color_eyre::eyre::Result;
use tracing_subscriber::EnvFilter;

mod cli;
mod commands;

/// Content type filter for search
#[derive(Clone, Copy, Debug, ValueEnum, PartialEq, Eq)]
pub enum ContentTypeFilter {
    /// All content types
    All,
    /// Congressional hearing transcripts only
    Hearing,
    /// Congressional Record floor speeches only
    FloorSpeech,
    /// Congressional vote records only
    Vote,
}

#[derive(Parser)]
#[command(name = "polsearch")]
#[command(about = "Political content search CLI")]
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

    /// Inspect `LanceDB` tables
    Db {
        #[command(subcommand)]
        command: DbCommands,

        /// `LanceDB` storage path
        #[arg(long, default_value = "~/.polsearch/lancedb", global = true)]
        lancedb_path: String,
    },

    /// Ingest congressional hearing transcripts
    IngestHearings {
        /// Directory with transcript JSON files
        #[arg(long, default_value = "data/transcripts")]
        path: String,

        /// Limit files to process (for testing)
        #[arg(long)]
        limit: Option<usize>,

        /// Force re-process even if hearing exists
        #[arg(long)]
        force: bool,

        /// Dry run - show what would be processed without making changes
        #[arg(long)]
        dry_run: bool,

        /// Validate JSON files without ingesting
        #[arg(long)]
        validate: bool,

        /// `LanceDB` storage path
        #[arg(long, default_value = "~/.polsearch/lancedb")]
        lancedb_path: String,
    },

    /// Fetch floor speech transcripts from `GovInfo`
    FetchFloorSpeeches {
        /// Year to fetch (e.g., 2024)
        #[arg(long)]
        year: i32,

        /// Output directory for JSON files
        #[arg(long, default_value = "data/floor_speech_transcripts")]
        output: String,

        /// Limit speeches to fetch (for testing)
        #[arg(long)]
        limit: Option<usize>,

        /// Force re-fetch existing files
        #[arg(long)]
        force: bool,

        /// Dry run - show what would be fetched without downloading
        #[arg(long)]
        dry_run: bool,
    },

    /// Ingest Congressional Record floor speech transcripts
    IngestFloorSpeeches {
        /// Directory with transcript JSON files
        #[arg(long, default_value = "data/floor_speech_transcripts")]
        path: String,

        /// Limit files to process (for testing)
        #[arg(long)]
        limit: Option<usize>,

        /// Force re-process even if speech exists
        #[arg(long)]
        force: bool,

        /// Dry run - show what would be processed without making changes
        #[arg(long)]
        dry_run: bool,

        /// Validate JSON files without ingesting
        #[arg(long)]
        validate: bool,

        /// `LanceDB` storage path
        #[arg(long, default_value = "~/.polsearch/lancedb")]
        lancedb_path: String,
    },

    /// List and manage committees
    Committees {
        #[command(subcommand)]
        command: CommitteesCommands,
    },

    /// Ingest congressional vote data
    IngestVotes {
        /// Directory with vote data files
        #[arg(long, default_value = "data/votes")]
        path: String,

        /// Limit files to process (for testing)
        #[arg(long)]
        limit: Option<usize>,

        /// Force re-process even if vote exists
        #[arg(long)]
        force: bool,

        /// Dry run - show what would be processed without making changes
        #[arg(long)]
        dry_run: bool,
    },

    /// Embed vote data for semantic search
    EmbedVotes {
        /// Limit votes to embed (for testing)
        #[arg(long)]
        limit: Option<usize>,

        /// Force re-embed even if already embedded
        #[arg(long)]
        force: bool,

        /// Dry run - show what would be embedded without making changes
        #[arg(long)]
        dry_run: bool,

        /// `LanceDB` storage path
        #[arg(long, default_value = "~/.polsearch/lancedb")]
        lancedb_path: String,
    },

    /// Find hearings missing transcripts by comparing YAML to existing transcripts
    MissingHearings {
        /// Path to Congress.gov hearings YAML file
        #[arg(long)]
        yaml: String,

        /// Directory with existing transcript JSON files
        #[arg(long, default_value = "data/transcripts")]
        transcripts: String,

        /// Output file (stdout if not specified)
        #[arg(long)]
        output: Option<String>,

        /// Filter to specific congress (116, 117, 118, 119)
        #[arg(long)]
        congress: Option<i16>,

        /// Filter to specific chamber (house, senate)
        #[arg(long)]
        chamber: Option<String>,
    },

    /// Search congressional content
    Search {
        /// Search query
        query: String,

        /// Number of results to return
        #[arg(long, default_value = "10")]
        limit: usize,

        /// Number of results to skip (for pagination)
        #[arg(long, default_value = "0")]
        offset: usize,

        /// Group results by source
        #[arg(long)]
        group: bool,

        /// Search mode
        #[arg(long, value_enum, default_value = "hybrid")]
        mode: SearchMode,

        /// Filter by content type (comma-separated: all, hearing, floor_speech)
        #[arg(long, default_value = "all", value_delimiter = ',')]
        r#type: Vec<ContentTypeFilter>,

        /// Start of date range (e.g., 2024-06)
        #[arg(long)]
        from: Option<String>,

        /// End of date range (e.g., 2025-01)
        #[arg(long)]
        to: Option<String>,

        /// Filter by speaker name
        #[arg(long)]
        speaker: Option<String>,

        /// Filter by committee (hearings only, fuzzy match)
        #[arg(long)]
        committee: Option<String>,

        /// Filter by chamber: house, senate
        #[arg(long)]
        chamber: Option<String>,

        /// Filter by congress number
        #[arg(long)]
        congress: Option<i16>,

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
enum CommitteesCommands {
    /// List all committees
    List {
        /// Filter by chamber (house, senate)
        #[arg(long)]
        chamber: Option<String>,

        /// Show hearing counts
        #[arg(long, default_value = "true")]
        counts: bool,
    },

    /// Search committees by name
    Search {
        /// Search query
        query: String,
    },
}

#[tokio::main]
async fn main() -> Result<()> {
    color_eyre::install()?;
    dotenvy::dotenv().ok();

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
        Commands::IngestHearings {
            path,
            limit,
            force,
            dry_run,
            validate,
            lancedb_path,
        } => {
            let expanded = shellexpand::tilde(&lancedb_path).to_string();
            commands::ingest_hearings::run(&path, limit, force, dry_run, validate, &expanded)
                .await?;
        }
        Commands::FetchFloorSpeeches {
            year,
            output,
            limit,
            force,
            dry_run,
        } => {
            commands::fetch_floor_speeches::run(year, &output, limit, force, dry_run).await?;
        }
        Commands::IngestFloorSpeeches {
            path,
            limit,
            force,
            dry_run,
            validate,
            lancedb_path,
        } => {
            let expanded = shellexpand::tilde(&lancedb_path).to_string();
            commands::ingest_floor_speeches::run(&path, limit, force, dry_run, validate, &expanded)
                .await?;
        }
        Commands::Committees { command } => match command {
            CommitteesCommands::List { chamber, counts } => {
                commands::committees::list(chamber, counts).await?;
            }
            CommitteesCommands::Search { query } => {
                commands::committees::search(&query).await?;
            }
        },
        Commands::IngestVotes {
            path,
            limit,
            force,
            dry_run,
        } => {
            commands::ingest_votes::run(&path, limit, force, dry_run).await?;
        }
        Commands::EmbedVotes {
            limit,
            force,
            dry_run,
            lancedb_path,
        } => {
            let expanded = shellexpand::tilde(&lancedb_path).to_string();
            commands::embed_votes::run(limit, force, dry_run, &expanded).await?;
        }
        Commands::MissingHearings {
            yaml,
            transcripts,
            output,
            congress,
            chamber,
        } => {
            commands::missing_hearings::run(&yaml, &transcripts, output, congress, chamber).await?;
        }
        Commands::Search {
            query,
            limit,
            offset,
            group,
            mode,
            r#type,
            from,
            to,
            speaker,
            committee,
            chamber,
            congress,
            lancedb_path,
            format,
            context,
        } => {
            let expanded = shellexpand::tilde(&lancedb_path).to_string();
            commands::search::run(
                &query, limit, offset, group, mode, r#type, from, to, speaker, committee, chamber,
                congress, &expanded, format, context,
            )
            .await?;
        }
    }

    Ok(())
}
