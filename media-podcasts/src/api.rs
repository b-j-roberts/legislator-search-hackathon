use chrono::NaiveDate;
use eyre::{bail, Result};
use media_common::{
    generate_event_id, HttpClient, MediaAppearance, MediaInfo, Outlet, OutletType, SourceType,
};
use serde::Deserialize;
use tracing::{debug, info, warn};

const LISTEN_NOTES_API_BASE: &str = "https://listen-api.listennotes.com/api/v2";

/// Listen Notes API client for podcast search
pub struct PodcastClient {
    http: HttpClient,
    api_key: String,
}

impl PodcastClient {
    /// Create a new client with the given API key
    pub fn new(api_key: String) -> Result<Self> {
        if api_key.is_empty() {
            bail!("Listen Notes API key is required");
        }

        // Listen Notes has rate limits, use 500ms between requests
        // Free tier: 300 requests/month, so be conservative
        let http = HttpClient::with_config(500, 3, 30)?;
        Ok(Self { http, api_key })
    }

    /// Create a client from the LISTEN_NOTES_API_KEY environment variable
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("LISTEN_NOTES_API_KEY")
            .map_err(|_| eyre::eyre!("LISTEN_NOTES_API_KEY environment variable not set"))?;
        Self::new(api_key)
    }

    /// Search for podcast episodes
    pub fn search_episodes(
        &self,
        query: &str,
        offset: u32,
        published_after: Option<NaiveDate>,
        published_before: Option<NaiveDate>,
    ) -> Result<SearchResponse> {
        let mut url = format!(
            "{}/search?q={}&type=episode&offset={}&only_in=title,description&language=English",
            LISTEN_NOTES_API_BASE,
            urlencoding::encode(query),
            offset
        );

        // add date filters (Listen Notes uses Unix timestamps in milliseconds)
        if let Some(after) = published_after {
            let ts = after.and_hms_opt(0, 0, 0).map(|dt| dt.and_utc().timestamp_millis());
            if let Some(ts) = ts {
                url.push_str(&format!("&published_after={}", ts));
            }
        }

        if let Some(before) = published_before {
            let ts = before.and_hms_opt(23, 59, 59).map(|dt| dt.and_utc().timestamp_millis());
            if let Some(ts) = ts {
                url.push_str(&format!("&published_before={}", ts));
            }
        }

        debug!("Listen Notes search: {}", url);

        let response = reqwest::blocking::Client::new()
            .get(&url)
            .header("X-ListenAPI-Key", &self.api_key)
            .timeout(std::time::Duration::from_secs(30))
            .send()
            .map_err(|e| eyre::eyre!("HTTP request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(eyre::eyre!(
                "Listen Notes API error: {} - {}",
                response.status(),
                response.text().unwrap_or_default()
            ));
        }

        response
            .json()
            .map_err(|e| eyre::eyre!("Failed to parse response: {}", e))
    }

    /// Get podcast details by ID
    pub fn get_podcast(&self, podcast_id: &str) -> Result<PodcastDetail> {
        let url = format!("{}/podcasts/{}", LISTEN_NOTES_API_BASE, podcast_id);

        debug!("Listen Notes podcast: {}", url);

        let response = reqwest::blocking::Client::new()
            .get(&url)
            .header("X-ListenAPI-Key", &self.api_key)
            .timeout(std::time::Duration::from_secs(30))
            .send()
            .map_err(|e| eyre::eyre!("HTTP request failed: {}", e))?;

        if !response.status().is_success() {
            return Err(eyre::eyre!(
                "Listen Notes API error: {} - {}",
                response.status(),
                response.text().unwrap_or_default()
            ));
        }

        response
            .json()
            .map_err(|e| eyre::eyre!("Failed to parse response: {}", e))
    }

    /// Search and fetch podcast episodes featuring a member
    pub fn fetch_member_appearances(
        &self,
        member_name: &str,
        member_bioguide_id: &str,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
        max_results: u32,
    ) -> Result<Vec<MediaAppearance>> {
        let mut appearances = Vec::new();
        let mut offset = 0;
        let page_size = 10; // Listen Notes returns 10 per page by default

        // search terms for finding political podcast appearances
        let search_queries = [
            member_name.to_string(),
            format!("{} interview", member_name),
        ];

        info!("Searching Listen Notes for {}", member_name);

        for query in &search_queries {
            offset = 0;

            loop {
                let response = self.search_episodes(query, offset, start_date, end_date)?;

                if response.results.is_empty() {
                    break;
                }

                for episode in response.results {
                    // parse date from Unix timestamp (milliseconds)
                    let date = match timestamp_to_date(episode.pub_date_ms) {
                        Some(d) => d,
                        None => {
                            warn!("Failed to parse date: {}", episode.pub_date_ms);
                            continue;
                        }
                    };

                    // filter by date range
                    if let Some(start) = start_date {
                        if date < start {
                            continue;
                        }
                    }
                    if let Some(end) = end_date {
                        if date > end {
                            continue;
                        }
                    }

                    // check if this episode likely features our member
                    let title_lower = episode.title_original.to_lowercase();
                    let desc_lower = episode
                        .description_original
                        .as_deref()
                        .unwrap_or("")
                        .to_lowercase();
                    let name_lower = member_name.to_lowercase();
                    let last_name = member_name.split_whitespace().last().unwrap_or("").to_lowercase();

                    if !title_lower.contains(&name_lower)
                        && !title_lower.contains(&last_name)
                        && !desc_lower.contains(&name_lower)
                    {
                        continue;
                    }

                    let mut media = MediaInfo::new();

                    if let Some(audio) = &episode.audio {
                        media = media.with_audio(audio.clone());
                    }

                    if let Some(duration) = episode.audio_length_sec {
                        media = media.with_duration(duration);
                    }

                    let podcast_name = episode.podcast.title_original.clone();
                    let outlet = Outlet::new(podcast_name, OutletType::Podcast);

                    let event_id = generate_event_id(SourceType::Podcast, &episode.id);

                    let mut appearance = MediaAppearance::new(
                        event_id,
                        date,
                        member_bioguide_id,
                        member_name,
                        SourceType::Podcast,
                        &episode.title_original,
                        outlet,
                    );

                    appearance = appearance.with_media(media);

                    if let Some(desc) = episode.description_original {
                        // truncate long descriptions
                        let desc = if desc.len() > 500 {
                            format!("{}...", &desc[..500])
                        } else {
                            desc
                        };
                        appearance = appearance.with_description(desc);
                    }

                    appearances.push(appearance);
                }

                offset += page_size;

                // check if we've fetched enough or reached the end
                if offset >= max_results || offset >= response.total {
                    break;
                }

                // rate limit - Listen Notes has strict limits on free tier
                std::thread::sleep(std::time::Duration::from_millis(500));
            }
        }

        // deduplicate by event_id
        appearances.sort_by(|a, b| a.event_id.cmp(&b.event_id));
        appearances.dedup_by(|a, b| a.event_id == b.event_id);

        // sort by date descending
        appearances.sort_by(|a, b| b.date.cmp(&a.date));

        info!(
            "Found {} podcast appearances for {}",
            appearances.len(),
            member_name
        );
        Ok(appearances)
    }
}

