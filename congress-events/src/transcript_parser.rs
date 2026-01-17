//! Transcript parser for congressional hearing transcripts from GovInfo

use crate::models::{Chamber, Hearing, ParsedTranscript, Statement};
use eyre::{Context, Result};
use regex::Regex;
use std::collections::HashSet;
use std::thread;
use std::time::Duration;

const RATE_LIMIT_DELAY_MS: u64 = 200;

pub struct TranscriptFetcher {
    client: reqwest::blocking::Client,
}

impl TranscriptFetcher {
    pub fn new() -> Self {
        Self {
            client: reqwest::blocking::Client::builder()
                .timeout(Duration::from_secs(60))
                .build()
                .expect("Failed to create HTTP client"),
        }
    }

    /// Extract package ID from a govinfo URL
    /// e.g., "https://www.govinfo.gov/app/details/CHRG-116hhrg43010" -> "CHRG-116hhrg43010"
    pub fn extract_package_id(url: &str) -> Option<String> {
        // Handle various URL formats
        if let Some(idx) = url.rfind('/') {
            let id = &url[idx + 1..];
            if id.starts_with("CHRG-") {
                return Some(id.to_string());
            }
        }

        // Try to extract from any position
        if let Some(start) = url.find("CHRG-") {
            let rest = &url[start..];
            let end = rest.find(|c: char| !c.is_alphanumeric() && c != '-').unwrap_or(rest.len());
            return Some(rest[..end].to_string());
        }

        None
    }

    /// Build the HTML content URL from a package ID
    fn build_html_url(package_id: &str) -> String {
        format!(
            "https://www.govinfo.gov/content/pkg/{}/html/{}.htm",
            package_id, package_id
        )
    }

    /// Fetch the raw HTML content of a transcript
    pub fn fetch_transcript_html(&self, package_id: &str) -> Result<String> {
        thread::sleep(Duration::from_millis(RATE_LIMIT_DELAY_MS));

        let url = Self::build_html_url(package_id);
        let response = self
            .client
            .get(&url)
            .send()
            .wrap_err_with(|| format!("Failed to fetch {}", url))?;

        if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
            eprintln!("Rate limited, waiting 60s...");
            thread::sleep(Duration::from_secs(60));
            return self.fetch_transcript_html(package_id);
        }

        let status = response.status();
        if !status.is_success() {
            eyre::bail!("HTTP {} for {}", status, url);
        }

        response
            .text()
            .wrap_err_with(|| format!("Failed to read response from {}", url))
    }

    /// Parse a transcript from a hearing
    pub fn parse_hearing_transcript(&self, hearing: &Hearing) -> Result<Option<ParsedTranscript>> {
        let transcript_url = match &hearing.transcript {
            Some(url) => url,
            None => return Ok(None),
        };

        let package_id = match Self::extract_package_id(transcript_url) {
            Some(id) => id,
            None => {
                eprintln!("  Warning: Could not extract package ID from {}", transcript_url);
                return Ok(None);
            }
        };

        let html = self.fetch_transcript_html(&package_id)?;
        let parsed = parse_transcript_html(&html, hearing, &package_id, transcript_url)?;

        Ok(Some(parsed))
    }
}

/// Parse the HTML content of a transcript into structured data
pub fn parse_transcript_html(
    html: &str,
    hearing: &Hearing,
    package_id: &str,
    source_url: &str,
) -> Result<ParsedTranscript> {
    // Extract text from within <pre> tags
    let text = extract_pre_content(html);

    // Parse statements
    let statements = parse_statements(&text);

    // Extract unique speakers in order of first appearance
    let mut seen = HashSet::new();
    let speakers: Vec<String> = statements
        .iter()
        .filter_map(|s| {
            if seen.insert(s.speaker.clone()) {
                Some(s.speaker.clone())
            } else {
                None
            }
        })
        .collect();

    // Try to extract title from the transcript if available
    let title = extract_title(&text).unwrap_or_else(|| hearing.title.clone());

    // Try to extract committee from the transcript
    let committee = extract_committee(&text).or_else(|| hearing.committee.clone());

    Ok(ParsedTranscript {
        event_id: hearing.event_id.clone(),
        package_id: package_id.to_string(),
        title,
        date: hearing.date.clone(),
        committee,
        chamber: hearing.chamber.clone(),
        congress: hearing.congress,
        source_url: source_url.to_string(),
        statements,
        speakers,
    })
}

/// Extract text content from within <pre> tags
fn extract_pre_content(html: &str) -> String {
    // Find content between <pre> and </pre>
    if let Some(start) = html.find("<pre>") {
        let after_pre = &html[start + 5..];
        if let Some(end) = after_pre.find("</pre>") {
            return after_pre[..end].to_string();
        }
    }

    // Fallback: strip all HTML tags
    let tag_re = Regex::new(r"<[^>]+>").unwrap();
    tag_re.replace_all(html, "").to_string()
}

