use chrono::NaiveDate;
use clap::{Parser, Subcommand};
use color_eyre::eyre::Result;
use media_common::{write_yaml, MediaAppearanceOutput, MemberLookup, SourceType};
use tracing::{info, Level};
use tracing_subscriber::FmtSubscriber;

mod api;
use api::YoutubeClient;

#[derive(Parser)]
#[command(name = "media-youtube")]
#[command(about = "Fetch legislator media appearances from YouTube")]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// YouTube Data API key (or set YOUTUBE_API_KEY env var)
    #[arg(long, env = "YOUTUBE_API_KEY", global = true)]
    api_key: Option<String>,
}

#[derive(Subcommand)]
enum Commands {
    /// Search YouTube for a specific member's appearances
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

        /// Maximum results per query
        #[arg(long, default_value = "25")]
        max_results: u32,

        /// Maximum pages to fetch
        #[arg(long, default_value = "2")]
        max_pages: u32,

        /// Output file path
        #[arg(short, long, default_value = "media_youtube.yaml")]
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

        /// Maximum results per query
        #[arg(long, default_value = "10")]
        max_results: u32,

        /// Maximum pages per member
        #[arg(long, default_value = "1")]
        max_pages: u32,

        /// Output file path
        #[arg(short, long, default_value = "media_youtube.yaml")]
        output: String,
    },

    /// Test the YouTube API with a sample search
    Test {
        /// Query to search for
        #[arg(short, long, default_value = "Chuck Schumer interview")]
        query: String,

        /// Number of results
        #[arg(short, long, default_value = "5")]
        max_results: u32,
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
        std::env::var("YOUTUBE_API_KEY").expect("YOUTUBE_API_KEY not set and --api-key not provided")
    });

    let client = YoutubeClient::new(api_key)?;

    match cli.command {
        Commands::Search {
            name,
            bioguide_id,
            start_date,
            end_date,
            max_results,
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

            let appearances = client.fetch_member_appearances(
                &name,
                &bioguide_id,
                start,
                end,
                max_results,
                max_pages,
            )?;

            let output_data = MediaAppearanceOutput::new(SourceType::Youtube, appearances);
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

            let mut all_appearances = Vec::new();

            for member in members.all_members() {
                match client.fetch_member_appearances(
                    &member.name,
                    &member.bioguide_id,
                    start,
                    end,
                    max_results,
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

            let output_data = MediaAppearanceOutput::new(SourceType::Youtube, all_appearances);
            write_yaml(&output_data, &output)?;

            info!(
                "Wrote {} appearances to {}",
                output_data.metadata.total_appearances, output
            );
        }

        Commands::Test { query, max_results } => {
            let response = client.search(&query, max_results, None, None, None)?;

            info!(
                "Found {} results",
                response.page_info.map_or(0, |p| p.total_results)
            );

            for item in response.items.iter().take(5) {
                println!("\n{}", item.snippet.title);
                if let Some(video_id) = &item.id.video_id {
                    println!("  URL: https://www.youtube.com/watch?v={}", video_id);
                }
                println!("  Channel: {}", item.snippet.channel_title);
                println!("  Published: {}", item.snippet.published_at);
            }
        }
    }

    Ok(())
}
