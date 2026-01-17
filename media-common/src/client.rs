use eyre::{Context, Result};
use reqwest::blocking::Client;
use serde::de::DeserializeOwned;
use std::time::Duration;
use tracing::{debug, warn};

/// Rate-limited HTTP client with retry support
pub struct HttpClient {
    client: Client,
    rate_limit_ms: u64,
    max_retries: u32,
}

impl HttpClient {
    /// Create a new HTTP client with default settings
    pub fn new() -> Result<Self> {
        Self::with_config(200, 3, 30)
    }

    /// Create a new HTTP client with custom configuration
    ///
    /// # Arguments
    /// * `rate_limit_ms` - Delay between requests in milliseconds
    /// * `max_retries` - Maximum number of retry attempts on failure
    /// * `timeout_secs` - Request timeout in seconds
    pub fn with_config(rate_limit_ms: u64, max_retries: u32, timeout_secs: u64) -> Result<Self> {
        let client = Client::builder()
            .timeout(Duration::from_secs(timeout_secs))
            .user_agent("legislator-search/1.0")
            .build()
            .wrap_err("failed to build HTTP client")?;

        Ok(Self {
            client,
            rate_limit_ms,
            max_retries,
        })
    }

    /// Fetch JSON from a URL with rate limiting and retries
    pub fn fetch_json<T: DeserializeOwned>(&self, url: &str) -> Result<T> {
        self.rate_limit();
        self.fetch_with_retry(url, |response| {
            response
                .json::<T>()
                .wrap_err_with(|| format!("failed to parse JSON from {}", url))
        })
    }

    /// Fetch text from a URL with rate limiting and retries
    pub fn fetch_text(&self, url: &str) -> Result<String> {
        self.rate_limit();
        self.fetch_with_retry(url, |response| {
            response
                .text()
                .wrap_err_with(|| format!("failed to read text from {}", url))
        })
    }

    /// Fetch raw bytes from a URL with rate limiting and retries
    pub fn fetch_bytes(&self, url: &str) -> Result<Vec<u8>> {
        self.rate_limit();
        self.fetch_with_retry(url, |response| {
            response
                .bytes()
                .map(|b| b.to_vec())
                .wrap_err_with(|| format!("failed to read bytes from {}", url))
        })
    }

    /// Check if a URL exists (HEAD request)
    pub fn url_exists(&self, url: &str) -> Result<bool> {
        self.rate_limit();
        let response = self.client.head(url).send().wrap_err("HEAD request failed")?;
        Ok(response.status().is_success())
    }

    fn rate_limit(&self) {
        std::thread::sleep(Duration::from_millis(self.rate_limit_ms));
    }

    fn fetch_with_retry<T, F>(&self, url: &str, parse: F) -> Result<T>
    where
        F: Fn(reqwest::blocking::Response) -> Result<T>,
    {
        let mut attempts = 0;

        loop {
            attempts += 1;
            debug!("Fetching {} (attempt {})", url, attempts);

            let response = self
                .client
                .get(url)
                .send()
                .wrap_err_with(|| format!("failed to fetch {}", url))?;

            let status = response.status();

            // rate limited - wait and retry
            if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
                if attempts <= self.max_retries {
                    warn!("Rate limited on {}, waiting 60s before retry", url);
                    std::thread::sleep(Duration::from_secs(60));
                    continue;
                }
                return Err(eyre::eyre!("rate limited after {} attempts: {}", attempts, url));
            }

            // server error - retry
            if status.is_server_error() && attempts <= self.max_retries {
                warn!(
                    "Server error {} on {}, retrying in 5s",
                    status.as_u16(),
                    url
                );
                std::thread::sleep(Duration::from_secs(5));
                continue;
            }

            // check for other errors
            if !status.is_success() {
                return Err(eyre::eyre!(
                    "HTTP {} fetching {}: {}",
                    status.as_u16(),
                    url,
                    status.canonical_reason().unwrap_or("unknown error")
                ));
            }

            return parse(response);
        }
    }
}

impl Default for HttpClient {
    fn default() -> Self {
        Self::new().expect("failed to create default HTTP client")
    }
}