/// Parse statements from transcript text
fn parse_statements(text: &str) -> Vec<Statement> {
    let mut statements = Vec::new();

    // Pattern to match speaker introductions
    // Handles: "Mr. Smith.", "Ms. Jones.", "Chairman Smith.", "Chairwoman Pelosi.",
    // "Senator Cruz.", "Representative Ocasio-Cortez.", "Dr. Fauci.", "The Witness.", etc.
    let speaker_pattern = Regex::new(
        r"(?m)^\s{4}((?:Mr\.|Ms\.|Mrs\.|Dr\.|Chairman|Chairwoman|Chairperson|Senator|Representative|The\s+(?:Chair|Witness|Chairman|Chairwoman))\s*[A-Z][a-zA-Z\-']+)\.\s+"
    ).unwrap();

    // Also match speakers with just titles at start of line with 4 spaces
    let alt_pattern = Regex::new(
        r"(?m)^\s{4}([A-Z][a-z]+(?:\s+[A-Z][a-zA-Z\-']+)?)\.\s+"
    ).unwrap();

    let mut current_speaker: Option<String> = None;
    let mut current_text = String::new();
    let mut last_end = 0;
    let mut statement_index = 0;

    // Find all speaker matches
    let mut matches: Vec<(usize, usize, String)> = Vec::new();

    for cap in speaker_pattern.captures_iter(text) {
        let full_match = cap.get(0).unwrap();
        let speaker = cap.get(1).unwrap().as_str().trim().to_string();
        matches.push((full_match.start(), full_match.end(), speaker));
    }

    // Sort by position
    matches.sort_by_key(|(start, _, _)| *start);

    for (start, end, speaker) in matches {
        // Save previous speaker's text if any
        if let Some(prev_speaker) = current_speaker.take() {
            let text_chunk = text[last_end..start].trim();
            if !text_chunk.is_empty() {
                current_text.push_str(text_chunk);
            }

            if !current_text.trim().is_empty() {
                statements.push(Statement {
                    speaker: prev_speaker,
                    text: clean_text(&current_text),
                    index: statement_index,
                });
                statement_index += 1;
            }
            current_text.clear();
        }

        current_speaker = Some(speaker);
        last_end = end;
    }

    // Don't forget the last speaker's text
    if let Some(speaker) = current_speaker {
        let remaining = text[last_end..].trim();
        if !remaining.is_empty() {
            current_text.push_str(remaining);
        }

        if !current_text.trim().is_empty() {
            statements.push(Statement {
                speaker,
                text: clean_text(&current_text),
                index: statement_index,
            });
        }
    }

    statements
}

/// Clean up text by normalizing whitespace and removing artifacts
fn clean_text(text: &str) -> String {
    // Normalize whitespace
    let ws_re = Regex::new(r"\s+").unwrap();
    let cleaned = ws_re.replace_all(text.trim(), " ");

    // Remove page break artifacts
    let page_re = Regex::new(r"\[\[Page \d+\]\]").unwrap();
    let cleaned = page_re.replace_all(&cleaned, "");

    cleaned.trim().to_string()
}

/// Try to extract the hearing title from the transcript text
fn extract_title(text: &str) -> Option<String> {
    // Look for title patterns - usually in all caps near the start
    let lines: Vec<&str> = text.lines().take(50).collect();

    for window in lines.windows(3) {
        let combined = window.join(" ").trim().to_string();
        // Title is usually in all caps and not too short
        if combined.len() > 20
            && combined.len() < 300
            && combined.chars().filter(|c| c.is_alphabetic()).all(|c| c.is_uppercase())
            && !combined.contains("COMMITTEE ON")
            && !combined.contains("HOUSE OF REPRESENTATIVES")
            && !combined.contains("UNITED STATES SENATE")
        {
            // Found a potential title
            let title_re = Regex::new(r"\s+").unwrap();
            return Some(title_re.replace_all(&combined, " ").trim().to_string());
        }
    }

    None
}

/// Try to extract committee name from transcript
fn extract_committee(text: &str) -> Option<String> {
    let committee_re = Regex::new(r"(?i)COMMITTEE ON\s+([A-Z\s,]+)").unwrap();

    if let Some(cap) = committee_re.captures(text) {
        let name = cap.get(1)?.as_str().trim();
        // Capitalize properly
        let words: Vec<String> = name
            .split_whitespace()
            .map(|w| {
                let mut chars = w.chars();
                match chars.next() {
                    None => String::new(),
                    Some(first) => {
                        first.to_uppercase().collect::<String>() + &chars.as_str().to_lowercase()
                    }
                }
            })
            .collect();
        return Some(words.join(" "));
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_package_id() {
        assert_eq!(
            TranscriptFetcher::extract_package_id("https://www.govinfo.gov/app/details/CHRG-116hhrg43010"),
            Some("CHRG-116hhrg43010".to_string())
        );
    }

    #[test]
    fn test_parse_statements() {
        let text = r#"
    Mr. Smith. Thank you for having me today.
    Ms. Jones. I appreciate your testimony.
    Mr. Smith. I would like to add one more point.
"#;
        let statements = parse_statements(text);
        assert_eq!(statements.len(), 3);
        assert_eq!(statements[0].speaker, "Mr. Smith");
        assert_eq!(statements[1].speaker, "Ms. Jones");
        assert_eq!(statements[2].speaker, "Mr. Smith");
    }
}
