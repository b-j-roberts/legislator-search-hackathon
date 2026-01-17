use chrono::NaiveDate;
use clap::{Parser, Subcommand};
use color_eyre::eyre::Result;
use media_common::{write_yaml, MediaAppearanceOutput, MemberLookup, SourceType};
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

mod api;
use api::CspanClient;

#[derive(Parser)]
#[command(name = "media-cspan")]
#[command(about = "Fetch legislator media appearances from C-SPAN")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Search C-SPAN for a specific member's appearances
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
        #[arg(long, default_value = "10")]
        max_pages: u32,

        /// Output file path
        #[arg(short, long, default_value = "media_cspan.yaml")]
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
        #[arg(long, default_value = "5")]
        max_pages: u32,

        /// Output file path
        #[arg(short, long, default_value = "media_cspan.yaml")]
        output: String,
    },

    /// Test the C-SPAN API with a sample search
    Test {
        /// Query to search for
        #[arg(short, long, default_value = "Schumer")]
        query: String,
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

            let client = CspanClient::new()?;
            let appearances =
                client.fetch_member_appearances(&name, &bioguide_id, start, end, max_pages)?;

            let output_data = MediaAppearanceOutput::new(SourceType::Cspan, appearances);
            write_yaml(&output_data, &output)?;

            info!("Wrote {} appearances to {}", output_data.metadata.total_appearances, output);
        }

        Commands::FetchAll {
            legislators,
            start_date,
            end_date,
            max_pages,
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

            let client = CspanClient::new()?;
            let mut all_appearances = Vec::new();

            for member in members.all_members() {
                match client.fetch_member_appearances(
                    &member.name,
                    &member.bioguide_id,
                    start,
                    end,
                    max_pages,
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

            let output_data = MediaAppearanceOutput::new(SourceType::Cspan, all_appearances);
            write_yaml(&output_data, &output)?;

            info!("Wrote {} appearances to {}", output_data.metadata.total_appearances, output);
        }

        Commands::Test { query } => {
            let client = CspanClient::new()?;
            let response = client.search(&query, 1)?;

            info!("Found {} total results", response.total_results.unwrap_or(0));

            for video in response.videos.iter().take(5) {
                println!("\n{} ({})", video.title, video.date);
                println!("  ID: {}", video.id);
                if let Some(desc) = &video.description {
                    println!("  Description: {}", desc.chars().take(100).collect::<String>());
                }
            }
        }
    }

    Ok(())
}
