//! GovInfo API client for fetching Congressional Record (floor speeches) and Hearings (CHRG)

use crate::models::{Chamber, FloorSpeech, Hearing};
use eyre::{Context, Result};
use serde::{Deserialize, Serialize};
use std::thread;
use std::time::Duration;

const GOVINFO_BASE_URL: &str = "https://api.govinfo.gov";
const RATE_LIMIT_DELAY_MS: u64 = 100;

pub struct GovInfoClient {
    api_key: String,
    client: reqwest::blocking::Client,
}

// Search API request/response structs
#[derive(Serialize)]
struct SearchRequest {
    query: String,
    #[serde(rename = "pageSize")]
    page_size: u32,
    #[serde(rename = "offsetMark")]
    offset_mark: String,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct SearchResponse {
    results: Option<Vec<SearchResult>>,
    count: Option<u32>,
    #[serde(rename = "offsetMark")]
    offset_mark: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct SearchResult {
    title: Option<String>,
    #[serde(rename = "packageId")]
    package_id: Option<String>,
    #[serde(rename = "granuleId")]
    granule_id: Option<String>,
    #[serde(rename = "dateIssued")]
    date_issued: Option<String>,
    #[serde(rename = "collectionCode")]
    collection_code: Option<String>,
}

impl GovInfoClient {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            client: reqwest::blocking::Client::builder()
                .timeout(Duration::from_secs(60))
                .build()
                .expect("Failed to create HTTP client"),
        }
    }

    /// Search CREC collection for granules in a date range using the search API
    fn search_crec(&self, start_date: &str, end_date: &str) -> Result<Vec<SearchResult>> {
        let mut all_results = Vec::new();
        let query = format!(
            "collection:CREC AND publishdate:range({},{})",
            start_date, end_date
        );

        let mut offset_mark = "*".to_string();

        eprintln!("Searching CREC for {} to {}...", start_date, end_date);

        loop {
            thread::sleep(Duration::from_millis(RATE_LIMIT_DELAY_MS));

            let request = SearchRequest {
                query: query.clone(),
                page_size: 1000,
                offset_mark: offset_mark.clone(),
            };

            let url = format!("{}/search?api_key={}", GOVINFO_BASE_URL, self.api_key);
            let response = self
                .client
                .post(&url)
                .json(&request)
                .send()
                .wrap_err("Failed to search CREC")?;

            if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
                eprintln!("Rate limited, waiting 60s...");
                thread::sleep(Duration::from_secs(60));
                continue;
            }

            let status = response.status();
            if !status.is_success() {
                let body = response.text().unwrap_or_default();
                eyre::bail!("HTTP {} for search: {}", status, body);
            }

            let search_response: SearchResponse = response.json()?;

            if let Some(results) = search_response.results {
                let count = results.len();
                all_results.extend(results);
                eprint!("\r  Fetched {} granules...", all_results.len());

                // If we got fewer results than page size, we're done
                if count < 1000 {
                    break;
                }
            } else {
                break;
            }

            // Use the offsetMark from response for next page
            match search_response.offset_mark {
                Some(next_offset) if !next_offset.is_empty() && next_offset != offset_mark => {
                    offset_mark = next_offset;
                }
                _ => break,
            }
        }

