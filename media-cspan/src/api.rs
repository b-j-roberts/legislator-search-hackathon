use chrono::NaiveDate;
use eyre::{Context, Result};
use media_common::{
    generate_event_id, HttpClient, MediaAppearance, MediaInfo, Outlet, OutletType, SourceType,
};
use serde::Deserialize;
use tracing::{debug, info, warn};

const CSPAN_API_BASE: &str = "https://www.c-span.org/api";
const CSPAN_VIDEO_BASE: &str = "https://www.c-span.org/video";

/// C-SPAN API client
pub struct CspanClient {
    http: HttpClient,
}

impl CspanClient {
    pub fn new() -> Result<Self> {
        // c-span API is rate-sensitive, use 500ms between requests
        let http = HttpClient::with_config(500, 3, 60)?;
        Ok(Self { http })
    }

    /// Search for videos matching a query
    pub fn search(&self, query: &str, page: u32) -> Result<SearchResponse> {
        let url = format!(
            "{}/search/?query={}&page={}&format=json",
            CSPAN_API_BASE,
            urlencoding::encode(query),
            page
        );

        debug!("Searching C-SPAN: {}", url);
        self.http.fetch_json(&url)
    }

    /// Search for videos by person name
    pub fn search_person(&self, name: &str, page: u32) -> Result<SearchResponse> {
        // c-span supports person: prefix for filtering by speaker/guest
        let query = format!("person:{}", name);
        self.search(&query, page)
    }

    /// Get details for a specific video
    pub fn get_video(&self, video_id: u64) -> Result<VideoDetail> {
        let url = format!("{}/{}?format=json", CSPAN_VIDEO_BASE, video_id);
        debug!("Fetching C-SPAN video: {}", url);
        self.http.fetch_json(&url)
    }

    /// Get transcript for a video (if available)
    pub fn get_transcript(&self, video_id: u64) -> Result<Option<String>> {
        let url = format!(
            "{}/{}?action=getTranscript&format=json",
            CSPAN_VIDEO_BASE, video_id
        );

        debug!("Fetching C-SPAN transcript: {}", url);

        match self.http.fetch_json::<TranscriptResponse>(&url) {
            Ok(resp) if !resp.transcript.is_empty() => Ok(Some(resp.transcript)),
            Ok(_) => Ok(None),
            Err(e) => {
                // transcripts may not exist for all videos
                debug!("No transcript available for video {}: {}", video_id, e);
                Ok(None)
            }
        }
    }

    /// Search for all videos featuring a member and convert to MediaAppearances
    pub fn fetch_member_appearances(
        &self,
        member_name: &str,
        member_bioguide_id: &str,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
        max_pages: u32,
    ) -> Result<Vec<MediaAppearance>> {
        let mut appearances = Vec::new();
        let mut page = 1;

        info!("Searching C-SPAN for {}", member_name);

        loop {
            let response = self.search_person(member_name, page)?;

            if response.videos.is_empty() {
                break;
            }

            for video in response.videos {
                // parse date
                let date = match NaiveDate::parse_from_str(&video.date, "%Y-%m-%d") {
                    Ok(d) => d,
                    Err(_) => {
                        warn!("Failed to parse date: {}", video.date);
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

                // fetch full details and transcript
                let transcript = match self.get_transcript(video.id) {
                    Ok(t) => t,
                    Err(e) => {
                        warn!("Failed to get transcript for video {}: {}", video.id, e);
                        None
                    }
                };

                let video_url = format!("{}/{}", CSPAN_VIDEO_BASE, video.id);

                let media = MediaInfo::new()
                    .with_video(video_url)
                    .with_duration(video.duration.unwrap_or(0));

                let media = if let Some(ref t) = transcript {
                    media.with_transcript(t.clone())
                } else {
                    media
                };

                let outlet = Outlet::new("C-SPAN", OutletType::Cspan);
                let event_id = generate_event_id(SourceType::Cspan, &video.id.to_string());

                let mut appearance = MediaAppearance::new(
                    event_id,
                    date,
                    member_bioguide_id,
                    member_name,
                    SourceType::Cspan,
                    &video.title,
                    outlet,
                );

                appearance = appearance.with_media(media);

                if let Some(desc) = video.description {
                    appearance = appearance.with_description(desc);
                }

                appearances.push(appearance);
            }

            page += 1;
            if page > max_pages {
                info!("Reached max pages limit ({})", max_pages);
                break;
            }

            // check if there are more pages
            if response.total_pages.map_or(true, |total| page > total) {
                break;
            }
        }

        info!(
            "Found {} C-SPAN appearances for {}",
            appearances.len(),
            member_name
        );
        Ok(appearances)
    }
}

impl Default for CspanClient {
    fn default() -> Self {
        Self::new().expect("failed to create C-SPAN client")
    }
}

// API response types

#[derive(Debug, Deserialize)]
pub struct SearchResponse {
    #[serde(default)]
    pub videos: Vec<VideoSummary>,
    #[serde(rename = "totalPages")]
    pub total_pages: Option<u32>,
    #[serde(rename = "totalResults")]
    pub total_results: Option<u32>,
}

#[derive(Debug, Deserialize)]
pub struct VideoSummary {
    pub id: u64,
    pub title: String,
    pub date: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub duration: Option<u32>,
    #[serde(default)]
    pub thumbnail: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct VideoDetail {
    pub id: u64,
    pub title: String,
    pub date: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub duration: Option<u32>,
    #[serde(default)]
    pub persons: Vec<Person>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(rename = "videoURL")]
    pub video_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct Person {
    pub name: String,
    #[serde(rename = "bioguideId")]
    pub bioguide_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct TranscriptResponse {
    #[serde(default)]
    pub transcript: String,
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
