use chrono::NaiveDate;
use eyre::{bail, Result};
use media_common::{
    generate_event_id, HttpClient, MediaAppearance, MediaInfo, Outlet, OutletType, SourceType,
};
use serde::Deserialize;
use tracing::{debug, info, warn};

const YOUTUBE_API_BASE: &str = "https://www.googleapis.com/youtube/v3";

/// YouTube Data API v3 client
pub struct YoutubeClient {
    http: HttpClient,
    api_key: String,
}

impl YoutubeClient {
    /// Create a new client with the given API key
    pub fn new(api_key: String) -> Result<Self> {
        if api_key.is_empty() {
            bail!("YouTube API key is required");
        }

        // youtube API is rate-limited, use 200ms between requests
        let http = HttpClient::with_config(200, 3, 30)?;
        Ok(Self { http, api_key })
    }

    /// Create a client from the YOUTUBE_API_KEY environment variable
    pub fn from_env() -> Result<Self> {
        let api_key = std::env::var("YOUTUBE_API_KEY")
            .map_err(|_| eyre::eyre!("YOUTUBE_API_KEY environment variable not set"))?;
        Self::new(api_key)
    }

    /// Search for videos matching a query
    pub fn search(
        &self,
        query: &str,
        max_results: u32,
        page_token: Option<&str>,
        published_after: Option<NaiveDate>,
        published_before: Option<NaiveDate>,
    ) -> Result<SearchResponse> {
        let mut url = format!(
            "{}/search?part=snippet&type=video&q={}&maxResults={}&key={}",
            YOUTUBE_API_BASE,
            urlencoding::encode(query),
            max_results,
            self.api_key
        );

        if let Some(token) = page_token {
            url.push_str(&format!("&pageToken={}", token));
        }

        if let Some(after) = published_after {
            url.push_str(&format!(
                "&publishedAfter={}T00:00:00Z",
                after.format("%Y-%m-%d")
            ));
        }

        if let Some(before) = published_before {
            url.push_str(&format!(
                "&publishedBefore={}T23:59:59Z",
                before.format("%Y-%m-%d")
            ));
        }

        // focus on news/politics content
        url.push_str("&relevanceLanguage=en&regionCode=US");

        debug!("YouTube search: {}", url.replace(&self.api_key, "[API_KEY]"));
        self.http.fetch_json(&url)
    }

    /// Get video details by ID(s)
    pub fn get_videos(&self, video_ids: &[&str]) -> Result<VideoListResponse> {
        let ids = video_ids.join(",");
        let url = format!(
            "{}/videos?part=snippet,contentDetails,statistics&id={}&key={}",
            YOUTUBE_API_BASE, ids, self.api_key
        );

        debug!("YouTube videos: {}", url.replace(&self.api_key, "[API_KEY]"));
        self.http.fetch_json(&url)
    }

    /// Get channel details by ID
    pub fn get_channel(&self, channel_id: &str) -> Result<ChannelListResponse> {
        let url = format!(
            "{}/channels?part=snippet&id={}&key={}",
            YOUTUBE_API_BASE, channel_id, self.api_key
        );

        debug!("YouTube channel: {}", url.replace(&self.api_key, "[API_KEY]"));
        self.http.fetch_json(&url)
    }

