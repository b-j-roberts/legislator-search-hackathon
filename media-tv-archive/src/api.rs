use chrono::NaiveDate;
use eyre::Result;
use media_common::{
    generate_event_id, HttpClient, MediaAppearance, MediaInfo, Outlet, OutletType, SourceType,
};
use serde::Deserialize;
use tracing::{debug, info, warn};

const TV_NEWS_SEARCH_BASE: &str = "https://archive.org/details/tv";

/// Internet Archive TV News client
/// Uses the public transcript search API which returns snippets
pub struct TvArchiveClient {
    http: HttpClient,
}

impl TvArchiveClient {
    pub fn new() -> Result<Self> {
        // archive.org is fairly permissive, use 300ms between requests
        let http = HttpClient::with_config(300, 3, 60)?;
        Ok(Self { http })
    }

    /// Search TV News archive with transcript search
    /// Returns results with transcript snippets included
    pub fn search_tv_news(&self, query: &str) -> Result<Vec<TvSearchResult>> {
        let url = format!(
            "{}?q={}&output=json",
            TV_NEWS_SEARCH_BASE,
            urlencoding::encode(query)
        );

        debug!("Searching TV Archive: {}", url);
        self.http.fetch_json(&url)
    }

    /// Search and fetch all TV news clips for a member
    pub fn fetch_member_appearances(
        &self,
        member_name: &str,
        member_bioguide_id: &str,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
        max_results: u32,
    ) -> Result<Vec<MediaAppearance>> {
        let mut appearances = Vec::new();

        info!("Searching TV Archive for {}", member_name);

        // search with quoted name for exact match
        let query = format!("\"{}\"", member_name);
        let results = self.search_tv_news(&query)?;

        info!("Found {} TV Archive clips for {}", results.len(), member_name);

        for result in results.into_iter().take(max_results as usize) {
            // parse date from title (format: "Show Name : NETWORK : Month DD, YYYY HH:MMam-HH:MMpm TZ")
            let date = match extract_date_from_title(&result.title) {
                Some(d) => d,
                None => {
                    warn!("Failed to parse date from title: {}", result.title);
                    continue;
                }
            };

            // filter by date range
            if let Some(start) = start_date
                && date < start {
                    continue;
                }
            if let Some(end) = end_date
                && date > end {
                    continue;
                }

            // determine outlet from identifier or collection
            let (outlet_name, outlet_type) =
                determine_outlet(&result.identifier, result.collection.as_deref());

            // clean up the transcript snippet (remove HTML tags)
            let transcript_snippet = result.snip.as_ref().map(|s| strip_tags(s));

            // build video URL with timestamp
            let video_url = result.video.clone().unwrap_or_else(|| {
                format!("https://archive.org/details/{}", result.identifier)
            });

            let mut media = MediaInfo::new().with_video(&video_url);

            // add transcript snippet
            if let Some(ref snippet) = transcript_snippet
                && !snippet.is_empty() {
                    media = media.with_transcript(snippet.clone());
                }

            // calculate duration from start timestamp if available
            if let Some(start_sec) = result.start {
                // the video URL contains timestamp range, estimate ~60s clips
                media = media.with_duration(60);
                // store the actual start time in the URL
                let _ = start_sec; // used in video URL already
            }

            let outlet = Outlet::new(outlet_name, outlet_type);
            let event_id = generate_event_id(SourceType::TvArchive, &result.identifier);

            let mut appearance = MediaAppearance::new(
                event_id,
                date,
                member_bioguide_id,
                member_name,
                SourceType::TvArchive,
                &result.title,
                outlet,
            );

            appearance = appearance.with_media(media);

            // use transcript snippet as description if available
            if let Some(snippet) = transcript_snippet
                && !snippet.is_empty() {
                    appearance = appearance.with_description(snippet);
                }

            // add topics if available
            if let Some(topics) = result.topic {
                appearance = appearance.with_topics(topics);
            }

            appearances.push(appearance);
        }

        // sort by date descending
        appearances.sort_by(|a, b| b.date.cmp(&a.date));

        info!(
            "Returning {} appearances for {} (after filtering)",
            appearances.len(),
            member_name
        );
        Ok(appearances)
    }
}

