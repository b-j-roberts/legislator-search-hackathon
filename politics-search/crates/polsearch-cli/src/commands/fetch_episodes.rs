//! Fetch episodes from RSS feeds for all podcasts

use std::sync::Arc;

use chrono::Utc;
use color_eyre::eyre::{Result, eyre};
use colored::Colorize;
use feed_rs::model::{Entry, Feed};
use feed_rs::parser;
use futures::stream::{self, StreamExt};
use polsearch_core::{Content, Source};
use polsearch_db::Database;
use tokio::sync::Semaphore;
use tracing::{debug, warn};
use uuid::Uuid;

use super::get_database;

const CONCURRENCY_LIMIT: usize = 10;

/// Result of fetching episodes for a single podcast
#[derive(Debug)]
pub struct FetchResult {
    pub podcast_name: String,
    pub rss_url: String,
    pub new_episodes: i32,
    pub skipped: i32,
    pub error: Option<String>,
}

impl FetchResult {
    const fn success(
        podcast_name: String,
        rss_url: String,
        new_episodes: i32,
        skipped: i32,
    ) -> Self {
        Self {
            podcast_name,
            rss_url,
            new_episodes,
            skipped,
            error: None,
        }
    }

    const fn error(podcast_name: String, rss_url: String, error: String) -> Self {
        Self {
            podcast_name,
            rss_url,
            new_episodes: 0,
            skipped: 0,
            error: Some(error),
        }
    }
}

/// Fetches episodes from RSS feeds
pub struct FeedFetcher {
    db: Database,
    client: reqwest::Client,
    semaphore: Arc<Semaphore>,
}

impl FeedFetcher {
    /// Creates a new `FeedFetcher`
    ///
    /// # Errors
    ///
    /// Returns error if HTTP client creation fails
    pub fn new(db: Database) -> Result<Self> {
        let client = reqwest::Client::builder()
            .user_agent("PolSearch/0.1")
            .timeout(std::time::Duration::from_secs(30))
            .build()?;

        Ok(Self {
            db,
            client,
            semaphore: Arc::new(Semaphore::new(CONCURRENCY_LIMIT)),
        })
    }

    /// Fetch episodes for all podcasts concurrently
    pub async fn fetch_all(&self) -> Result<Vec<FetchResult>> {
        let podcasts = self.db.podcasts().get_all().await?;
        println!(
            "{} {} podcasts",
            "Fetching episodes for".cyan(),
            podcasts.len().to_string().cyan().bold()
        );

        let results: Vec<FetchResult> = stream::iter(podcasts)
            .map(|podcast| self.fetch_podcast(podcast))
            .buffer_unordered(CONCURRENCY_LIMIT)
            .collect()
            .await;

        Ok(results)
    }

    /// Fetch episodes for a single podcast
    async fn fetch_podcast(&self, podcast: Source) -> FetchResult {
        let rss_url = podcast.url.clone();

        let Ok(_permit) = self.semaphore.acquire().await else {
            return FetchResult::error(podcast.name, rss_url, "semaphore closed".to_string());
        };

        debug!("Fetching feed for: {}", podcast.name);

        // get latest published_at for this podcast
        let latest_published = match self.db.episodes().get_latest_published_at(podcast.id).await {
            Ok(dt) => dt,
            Err(e) => {
                return FetchResult::error(podcast.name, rss_url, format!("DB error: {e}"));
            }
        };

        // fetch RSS feed
        let feed_bytes = match self.fetch_feed(&podcast.url).await {
            Ok(bytes) => bytes,
            Err(e) => {
                return FetchResult::error(podcast.name, rss_url, format!("Fetch error: {e}"));
            }
        };

        // parse feed
        let feed = match Self::parse_feed(&feed_bytes) {
            Ok(feed) => feed,
            Err(e) => {
                return FetchResult::error(podcast.name, rss_url, format!("Parse error: {e}"));
            }
        };

        // process entries
        let mut new_episodes = 0;
        let mut skipped = 0;

        for entry in &feed.entries {
            let Some(episode) = Self::episode_from_entry(podcast.id, entry) else {
                skipped += 1;
                continue;
            };

            // skip if older than our latest episode
            if let Some(latest) = latest_published {
                if episode.published_at <= latest {
                    skipped += 1;
                    continue;
                }
            }

            // insert episode
            if let Err(e) = self.db.episodes().create(&episode).await {
                warn!("Failed to insert episode '{}': {e}", episode.title);
                continue;
            }

            new_episodes += 1;
        }

        // update last fetched timestamp
        if new_episodes > 0 {
            let _ = self
                .db
                .podcasts()
                .update_last_fetched(podcast.id, Utc::now())
                .await;
        }

        println!(
            "{}: {} new, {} skipped",
            podcast.name.dimmed(),
            new_episodes,
            skipped
        );

        FetchResult::success(podcast.name, rss_url, new_episodes, skipped)
    }

