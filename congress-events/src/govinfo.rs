//! GovInfo API client for fetching Congressional Record (floor speeches)

use crate::models::{Chamber, FloorSpeech};
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