impl Default for TvArchiveClient {
    fn default() -> Self {
        Self::new().expect("failed to create TV Archive client")
    }
}

/// Extract date from TV Archive title format
/// Example: "Meet the Press : NBC : January 15, 2024 9:00am-10:00am EST"
fn extract_date_from_title(title: &str) -> Option<NaiveDate> {
    // split by colon and look for date pattern
    let parts: Vec<&str> = title.split(':').collect();

    for part in parts {
        let trimmed = part.trim();
        // look for month names
        let months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ];

        for month in months {
            if trimmed.starts_with(month) {
                // try to parse "Month DD, YYYY"
                // extract just the date part before the time
                let date_part = trimmed.split_whitespace().take(3).collect::<Vec<_>>().join(" ");
                // remove trailing comma from day
                let date_part = date_part.replace(',', "");

                if let Ok(date) = NaiveDate::parse_from_str(&date_part, "%B %d %Y") {
                    return Some(date);
                }
            }
        }
    }

    None
}

/// Determine outlet name and type from identifier
fn determine_outlet(identifier: &str, collection: Option<&str>) -> (String, OutletType) {
    let id_upper = identifier.to_uppercase();

    // check identifier prefixes
    if id_upper.contains("CNN") {
        return ("CNN".to_string(), OutletType::Cable);
    }
    if id_upper.contains("FOXNEWS") || id_upper.contains("FNC") {
        return ("Fox News".to_string(), OutletType::Cable);
    }
    if id_upper.contains("MSNBC") {
        return ("MSNBC".to_string(), OutletType::Cable);
    }
    if id_upper.contains("CSPAN") {
        return ("C-SPAN".to_string(), OutletType::Cspan);
    }
    if id_upper.contains("BBC") {
        return ("BBC News".to_string(), OutletType::Cable);
    }
    if id_upper.contains("ABC") || id_upper.contains("WABC") {
        return ("ABC".to_string(), OutletType::NetworkTv);
    }
    if id_upper.contains("CBS") || id_upper.contains("WCBS") {
        return ("CBS".to_string(), OutletType::NetworkTv);
    }
    if id_upper.contains("NBC") || id_upper.contains("WNBC") || id_upper.contains("WBAL") {
        return ("NBC".to_string(), OutletType::NetworkTv);
    }
    if id_upper.contains("PBS")
        || id_upper.contains("KQED")
        || id_upper.contains("WETA")
        || id_upper.contains("WNET")
    {
        return ("PBS".to_string(), OutletType::NetworkTv);
    }

    // check collection
    if let Some(c) = collection {
        let c_upper = c.to_uppercase();
        if c_upper.contains("CSPAN") {
            return ("C-SPAN".to_string(), OutletType::Cspan);
        }
    }

    ("Unknown".to_string(), OutletType::Cable)
}

/// Remove HTML-style tags from text
fn strip_tags(text: &str) -> String {
    let mut result = String::new();
    let mut in_tag = false;

    for c in text.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => result.push(c),
            _ => {}
        }
    }

    result.trim().to_string()
}

// API response types for TV search endpoint

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct TvSearchResult {
    pub identifier: String,
    pub title: String,
    #[serde(default)]
    pub snip: Option<String>,
    #[serde(default)]
    pub video: Option<String>,
    #[serde(default)]
    pub topic: Option<Vec<String>>,
    #[serde(default)]
    pub start: Option<String>,
    #[serde(default)]
    pub collection: Option<String>,
    #[serde(default)]
    creator: Option<String>,
    #[serde(default)]
    downloads: Option<u32>,
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
