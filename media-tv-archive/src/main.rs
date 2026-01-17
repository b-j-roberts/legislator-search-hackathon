use chrono::NaiveDate;
use clap::{Parser, Subcommand};
use color_eyre::eyre::Result;
use media_common::{write_yaml, MediaAppearanceOutput, MemberLookup, SourceType};
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

mod api;
use api::TvArchiveClient;

#[derive(Parser)]
#[command(name = "media-tv-archive")]
#[command(about = "Fetch legislator media appearances from Internet Archive TV News")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Search TV Archive for a specific member's appearances
    Search {
        /// Member name to search for
        #[arg(short, long)]
        name: String,

        /// Bioguide ID for the member
        #[arg(short, long)]
        bioguide_id: String,

        /// Start date (YYYY-MM-DD)
        #[arg(long)]
        start_date: Option<String>,

        /// End date (YYYY-MM-DD)
        #[arg(long)]
        end_date: Option<String>,

        /// Maximum results to return
        #[arg(long, default_value = "100")]
        max_results: u32,

        /// Output file path
        #[arg(short, long, default_value = "media_tv_archive.yaml")]
        output: String,
    },

    /// Fetch appearances for all members in a legislators file
    FetchAll {
        /// Path to legislators YAML file
        #[arg(short, long)]
        legislators: String,

        /// Start date (YYYY-MM-DD)
        #[arg(long)]
        start_date: Option<String>,

        /// End date (YYYY-MM-DD)
        #[arg(long)]
        end_date: Option<String>,

        /// Maximum results per member
        #[arg(long, default_value = "50")]
        max_results: u32,

        /// Output file path
        #[arg(short, long, default_value = "media_tv_archive.yaml")]
        output: String,
    },

    /// Test the TV Archive API with a sample search
    Test {
        /// Query to search for
        #[arg(short, long, default_value = "Chuck Schumer")]
        query: String,

        /// Number of results to display
        #[arg(short, long, default_value = "5")]
        limit: u32,
    },
}

fn main() -> Result<()> {
    color_eyre::install()?;

    let subscriber = FmtSubscriber::builder()
        .with_max_level(Level::INFO)
        .finish();
    tracing::subscriber::set_global_default(subscriber)?;

    let cli = Cli::parse();

    match cli.command {
        Commands::Search {
            name,
            bioguide_id,
            start_date,
            end_date,
            max_results,
            output,
        } => {
            let start = start_date
                .as_ref()
                .map(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d"))
                .transpose()?;

            let end = end_date
                .as_ref()
                .map(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d"))
                .transpose()?;

            let client = TvArchiveClient::new()?;
            let appearances =
                client.fetch_member_appearances(&name, &bioguide_id, start, end, max_results)?;

            let output_data = MediaAppearanceOutput::new(SourceType::TvArchive, appearances);
            write_yaml(&output_data, &output)?;

            info!(
                "Wrote {} appearances to {}",
                output_data.metadata.total_appearances, output
            );
        }

        Commands::FetchAll {
            legislators,
            start_date,
            end_date,
            max_results,
            output,
        } => {
            let start = start_date
                .as_ref()
                .map(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d"))
                .transpose()?;

            let end = end_date
                .as_ref()
                .map(|s| NaiveDate::parse_from_str(s, "%Y-%m-%d"))
                .transpose()?;

            let members = MemberLookup::from_legislators_yaml(&legislators, None)?;
            info!("Loaded {} members", members.len());

            let client = TvArchiveClient::new()?;
            let mut all_appearances = Vec::new();

            for member in members.all_members() {
                match client.fetch_member_appearances(
                    &member.name,
                    &member.bioguide_id,
                    start,
                    end,
                    max_results,
                ) {
                    Ok(appearances) => {
                        all_appearances.extend(appearances);
                    }
                    Err(e) => {
                        tracing::warn!("Failed to fetch appearances for {}: {}", member.name, e);
                    }
                }
            }

            // sort by date descending
            all_appearances.sort_by(|a, b| b.date.cmp(&a.date));

            let output_data = MediaAppearanceOutput::new(SourceType::TvArchive, all_appearances);
            write_yaml(&output_data, &output)?;

            info!(
                "Wrote {} appearances to {}",
                output_data.metadata.total_appearances, output
            );
        }

        Commands::Test { query, limit } => {
            let client = TvArchiveClient::new()?;
            let results = client.search_tv_news(&query)?;

            info!("Found {} total results", results.len());

            for result in results.iter().take(limit as usize) {
                println!("\n{}", result.title);
                println!("  ID: {}", result.identifier);
                if let Some(video) = &result.video {
                    println!("  Video: {}", video);
                }
                if let Some(snip) = &result.snip {
                    // strip HTML and truncate
                    let clean: String = snip
                        .chars()
                        .filter(|c| *c != '<' && *c != '>')
                        .take(150)
                        .collect();
                    println!("  Transcript: {}...", clean);
                }
                if let Some(topics) = &result.topic {
                    println!("  Topics: {}", topics.iter().take(5).cloned().collect::<Vec<_>>().join(", "));
                }
            }
        }
    }

    Ok(())
}
