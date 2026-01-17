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

        /// Maximum pages to fetch
        #[arg(long, default_value = "5")]
        max_pages: u32,

        /// Results per page
        #[arg(long, default_value = "50")]
        rows: u32,

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

        /// Maximum pages per member
        #[arg(long, default_value = "3")]
        max_pages: u32,

        /// Results per page
        #[arg(long, default_value = "20")]
        rows: u32,

        /// Output file path
        #[arg(short, long, default_value = "media_tv_archive.yaml")]
        output: String,
    },

    /// Test the TV Archive API with a sample search
    Test {
        /// Query to search for
        #[arg(short, long, default_value = "Chuck Schumer")]
        query: String,

        /// Number of results
        #[arg(short, long, default_value = "5")]
        rows: u32,
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
            max_pages,
            rows,
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
            let appearances = client.fetch_member_appearances(
                &name,
                &bioguide_id,
                start,
                end,
                max_pages,
                rows,
            )?;

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
            max_pages,
            rows,
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
                    max_pages,
                    rows,
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

        Commands::Test { query, rows } => {
            let client = TvArchiveClient::new()?;
            let response = client.search_tv_news(&query, None, None, rows, 1)?;

            info!("Found {} total results", response.response.num_found);

            for doc in response.response.docs.iter().take(5) {
                println!("\n{}", doc.title);
                println!("  ID: {}", doc.identifier);
                println!("  Date: {}", doc.date);
                if let Some(creator) = &doc.creator {
                    println!("  Network: {}", creator);
                }
                if let Some(desc) = &doc.description {
                    println!(
                        "  Description: {}...",
                        desc.chars().take(100).collect::<String>()
                    );
                }
            }
        }
    }

    Ok(())
}
