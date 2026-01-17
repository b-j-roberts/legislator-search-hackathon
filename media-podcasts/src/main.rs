use chrono::NaiveDate;
use clap::{Parser, Subcommand};
use color_eyre::eyre::Result;
use media_common::{write_yaml, MediaAppearanceOutput, MemberLookup, SourceType};
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

mod api;
use api::PodcastClient;

#[derive(Parser)]
#[command(name = "media-podcasts")]
#[command(about = "Fetch legislator podcast appearances from Listen Notes")]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Listen Notes API key (or set LISTEN_NOTES_API_KEY env var)
    #[arg(long, env = "LISTEN_NOTES_API_KEY", global = true)]
    api_key: Option<String>,
}

#[derive(Subcommand)]
enum Commands {
    /// Search for a specific member's podcast appearances
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

        /// Maximum results to fetch
        #[arg(long, default_value = "50")]
        max_results: u32,

        /// Output file path
        #[arg(short, long, default_value = "media_podcasts.yaml")]
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
        #[arg(long, default_value = "20")]
        max_results: u32,

        /// Output file path
        #[arg(short, long, default_value = "media_podcasts.yaml")]
        output: String,
    },

    /// Test the Listen Notes API with a sample search
    Test {
        /// Query to search for
        #[arg(short, long, default_value = "Chuck Schumer")]
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

    // get API key from args or env
    let api_key = cli.api_key.unwrap_or_else(|| {
        std::env::var("LISTEN_NOTES_API_KEY")
            .expect("LISTEN_NOTES_API_KEY not set and --api-key not provided")
    });

    let client = PodcastClient::new(api_key)?;

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

            let appearances = client.fetch_member_appearances(
                &name,
                &bioguide_id,
                start,
                end,
                max_results,
            )?;

            let output_data = MediaAppearanceOutput::new(SourceType::Podcast, appearances);
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

            let output_data = MediaAppearanceOutput::new(SourceType::Podcast, all_appearances);
            write_yaml(&output_data, &output)?;

            info!(
                "Wrote {} appearances to {}",
                output_data.metadata.total_appearances, output
            );
        }

        Commands::Test { query } => {
            let response = client.search_episodes(&query, 0, None, None)?;

            info!("Found {} total results", response.total);

            for episode in response.results.iter().take(5) {
                println!("\n{}", episode.title_original);
                println!("  Podcast: {}", episode.podcast.title_original);
                println!("  ID: {}", episode.id);
                if let Some(url) = &episode.listen_notes_url {
                    println!("  URL: {}", url);
                }
                if let Some(desc) = &episode.description_original {
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
