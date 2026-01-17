use chrono::NaiveDate;
use eyre::{Context, Result};
use media_common::{
    generate_event_id, HttpClient, MediaAppearance, MediaInfo, Outlet, OutletType, SourceType,
};
use serde::Deserialize;
use tracing::{debug, info, warn};

const TV_NEWS_SEARCH_BASE: &str = "https://archive.org/advancedsearch.php";
const TV_NEWS_DETAILS_BASE: &str = "https://archive.org/details";
const TV_NEWS_DOWNLOAD_BASE: &str = "https://archive.org/download";

/// Networks to search in the TV News Archive
pub const NEWS_NETWORKS: &[&str] = &[
    "CNN",
    "CNNW",
    "FOXNEWSW",
    "MSNBCW",
    "BBCNEWS",
    "CSPAN",
    "CSPAN2",
    "CSPAN3",
    "KQED",
    "KPBS",
    "WETA",
    "WNET",
    "WHUT",
    "WGBH",
];

/// Internet Archive TV News client
pub struct TvArchiveClient {
    http: HttpClient,
}

impl TvArchiveClient {
    pub fn new() -> Result<Self> {
        // archive.org is fairly permissive, use 300ms between requests
        let http = HttpClient::with_config(300, 3, 60)?;
        Ok(Self { http })
    }

    /// Search TV News archive for clips mentioning a person
    pub fn search_tv_news(
        &self,
        query: &str,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
        rows: u32,
        page: u32,
    ) -> Result<SearchResponse> {
        // build the query for TV News collection
        let mut q_parts = vec![
            format!("\"{}\"", query),
            "mediatype:movies".to_string(),
            "collection:tvnews OR collection:TV".to_string(),
        ];

        // add date filter if provided
        if let (Some(start), Some(end)) = (start_date, end_date) {
            q_parts.push(format!(
                "date:[{} TO {}]",
                start.format("%Y-%m-%d"),
                end.format("%Y-%m-%d")
            ));
        } else if let Some(start) = start_date {
            q_parts.push(format!("date:[{} TO *]", start.format("%Y-%m-%d")));
        } else if let Some(end) = end_date {
            q_parts.push(format!("date:[* TO {}]", end.format("%Y-%m-%d")));
        }

        let q = q_parts.join(" AND ");
        let start_offset = (page - 1) * rows;

        let url = format!(
            "{}?q={}&fl[]=identifier&fl[]=title&fl[]=description&fl[]=date&fl[]=creator&fl[]=runtime&output=json&rows={}&start={}",
            TV_NEWS_SEARCH_BASE,
            urlencoding::encode(&q),
            rows,
            start_offset
        );

        debug!("Searching TV Archive: {}", url);
        self.http.fetch_json(&url)
    }

    /// Get metadata for a specific item
    pub fn get_metadata(&self, identifier: &str) -> Result<ItemMetadata> {
        let url = format!(
            "https://archive.org/metadata/{}",
            urlencoding::encode(identifier)
        );
        debug!("Fetching metadata: {}", url);
        self.http.fetch_json(&url)
    }

    /// Download closed caption file (SRT or VTT) and convert to plain text
    pub fn get_transcript(&self, identifier: &str) -> Result<Option<String>> {
        // get metadata to find caption files
        let metadata = self.get_metadata(identifier)?;

        // look for caption files (srt, vtt, or txt)
        let caption_file = metadata
            .files
            .iter()
            .find(|f| {
                let name = f.name.to_lowercase();
                name.ends_with(".srt")
                    || name.ends_with(".vtt")
                    || name.ends_with(".cc5.txt")
                    || name.ends_with(".cc.txt")
            })
            .map(|f| f.name.clone());

        let Some(caption_filename) = caption_file else {
            return Ok(None);
        };

        let url = format!(
            "{}/{}/{}",
            TV_NEWS_DOWNLOAD_BASE,
            urlencoding::encode(identifier),
            urlencoding::encode(&caption_filename)
        );

        debug!("Fetching transcript: {}", url);
        let content = self.http.fetch_text(&url)?;

        // convert SRT/VTT to plain text
        Ok(Some(parse_caption_to_text(&content)))
    }

