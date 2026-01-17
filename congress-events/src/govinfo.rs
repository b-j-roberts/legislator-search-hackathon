//! GovInfo API client for fetching Congressional Record (floor speeches)

use crate::models::{Chamber, FloorSpeech};
use eyre::{Context, Result};
use serde::Deserialize;
use std::thread;
use std::time::Duration;

const GOVINFO_BASE_URL: &str = "https://api.govinfo.gov";
const RATE_LIMIT_DELAY_MS: u64 = 200;

pub struct GovInfoClient {
    api_key: String,
    client: reqwest::blocking::Client,
}

// API response structs - fields may be unused but match the API schema
#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct CollectionResponse {
    packages: Option<Vec<Package>>,
    #[serde(rename = "nextPage")]
    next_page: Option<String>,
    count: Option<u32>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct Package {
    #[serde(rename = "packageId")]
    package_id: String,
    title: Option<String>,
    #[serde(rename = "dateIssued")]
    date_issued: Option<String>,
    #[serde(rename = "packageLink")]
    package_link: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct GranulesResponse {
    granules: Option<Vec<Granule>>,
    #[serde(rename = "nextPage")]
    next_page: Option<String>,
    count: Option<u32>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct Granule {
    #[serde(rename = "granuleId")]
    granule_id: String,
    title: Option<String>,
    #[serde(rename = "granuleClass")]
    granule_class: Option<String>,
    #[serde(rename = "granuleLink")]
    granule_link: Option<String>,
}

impl GovInfoClient {
    pub fn new(api_key: String) -> Self {
        Self {
            api_key,
            client: reqwest::blocking::Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .expect("Failed to create HTTP client"),
        }
    }

    fn fetch_json<T: serde::de::DeserializeOwned>(&self, url: &str) -> Result<T> {
        thread::sleep(Duration::from_millis(RATE_LIMIT_DELAY_MS));

        let url_with_key = if url.contains('?') {
            format!("{}&api_key={}", url, self.api_key)
        } else {
            format!("{}?api_key={}", url, self.api_key)
        };

        let response = self
            .client
            .get(&url_with_key)
            .send()
            .wrap_err_with(|| format!("Failed to fetch {}", url))?;

        if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
            eprintln!("Rate limited, waiting 60s...");
            thread::sleep(Duration::from_secs(60));
            return self.fetch_json(url);
        }

        let status = response.status();
        if !status.is_success() {
            let body = response.text().unwrap_or_default();
            eyre::bail!("HTTP {} for {}: {}", status, url, body);
        }

        response
            .json()
            .wrap_err_with(|| format!("Failed to parse JSON from {}", url))
    }

    /// Fetch all Congressional Record packages (CREC) within a date range
    fn fetch_crec_packages(
        &self,
        start_date: &str,
        end_date: &str,
    ) -> Result<Vec<Package>> {
        let mut all_packages = Vec::new();
        let mut url = format!(
            "{}/collections/CREC/{}?offset=0&pageSize=100&startDate={}&endDate={}",
            GOVINFO_BASE_URL, start_date, start_date, end_date
        );

        loop {
            eprintln!("Fetching CREC packages: {}...", &url[..80.min(url.len())]);
            let response: CollectionResponse = self.fetch_json(&url)?;

            if let Some(packages) = response.packages {
                let count = packages.len();
                all_packages.extend(packages);
                eprintln!("  Got {} packages (total: {})", count, all_packages.len());
            }

            match response.next_page {
                Some(next) if !next.is_empty() => url = next,
                _ => break,
            }
        }

        Ok(all_packages)
    }

    /// Fetch granules (individual speeches/articles) from a CREC package
    fn fetch_crec_granules(&self, package_id: &str) -> Result<Vec<Granule>> {
        let mut all_granules = Vec::new();
        let mut url = format!(
            "{}/packages/{}/granules?offset=0&pageSize=100",
            GOVINFO_BASE_URL, package_id
        );

        loop {
            let response: GranulesResponse = self.fetch_json(&url)?;

            if let Some(granules) = response.granules {
                all_granules.extend(granules);
            }

            match response.next_page {
                Some(next) if !next.is_empty() => url = next,
                _ => break,
            }
        }

        Ok(all_granules)
    }

    /// Fetch all floor speeches from CREC collection for a date range
    pub fn fetch_floor_speeches(
        &self,
        start_date: &str,
        end_date: &str,
        progress_callback: impl Fn(usize, usize),
    ) -> Result<Vec<FloorSpeech>> {
        let packages = self.fetch_crec_packages(start_date, end_date)?;
        let total_packages = packages.len();
        let mut speeches = Vec::new();

        for (i, package) in packages.iter().enumerate() {
            progress_callback(i + 1, total_packages);

            let granules = match self.fetch_crec_granules(&package.package_id) {
                Ok(g) => g,
                Err(e) => {
                    eprintln!("  Warning: Failed to fetch granules for {}: {}", package.package_id, e);
                    continue;
                }
            };

            for granule in granules {
                // Filter for actual floor speeches (not tables of contents, etc.)
                let granule_class = granule.granule_class.as_deref().unwrap_or("");
                if !is_floor_speech_granule(granule_class) {
                    continue;
                }

                let date = extract_date_from_package_id(&package.package_id);
                let chamber = extract_chamber_from_granule(&granule);

                // Build transcript URL from granule link
                let transcript_url = granule.granule_link.as_ref().map(|_link| {
                    // Convert API link to govinfo.gov web link
                    format!(
                        "https://www.govinfo.gov/app/details/{}/{}",
                        package.package_id, granule.granule_id
                    )
                });

                speeches.push(FloorSpeech {
                    event_id: format!("{}-{}", package.package_id, granule.granule_id),
                    date,
                    chamber,
                    title: granule.title.unwrap_or_else(|| "Untitled".to_string()),
                    transcript: transcript_url,
                    video: None, // CREC doesn't include video links
                    granule_id: Some(granule.granule_id),
                });
            }
        }

        Ok(speeches)
    }
}

fn is_floor_speech_granule(granule_class: &str) -> bool {
    matches!(
        granule_class,
        "SENATE" | "HOUSE" | "EXTENSIONS" | "DAILYDIGEST"
    )
}

fn extract_date_from_package_id(package_id: &str) -> String {
    // Package ID format: CREC-YYYY-MM-DD
    if package_id.starts_with("CREC-") && package_id.len() >= 15 {
        package_id[5..15].to_string()
    } else {
        "unknown".to_string()
    }
}

fn extract_chamber_from_granule(granule: &Granule) -> Chamber {
    let class = granule.granule_class.as_deref().unwrap_or("");
    let id = &granule.granule_id;

    if class == "SENATE" || id.contains("-S") || id.contains("_S") {
        Chamber::Senate
    } else if class == "HOUSE" || id.contains("-H") || id.contains("_H") {
        Chamber::House
    } else {
        // Check title as fallback
        let title = granule.title.as_deref().unwrap_or("").to_lowercase();
        if title.contains("senate") {
            Chamber::Senate
        } else if title.contains("house") {
            Chamber::House
        } else {
            Chamber::Unknown
        }
    }
}