    /// Search for videos featuring a member and convert to MediaAppearances
    pub fn fetch_member_appearances(
        &self,
        member_name: &str,
        member_bioguide_id: &str,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
        max_results: u32,
        max_pages: u32,
    ) -> Result<Vec<MediaAppearance>> {
        let mut appearances = Vec::new();
        let mut page_token: Option<String> = None;
        let mut pages = 0;

        // search terms to find relevant political content
        let search_queries = [
            format!("{} interview", member_name),
            format!("{} congress", member_name),
            format!("{} hearing", member_name),
        ];

        info!("Searching YouTube for {}", member_name);

        for query in &search_queries {
            page_token = None;
            pages = 0;

            loop {
                let response = self.search(
                    query,
                    max_results.min(50), // YouTube max is 50 per page
                    page_token.as_deref(),
                    start_date,
                    end_date,
                )?;

                if response.items.is_empty() {
                    break;
                }

                // collect video IDs for batch details fetch
                let video_ids: Vec<&str> = response
                    .items
                    .iter()
                    .filter_map(|item| item.id.video_id.as_deref())
                    .collect();

                // get full video details
                let video_details = if !video_ids.is_empty() {
                    self.get_videos(&video_ids)?
                } else {
                    VideoListResponse { items: vec![] }
                };

                for video in video_details.items {
                    // parse date
                    let date = match parse_youtube_date(&video.snippet.published_at) {
                        Some(d) => d,
                        None => {
                            warn!("Failed to parse date: {}", video.snippet.published_at);
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

                    let video_url = format!("https://www.youtube.com/watch?v={}", video.id);

                    let mut media = MediaInfo::new().with_video(video_url);

                    // parse duration if available
                    if let Some(ref content_details) = video.content_details {
                        if let Some(secs) = parse_duration(&content_details.duration) {
                            media = media.with_duration(secs);
                        }
                    }

                    // determine outlet from channel
                    let channel_name = video.snippet.channel_title.clone();
                    let outlet_type = determine_outlet_type(&channel_name);
                    let outlet = Outlet::new(channel_name, outlet_type);

                    let event_id = generate_event_id(SourceType::Youtube, &video.id);

                    let mut appearance = MediaAppearance::new(
                        event_id,
                        date,
                        member_bioguide_id,
                        member_name,
                        SourceType::Youtube,
                        &video.snippet.title,
                        outlet,
                    );

                    appearance = appearance.with_media(media);

                    if !video.snippet.description.is_empty() {
                        // truncate long descriptions
                        let desc = if video.snippet.description.len() > 500 {
                            format!("{}...", &video.snippet.description[..500])
                        } else {
                            video.snippet.description.clone()
                        };
                        appearance = appearance.with_description(desc);
                    }

                    // extract topics from tags if available
                    if !video.snippet.tags.is_empty() {
                        appearance = appearance.with_topics(video.snippet.tags.clone());
                    }

                    appearances.push(appearance);
                }

                pages += 1;
                if pages >= max_pages {
                    break;
                }

                // get next page token
                page_token = response.next_page_token;
                if page_token.is_none() {
                    break;
                }
            }
        }

        // deduplicate by event_id
        appearances.sort_by(|a, b| a.event_id.cmp(&b.event_id));
        appearances.dedup_by(|a, b| a.event_id == b.event_id);

        // sort by date descending
        appearances.sort_by(|a, b| b.date.cmp(&a.date));

        info!(
            "Found {} YouTube videos for {}",
            appearances.len(),
            member_name
        );
        Ok(appearances)
    }
}

/// Parse YouTube ISO 8601 date format
fn parse_youtube_date(date_str: &str) -> Option<NaiveDate> {
    // format: 2024-01-15T10:30:00Z
    if date_str.len() >= 10 {
        NaiveDate::parse_from_str(&date_str[..10], "%Y-%m-%d").ok()
    } else {
        None
    }
}

/// Parse ISO 8601 duration (PT1H30M15S) to seconds
fn parse_duration(duration: &str) -> Option<u32> {
    let duration = duration.strip_prefix("PT")?;

    let mut total_seconds = 0u32;
    let mut current_num = String::new();

    for c in duration.chars() {
        if c.is_ascii_digit() {
            current_num.push(c);
        } else {
            let num: u32 = current_num.parse().ok()?;
            current_num.clear();

            match c {
                'H' => total_seconds += num * 3600,
                'M' => total_seconds += num * 60,
                'S' => total_seconds += num,
                _ => {}
            }
        }
    }

    Some(total_seconds)
}

/// Determine outlet type from channel name
fn determine_outlet_type(channel_name: &str) -> OutletType {
    let name_lower = channel_name.to_lowercase();

    if name_lower.contains("c-span") || name_lower.contains("cspan") {
        OutletType::Cspan
    } else if name_lower.contains("cnn")
        || name_lower.contains("msnbc")
        || name_lower.contains("fox news")
        || name_lower.contains("newsmax")
    {
        OutletType::Cable
    } else if name_lower.contains("abc")
        || name_lower.contains("cbs")
        || name_lower.contains("nbc")
        || name_lower.contains("pbs")
    {
        OutletType::NetworkTv
    } else if name_lower.contains("podcast") {
        OutletType::Podcast
    } else {
        OutletType::Youtube
    }
}

// API response types

#[derive(Debug, Deserialize)]
pub struct SearchResponse {
    #[serde(default)]
    pub items: Vec<SearchItem>,
    #[serde(rename = "nextPageToken")]
    pub next_page_token: Option<String>,
    #[serde(rename = "pageInfo")]
    pub page_info: Option<PageInfo>,
}

#[derive(Debug, Deserialize)]
pub struct SearchItem {
    pub id: SearchItemId,
    pub snippet: SearchSnippet,
}

#[derive(Debug, Deserialize)]
pub struct SearchItemId {
    #[serde(rename = "videoId")]
    pub video_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SearchSnippet {
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(rename = "publishedAt")]
    pub published_at: String,
    #[serde(rename = "channelTitle")]
    pub channel_title: String,
}

#[derive(Debug, Deserialize)]
pub struct PageInfo {
    #[serde(rename = "totalResults")]
    pub total_results: u32,
    #[serde(rename = "resultsPerPage")]
    pub results_per_page: u32,
}

#[derive(Debug, Deserialize)]
pub struct VideoListResponse {
    #[serde(default)]
    pub items: Vec<VideoItem>,
}

#[derive(Debug, Deserialize)]
pub struct VideoItem {
    pub id: String,
    pub snippet: VideoSnippet,
    #[serde(rename = "contentDetails")]
    pub content_details: Option<ContentDetails>,
    pub statistics: Option<VideoStatistics>,
}

#[derive(Debug, Deserialize)]
pub struct VideoSnippet {
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(rename = "publishedAt")]
    pub published_at: String,
    #[serde(rename = "channelId")]
    pub channel_id: String,
    #[serde(rename = "channelTitle")]
    pub channel_title: String,
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct ContentDetails {
    pub duration: String,
}

#[derive(Debug, Deserialize)]
pub struct VideoStatistics {
    #[serde(rename = "viewCount")]
    pub view_count: Option<String>,
    #[serde(rename = "likeCount")]
    pub like_count: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ChannelListResponse {
    #[serde(default)]
    pub items: Vec<ChannelItem>,
}

#[derive(Debug, Deserialize)]
pub struct ChannelItem {
    pub id: String,
    pub snippet: ChannelSnippet,
}

#[derive(Debug, Deserialize)]
pub struct ChannelSnippet {
    pub title: String,
    #[serde(default)]
    pub description: String,
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