    /// Search and fetch all TV news clips for a member
    pub fn fetch_member_appearances(
        &self,
        member_name: &str,
        member_bioguide_id: &str,
        start_date: Option<NaiveDate>,
        end_date: Option<NaiveDate>,
        max_pages: u32,
        rows_per_page: u32,
    ) -> Result<Vec<MediaAppearance>> {
        let mut appearances = Vec::new();

        info!("Searching TV Archive for {}", member_name);

        for page in 1..=max_pages {
            let response =
                self.search_tv_news(member_name, start_date, end_date, rows_per_page, page)?;

            let docs = response.response.docs;
            if docs.is_empty() {
                break;
            }

            info!(
                "Page {}: found {} clips (total: {})",
                page,
                docs.len(),
                response.response.num_found
            );

            for doc in docs {
                // parse date
                let date = match parse_archive_date(&doc.date) {
                    Some(d) => d,
                    None => {
                        warn!("Failed to parse date: {}", doc.date);
                        continue;
                    }
                };

                // determine outlet from identifier or creator
                let (outlet_name, outlet_type) = determine_outlet(&doc.identifier, doc.creator.as_deref());

                // try to fetch transcript
                let transcript = match self.get_transcript(&doc.identifier) {
                    Ok(t) => t,
                    Err(e) => {
                        debug!("No transcript for {}: {}", doc.identifier, e);
                        None
                    }
                };

                let video_url = format!("{}/{}", TV_NEWS_DETAILS_BASE, doc.identifier);
                let mut media = MediaInfo::new().with_video(video_url);

                if let Some(runtime) = doc.runtime {
                    if let Some(secs) = parse_runtime(&runtime) {
                        media = media.with_duration(secs);
                    }
                }

                if let Some(ref text) = transcript {
                    media = media.with_transcript(text.clone());
                }

                let outlet = Outlet::new(outlet_name, outlet_type);
                let event_id = generate_event_id(SourceType::TvArchive, &doc.identifier);

                let mut appearance = MediaAppearance::new(
                    event_id,
                    date,
                    member_bioguide_id,
                    member_name,
                    SourceType::TvArchive,
                    &doc.title,
                    outlet,
                );

                appearance = appearance.with_media(media);

                if let Some(desc) = doc.description {
                    appearance = appearance.with_description(desc);
                }

                appearances.push(appearance);
            }

            // check if we've fetched all results
            let total_fetched = page * rows_per_page;
            if total_fetched >= response.response.num_found {
                break;
            }
        }

        info!(
            "Found {} TV Archive clips for {}",
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

/// Parse archive date format (YYYY-MM-DD or YYYYMMDD)
fn parse_archive_date(date_str: &str) -> Option<NaiveDate> {
    // try YYYY-MM-DD first
    if let Ok(d) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        return Some(d);
    }
    // try YYYYMMDD
    if let Ok(d) = NaiveDate::parse_from_str(date_str, "%Y%m%d") {
        return Some(d);
    }
    // try to extract just the date portion if there's a time
    if date_str.len() >= 10 {
        if let Ok(d) = NaiveDate::parse_from_str(&date_str[..10], "%Y-%m-%d") {
            return Some(d);
        }
    }
    None
}

/// Parse runtime string to seconds (formats: "HH:MM:SS", "MM:SS", "123" seconds)
fn parse_runtime(runtime: &str) -> Option<u32> {
    let parts: Vec<&str> = runtime.split(':').collect();
    match parts.len() {
        1 => parts[0].parse().ok(),
        2 => {
            let mins: u32 = parts[0].parse().ok()?;
            let secs: u32 = parts[1].parse().ok()?;
            Some(mins * 60 + secs)
        }
        3 => {
            let hours: u32 = parts[0].parse().ok()?;
            let mins: u32 = parts[1].parse().ok()?;
            let secs: u32 = parts[2].parse().ok()?;
            Some(hours * 3600 + mins * 60 + secs)
        }
        _ => None,
    }
}

/// Determine outlet name and type from identifier
fn determine_outlet(identifier: &str, creator: Option<&str>) -> (String, OutletType) {
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
    if id_upper.contains("NBC") || id_upper.contains("WNBC") {
        return ("NBC".to_string(), OutletType::NetworkTv);
    }
    if id_upper.contains("PBS") || id_upper.contains("KQED") || id_upper.contains("WETA") {
        return ("PBS".to_string(), OutletType::NetworkTv);
    }

    // fall back to creator field
    if let Some(c) = creator {
        return (c.to_string(), OutletType::Cable);
    }

    ("Unknown".to_string(), OutletType::Cable)
}

/// Convert SRT/VTT caption format to plain text
fn parse_caption_to_text(content: &str) -> String {
    let mut text_lines = Vec::new();
    let mut in_cue = false;

    for line in content.lines() {
        let trimmed = line.trim();

        // skip empty lines, timing lines, and cue identifiers
        if trimmed.is_empty() {
            in_cue = false;
            continue;
        }

        // skip WEBVTT header
        if trimmed.starts_with("WEBVTT") {
            continue;
        }

        // skip numeric cue identifiers (SRT format)
        if trimmed.chars().all(|c| c.is_ascii_digit()) {
            continue;
        }

        // skip timing lines (contain --> or timestamps)
        if trimmed.contains("-->") {
            in_cue = true;
            continue;
        }

        // skip timestamp-only lines
        if trimmed.starts_with("00:") || trimmed.starts_with("01:") || trimmed.starts_with("02:") {
            continue;
        }

        // skip style/note lines
        if trimmed.starts_with("NOTE") || trimmed.starts_with("STYLE") {
            continue;
        }

        // this should be actual caption text
        if in_cue || !trimmed.is_empty() {
            // remove HTML-style tags
            let cleaned = strip_tags(trimmed);
            if !cleaned.is_empty() {
                text_lines.push(cleaned);
            }
        }
    }

    // join lines and clean up
    let result = text_lines.join(" ");

    // collapse multiple spaces
    result.split_whitespace().collect::<Vec<_>>().join(" ")
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

// API response types

#[derive(Debug, Deserialize)]
pub struct SearchResponse {
    pub response: SearchResponseInner,
}

#[derive(Debug, Deserialize)]
pub struct SearchResponseInner {
    #[serde(rename = "numFound")]
    pub num_found: u32,
    pub docs: Vec<SearchDoc>,
}

#[derive(Debug, Deserialize)]
pub struct SearchDoc {
    pub identifier: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub date: String,
    #[serde(default)]
    pub creator: Option<String>,
    #[serde(default)]
    pub runtime: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ItemMetadata {
    #[serde(default)]
    pub files: Vec<FileEntry>,
    #[serde(default)]
    pub metadata: MetadataInner,
}

#[derive(Debug, Deserialize, Default)]
pub struct MetadataInner {
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct FileEntry {
    pub name: String,
    #[serde(default)]
    pub format: Option<String>,
    #[serde(default)]
    pub size: Option<String>,
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