    async fn fetch_feed(&self, url: &str) -> Result<Vec<u8>> {
        let response = self.client.get(url).send().await?;

        if !response.status().is_success() {
            return Err(eyre!("HTTP {}", response.status()));
        }

        let bytes = response.bytes().await?;
        Ok(bytes.to_vec())
    }

    fn parse_feed(bytes: &[u8]) -> Result<Feed> {
        parser::parse(bytes).map_err(|e| eyre!("{e}"))
    }

    fn episode_from_entry(source_id: Uuid, entry: &Entry) -> Option<Content> {
        // need at least a guid and an enclosure (audio file)
        let guid = entry.id.clone();

        let content_url = entry
            .media
            .iter()
            .flat_map(|m| &m.content)
            .find(|c| {
                c.content_type.as_ref().is_some_and(|ct| {
                    ct.subty() == "mpeg"
                        || ct.subty() == "mp3"
                        || ct.subty() == "m4a"
                        || ct.subty() == "mp4"
                })
            })
            .and_then(|c| c.url.as_ref())
            .map(ToString::to_string)
            .or_else(|| {
                // fallback to links with enclosure type
                entry
                    .links
                    .iter()
                    .find(|l| l.rel.as_deref() == Some("enclosure"))
                    .map(|l| l.href.clone())
            })?;

        let published_at = entry.published.or(entry.updated)?;

        let title = entry
            .title
            .as_ref()
            .map_or_else(|| "Untitled".to_string(), |t| t.content.clone());

        let description = entry
            .summary
            .as_ref()
            .map(|s| s.content.clone())
            .or_else(|| entry.content.as_ref().and_then(|c| c.body.clone()));

        let thumbnail_url = entry
            .media
            .iter()
            .flat_map(|m| &m.thumbnails)
            .next()
            .map(|t| t.image.uri.clone());

        let duration = entry
            .media
            .iter()
            .flat_map(|m| &m.content)
            .find_map(|c| c.duration)
            .and_then(|d| i32::try_from(d.as_secs()).ok());

        let mut episode = Content::new(source_id, guid, title, published_at, content_url);

        if let Some(desc) = description {
            episode = episode.with_description(desc);
        }

        if let Some(thumb) = thumbnail_url {
            episode = episode.with_thumbnail_url(thumb);
        }

        if let Some(dur) = duration {
            episode = episode.with_duration(dur);
        }

        Some(episode)
    }
}

pub async fn run() -> Result<()> {
    let db = get_database().await?;
    let fetcher = FeedFetcher::new(db)?;

    let results = fetcher.fetch_all().await?;

    let total_new: i32 = results.iter().map(|r| r.new_episodes).sum();
    let total_skipped: i32 = results.iter().map(|r| r.skipped).sum();
    let errors: Vec<_> = results.iter().filter(|r| r.error.is_some()).collect();

    println!(
        "{} {} new, {} skipped, {} failed",
        "Fetch complete:".green().bold(),
        total_new.to_string().cyan(),
        total_skipped,
        errors.len()
    );

    if !errors.is_empty() {
        for result in &errors {
            warn!(
                "{}: {}",
                result.podcast_name,
                result.error.as_deref().unwrap_or("")
            );
        }
        save_errors_to_file(&errors)?;
    }

    Ok(())
}

fn save_errors_to_file(errors: &[&FetchResult]) -> Result<()> {
    use std::fs;
    use std::io::Write;

    fs::create_dir_all("logs")?;

    let timestamp = Utc::now().format("%Y-%m-%d_%H-%M-%S");
    let filename = format!("logs/fetch_errors_{timestamp}.txt");

    let mut file = fs::File::create(&filename)?;

    writeln!(file, "RSS Feed Fetch Errors")?;
    writeln!(
        file,
        "Generated: {}",
        Utc::now().format("%Y-%m-%d %H:%M:%S UTC")
    )?;
    writeln!(file, "Total failures: {}", errors.len())?;
    writeln!(file)?;
    writeln!(file, "=")?;
    writeln!(file)?;

    for result in errors {
        writeln!(file, "Source: {}", result.podcast_name)?;
        writeln!(file, "RSS URL: {}", result.rss_url)?;
        writeln!(file, "Error: {}", result.error.as_deref().unwrap_or(""))?;
        writeln!(file)?;
        writeln!(file, "---")?;
        writeln!(file)?;
    }

    println!("{}", format!("Errors saved to: {filename}").dimmed());

    Ok(())
}