        eprintln!();
        eprintln!("  Total granules found: {}", all_results.len());
        Ok(all_results)
    }

    /// Fetch all floor speeches from CREC collection for a date range
    pub fn fetch_floor_speeches(
        &self,
        start_date: &str,
        end_date: &str,
        progress_callback: impl Fn(usize, usize),
    ) -> Result<Vec<FloorSpeech>> {
        let results = self.search_crec(start_date, end_date)?;
        let total = results.len();
        let mut speeches = Vec::new();

        for (i, result) in results.into_iter().enumerate() {
            if i % 100 == 0 {
                progress_callback(i + 1, total);
            }

            let package_id = match result.package_id {
                Some(id) => id,
                None => continue,
            };

            let granule_id = match result.granule_id {
                Some(id) => id,
                None => continue,
            };

            // Filter by granule ID pattern for floor speech types
            if !is_floor_speech_by_id(&granule_id) {
                continue;
            }

            let date = extract_date_from_package_id(&package_id);
            let chamber = extract_chamber_from_id(&granule_id);

            let transcript_url = Some(format!(
                "https://www.govinfo.gov/app/details/{}/{}",
                package_id, granule_id
            ));

            speeches.push(FloorSpeech {
                event_id: format!("{}-{}", package_id, granule_id),
                date,
                chamber,
                title: result.title.unwrap_or_else(|| "Untitled".to_string()),
                transcript: transcript_url,
                video: None,
                granule_id: Some(granule_id),
            });
        }

        Ok(speeches)
    }

    /// Search CHRG collection for hearings in a date range using the search API
    fn search_chrg(&self, start_date: &str, end_date: &str) -> Result<Vec<SearchResult>> {
        let mut all_results = Vec::new();
        let query = format!(
            "collection:CHRG AND publishdate:range({},{})",
            start_date, end_date
        );

        let mut offset_mark = "*".to_string();

        eprintln!("Searching CHRG for {} to {}...", start_date, end_date);

        loop {
            thread::sleep(Duration::from_millis(RATE_LIMIT_DELAY_MS));

            let request = SearchRequest {
                query: query.clone(),
                page_size: 1000,
                offset_mark: offset_mark.clone(),
            };

            let url = format!("{}/search?api_key={}", GOVINFO_BASE_URL, self.api_key);
            let response = self
                .client
                .post(&url)
                .json(&request)
                .send()
                .wrap_err("Failed to search CHRG")?;

            if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
                eprintln!("Rate limited, waiting 60s...");
                thread::sleep(Duration::from_secs(60));
                continue;
            }

            let status = response.status();
            if !status.is_success() {
                let body = response.text().unwrap_or_default();
                eyre::bail!("HTTP {} for search: {}", status, body);
            }

            let search_response: SearchResponse = response.json()?;

            if let Some(results) = search_response.results {
                let count = results.len();
                all_results.extend(results);
                eprint!("\r  Fetched {} packages...", all_results.len());

                if count < 1000 {
                    break;
                }
            } else {
                break;
            }

            match search_response.offset_mark {
                Some(next_offset) if !next_offset.is_empty() && next_offset != offset_mark => {
                    offset_mark = next_offset;
                }
                _ => break,
            }
        }

        eprintln!();
        eprintln!("  Total packages found: {}", all_results.len());
        Ok(all_results)
    }

    /// Fetch all hearings from CHRG collection for a date range
    pub fn fetch_hearings(
        &self,
        start_date: &str,
        end_date: &str,
        progress_callback: impl Fn(usize, usize),
    ) -> Result<Vec<Hearing>> {
        let results = self.search_chrg(start_date, end_date)?;
        let total = results.len();
        let mut hearings = Vec::new();

        for (i, result) in results.into_iter().enumerate() {
            if i % 100 == 0 {
                progress_callback(i + 1, total);
            }

            let package_id = match result.package_id {
                Some(id) => id,
                None => continue,
            };

            // CHRG package IDs don't always have granules at the search level
            let granule_id = result.granule_id;

            let date = result
                .date_issued
                .unwrap_or_else(|| "unknown".to_string());
            let chamber = extract_chamber_from_chrg_id(&package_id);
            let congress = extract_congress_from_package_id(&package_id);

            let transcript_url = match &granule_id {
                Some(gid) => format!(
                    "https://www.govinfo.gov/app/details/{}/{}",
                    package_id, gid
                ),
                None => format!("https://www.govinfo.gov/app/details/{}", package_id),
            };

            let event_id = match &granule_id {
                Some(gid) => format!("{}-{}", package_id, gid),
                None => package_id.clone(),
            };

            hearings.push(Hearing {
                event_id,
                date,
                chamber,
                committee: None,
                title: result.title.unwrap_or_else(|| "Untitled".to_string()),
                transcript: Some(transcript_url),
                video: None,
                congress,
            });
        }

        Ok(hearings)
    }
}

fn is_floor_speech_by_id(granule_id: &str) -> bool {
    // Granule ID patterns: CREC-2024-01-01-pt1-PgS123 (Senate), PgH456 (House), PgE789 (Extensions)
    granule_id.contains("-PgS") || granule_id.contains("-PgH") || granule_id.contains("-PgE") || granule_id.contains("-PgD")
}

fn extract_date_from_package_id(package_id: &str) -> String {
    // Package ID format: CREC-YYYY-MM-DD
    if package_id.starts_with("CREC-") && package_id.len() >= 15 {
        package_id[5..15].to_string()
    } else {
        "unknown".to_string()
    }
}

fn extract_chamber_from_id(granule_id: &str) -> Chamber {
    if granule_id.contains("-PgS") {
        Chamber::Senate
    } else if granule_id.contains("-PgH") {
        Chamber::House
    } else {
        Chamber::Unknown
    }
}

/// Extract congress number from CHRG package ID
/// Format: CHRG-{congress}{chamber}hrg{number} (e.g., CHRG-119hhrg12345)
fn extract_congress_from_package_id(package_id: &str) -> Option<u32> {
    if !package_id.starts_with("CHRG-") {
        return None;
    }

    let rest = &package_id[5..];
    // Find where the digits end (congress number)
    let congress_end = rest.find(|c: char| !c.is_ascii_digit()).unwrap_or(rest.len());
    if congress_end == 0 {
        return None;
    }

    rest[..congress_end].parse().ok()
}

/// Extract chamber from CHRG package ID
/// Format: CHRG-{congress}{chamber}hrg{number}
/// Chamber codes: h = House, s = Senate, j = Joint
fn extract_chamber_from_chrg_id(package_id: &str) -> Chamber {
    if !package_id.starts_with("CHRG-") {
        return Chamber::Unknown;
    }

    let rest = &package_id[5..];
    // Skip congress number digits
    let congress_end = rest.find(|c: char| !c.is_ascii_digit()).unwrap_or(rest.len());
    if congress_end >= rest.len() {
        return Chamber::Unknown;
    }

    match rest.chars().nth(congress_end) {
        Some('h') => Chamber::House,
        Some('s') => Chamber::Senate,
        Some('j') => Chamber::Joint,
        _ => Chamber::Unknown,
    }
}