/// Convert Unix timestamp (milliseconds) to NaiveDate
fn timestamp_to_date(ts_ms: i64) -> Option<NaiveDate> {
    chrono::DateTime::from_timestamp_millis(ts_ms).map(|dt| dt.date_naive())
}

// API response types

#[derive(Debug, Deserialize)]
pub struct SearchResponse {
    pub count: u32,
    pub total: u32,
    #[serde(default)]
    pub results: Vec<EpisodeResult>,
    pub next_offset: u32,
}

#[derive(Debug, Deserialize)]
pub struct EpisodeResult {
    pub id: String,
    pub title_original: String,
    pub description_original: Option<String>,
    pub pub_date_ms: i64,
    pub audio: Option<String>,
    pub audio_length_sec: Option<u32>,
    pub podcast: PodcastInfo,
    #[serde(rename = "listennotes_url")]
    pub listen_notes_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PodcastInfo {
    pub id: String,
    pub title_original: String,
    pub publisher_original: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct PodcastDetail {
    pub id: String,
    pub title: String,
    pub description: Option<String>,
    pub publisher: Option<String>,
    pub total_episodes: u32,
}

// URL encoding helper
mod urlencoding {
    pub fn encode(input: &str) -> String {
        let mut encoded = String::new();
        for byte in input.bytes() {
            match byte {
                b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                    encoded.push(byte as char);
                }
                b' ' => encoded.push('+'),
                _ => {
                    encoded.push('%');
                    encoded.push_str(&format!("{:02X}", byte));
                }
            }
        }
        encoded
    }
}
