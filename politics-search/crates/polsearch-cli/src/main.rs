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

    /// Manage congressional hearing data
    Hearings {
        #[command(subcommand)]
        command: HearingsCommands,
    },

    /// Manage floor speech data
    Speeches {
        #[command(subcommand)]
        command: SpeechesCommands,
    },

    /// Manage vote data
    Votes {
        #[command(subcommand)]
        command: VotesCommands,
    },

    /// List and manage committees
    Committees {
        #[command(subcommand)]
        command: CommitteesCommands,
    },

    /// Fast text-only ingestion for FTS (no embeddings)
    Fts {
        #[command(subcommand)]
        command: FtsCommands,

        /// `LanceDB` storage path
        #[arg(long, default_value = "~/.polsearch/lancedb", global = true)]
        lancedb_path: String,
    },

    /// Utility commands for deployment and data transfer
    Util {
        #[command(subcommand)]
        command: UtilCommands,
    },

    /// Create FTS indexes on all tables (`text_fts`, `text_embeddings`)
    Index {
        /// `LanceDB` storage path
        #[arg(long, default_value = "~/.polsearch/lancedb")]
        lancedb_path: String,
    },

    /// Ingest all content in priority order (newest first, hearings before speeches)
    IngestAll {
        /// Starting year (default: 2025)
        #[arg(long, default_value = "2025")]
        start_year: i32,

        /// Ending year (default: 2020)
        #[arg(long, default_value = "2020")]
        end_year: i32,

        /// Directory with hearing transcript JSON files
        #[arg(long, default_value = "data/transcripts")]
        hearings_path: String,

        /// Directory with floor speech JSON files
        #[arg(long, default_value = "data/floor_speech_transcripts")]
        speeches_path: String,

        /// Force re-process even if content exists
        #[arg(long)]
        force: bool,

        /// `LanceDB` storage path
        #[arg(long, default_value = "~/.polsearch/lancedb")]
        lancedb_path: String,
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

        /// Filter by content type (all, hearing, floor-speech, vote)
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

#[derive(Subcommand)]
enum HearingsCommands {
    /// Ingest congressional hearing transcripts
    Ingest {
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

        /// Filter to hearings from a specific year (e.g., 2025)
        #[arg(long)]
        year: Option<i32>,

        /// `LanceDB` storage path
        #[arg(long, default_value = "~/.polsearch/lancedb")]
        lancedb_path: String,
    },

    /// Find hearings missing transcripts
    Missing {
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
}

#[derive(Subcommand)]
enum SpeechesCommands {
    /// Fetch floor speech transcripts from `GovInfo`
    Fetch {
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

        /// Number of concurrent requests (default: 10)
        #[arg(long, default_value = "10")]
        concurrency: usize,
    },

    /// Ingest Congressional Record floor speech transcripts
    Ingest {
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

        /// Filter to speeches from a specific year (e.g., 2025)
        #[arg(long)]
        year: Option<i32>,

        /// `LanceDB` storage path
        #[arg(long, default_value = "~/.polsearch/lancedb")]
        lancedb_path: String,
    },
}

#[derive(Subcommand)]
enum VotesCommands {
    /// Ingest congressional vote data
    Ingest {
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
    Embed {
        /// Limit votes to embed (for testing)
        #[arg(long)]
        limit: Option<usize>,

        /// Force re-embed even if already embedded
        #[arg(long)]
        force: bool,

        /// Dry run - show what would be embedded without making changes
        #[arg(long)]
        dry_run: bool,

        /// Filter to votes from a specific year (e.g., 2025)
        #[arg(long)]
        year: Option<i32>,

        /// `LanceDB` storage path
        #[arg(long, default_value = "~/.polsearch/lancedb")]
        lancedb_path: String,
    },
}

#[derive(Subcommand)]
enum FtsCommands {
    /// Ingest text for FTS (no embeddings, fast)
    Ingest {
        /// Directory with hearing transcript JSON files
        #[arg(long)]
        hearings_path: Option<String>,

        /// Directory with floor speech JSON files
        #[arg(long)]
        speeches_path: Option<String>,

        /// Ingest votes from `PostgreSQL`
        #[arg(long)]
        votes: bool,

        /// Limit files to process (for testing)
        #[arg(long)]
        limit: Option<usize>,

        /// Force re-process even if content exists
        #[arg(long)]
        force: bool,

        /// Dry run - show what would be processed without making changes
        #[arg(long)]
        dry_run: bool,
    },

    /// Clear/delete the FTS table to start fresh
    Clear,
}

#[derive(Subcommand)]
enum UtilCommands {
    /// Create archive of data for transfer
    Archive {
        /// Paths to include in archive
        #[arg(long, num_args = 1..)]
        paths: Vec<String>,

        /// Output archive path
        #[arg(long, short)]
        output: String,
    },

    /// Push archive to remote server via rsync
    Push {
        /// Local archive path
        archive: String,

        /// Remote destination (user@host:path)
        #[arg(long, short)]
        remote: String,
    },

    /// Pull archive from remote server via rsync
    Pull {
        /// Remote source (user@host:path)
        remote: String,

        /// Local output path
        #[arg(long, short)]
        output: String,
    },

    /// Extract archive to destination
    Unarchive {
        /// Archive file path
        archive: String,

        /// Destination directory
        #[arg(long, short, default_value = ".")]
        dest: String,
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
            }
        }
        Commands::Hearings { command } => match command {
            HearingsCommands::Ingest {
                path,
                limit,
                force,
                dry_run,
                validate,
                year,
                lancedb_path,
            } => {
                let expanded = shellexpand::tilde(&lancedb_path).to_string();
                commands::ingest_hearings::run(&path, limit, force, dry_run, validate, year, &expanded)
                    .await?;
            }
            HearingsCommands::Missing {
                yaml,
                transcripts,
                output,
                congress,
                chamber,
            } => {
                commands::missing_hearings::run(&yaml, &transcripts, output, congress, chamber)
                    .await?;
            }
        },
        Commands::Speeches { command } => match command {
            SpeechesCommands::Fetch {
                year,
                output,
                limit,
                force,
                dry_run,
                concurrency,
            } => {
                commands::fetch_floor_speeches::run(year, &output, limit, force, dry_run, concurrency).await?;
            }
            SpeechesCommands::Ingest {
                path,
                limit,
                force,
                dry_run,
                validate,
                year,
                lancedb_path,
            } => {
                let expanded = shellexpand::tilde(&lancedb_path).to_string();
                commands::ingest_floor_speeches::run(
                    &path, limit, force, dry_run, validate, year, &expanded,
                )
                .await?;
            }
        },
        Commands::Votes { command } => match command {
            VotesCommands::Ingest {
                path,
                limit,
                force,
                dry_run,
            } => {
                commands::ingest_votes::run(&path, limit, force, dry_run).await?;
            }
            VotesCommands::Embed {
                limit,
                force,
                dry_run,
                year,
                lancedb_path,
            } => {
                let expanded = shellexpand::tilde(&lancedb_path).to_string();
                commands::embed_votes::run(limit, force, dry_run, year, &expanded).await?;
            }
        },
        Commands::Committees { command } => match command {
            CommitteesCommands::List { chamber, counts } => {
                commands::committees::list(chamber, counts).await?;
            }
            CommitteesCommands::Search { query } => {
                commands::committees::search(&query).await?;
            }
        },
        Commands::Fts {
            command,
            lancedb_path,
        } => {
            let expanded = shellexpand::tilde(&lancedb_path).to_string();
            match command {
                FtsCommands::Ingest {
                    hearings_path,
                    speeches_path,
                    votes,
                    limit,
                    force,
                    dry_run,
                } => {
                    commands::fts::ingest(
                        hearings_path.as_deref(),
                        speeches_path.as_deref(),
                        votes,
                        limit,
                        force,
                        dry_run,
                        &expanded,
                    )
                    .await?;
                }
                FtsCommands::Clear => {
                    commands::fts::clear(&expanded).await?;
                }
            }
        }
        Commands::Util { command } => match command {
            UtilCommands::Archive { paths, output } => {
                commands::util::archive(&paths, &output).await?;
            }
            UtilCommands::Push { archive, remote } => {
                commands::util::push(&archive, &remote).await?;
            }
            UtilCommands::Pull { remote, output } => {
                commands::util::pull(&remote, &output).await?;
            }
            UtilCommands::Unarchive { archive, dest } => {
                commands::util::unarchive(&archive, &dest).await?;
            }
        },
        Commands::Index { lancedb_path } => {
            let expanded = shellexpand::tilde(&lancedb_path).to_string();
            commands::index::run(&expanded).await?;
        }
        Commands::IngestAll {
            start_year,
            end_year,
            hearings_path,
            speeches_path,
            force,
            lancedb_path,
        } => {
            let expanded = shellexpand::tilde(&lancedb_path).to_string();
            commands::ingest_all::run(
                start_year,
                end_year,
                &hearings_path,
                &speeches_path,
                force,
                &expanded,
            )
            .await?;
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
