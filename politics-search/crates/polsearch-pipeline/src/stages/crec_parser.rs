//! CREC (Congressional Record) HTML parsing
//!
//! Parses Congressional Record HTML documents into structured speaker statements

use regex::Regex;
use scraper::{Html, Selector};
use std::sync::LazyLock;

/// Parsed statement from CREC document
#[derive(Debug, Clone)]
pub struct CrecStatement {
    /// Speaker label (e.g., "Mr. MERKLEY", "The PRESIDING OFFICER")
    pub speaker: String,
    /// Statement text
    pub text: String,
    /// Index in document
    pub index: i32,
}

/// CREC speaker pattern - matches speaker labels at start of paragraphs
/// Examples:
/// - "Mr. MERKLEY."
/// - "Ms. PELOSI."
/// - "Mrs. MILLER-MEEKS."
/// - "The SPEAKER pro tempore."
/// - "The PRESIDING OFFICER."
/// - "The ACTING PRESIDENT pro tempore."
static SPEAKER_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"(?m)^\s{0,4}((?:Mr\.|Ms\.|Mrs\.)\s+[A-Z][A-Z\-']+|The\s+(?:ACTING\s+)?(?:PRESIDENT(?:\s+pro\s+tempore)?|PRESIDING\s+OFFICER|SPEAKER(?:\s+pro\s+tempore)?))\.\s*"
    ).expect("valid regex")
});

/// Parse CREC HTML content into structured statements
#[must_use]
pub fn parse_crec_html(html: &str) -> Vec<CrecStatement> {
    let document = Html::parse_document(html);

    // extract text from the document body
    let body_selector = Selector::parse("body").unwrap_or_else(|_| {
        Selector::parse("*").expect("universal selector should always parse")
    });

    let body_text = document
        .select(&body_selector)
        .next()
        .map(|body| body.text().collect::<Vec<&str>>().join(" "))
        .unwrap_or_default();

    parse_crec_text(&body_text)
}

/// Parse CREC plain text into structured statements
#[must_use]
pub fn parse_crec_text(text: &str) -> Vec<CrecStatement> {
    let mut statements = Vec::new();
    let mut current_speaker = String::new();
    let mut current_text = String::new();
    let mut statement_index = 0;

    // normalize whitespace
    let normalized = text
        .lines()
        .map(|line| line.trim())
        .collect::<Vec<_>>()
        .join("\n");

    // split by speaker patterns
    let matches: Vec<_> = SPEAKER_PATTERN.find_iter(&normalized).collect();

    if matches.is_empty() {
        // no speaker patterns found, return single statement if text is meaningful
        let clean_text = clean_statement_text(text);
        if !clean_text.is_empty() {
            statements.push(CrecStatement {
                speaker: "UNKNOWN".to_string(),
                text: clean_text,
                index: 0,
            });
        }
        return statements;
    }

    // process each speaker segment
    for (i, m) in matches.iter().enumerate() {
        // save previous statement if exists
        if !current_text.is_empty() && !current_speaker.is_empty() {
            let clean_text = clean_statement_text(&current_text);
            if word_count(&clean_text) >= 5 {
                statements.push(CrecStatement {
                    speaker: current_speaker.clone(),
                    text: clean_text,
                    index: statement_index,
                });
                statement_index += 1;
            }
        }

        // extract speaker from match
        current_speaker = m.as_str().trim().trim_end_matches('.').to_string();

        // get text until next speaker or end
        let start = m.end();
        let end = matches
            .get(i + 1)
            .map_or(normalized.len(), |next: &regex::Match<'_>| next.start());
        current_text = normalized[start..end].to_string();
    }

    // save final statement
    if !current_text.is_empty() && !current_speaker.is_empty() {
        let clean_text = clean_statement_text(&current_text);
        if word_count(&clean_text) >= 5 {
            statements.push(CrecStatement {
                speaker: current_speaker,
                text: clean_text,
                index: statement_index,
            });
        }
    }

    statements
}

/// Clean statement text by removing extra whitespace and common artifacts
fn clean_statement_text(text: &str) -> String {
    // normalize whitespace
    let mut result = text
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    // remove leading/trailing punctuation artifacts
    result = result.trim().to_string();

    // remove common CREC artifacts
    let artifacts = ["[Laughter.]", "[Applause.]", "____", "----"];
    for artifact in artifacts {
        result = result.replace(artifact, " ");
    }

    // collapse multiple spaces
    while result.contains("  ") {
        result = result.replace("  ", " ");
    }

    result.trim().to_string()
}

/// Count words in text
fn word_count(text: &str) -> usize {
    text.split_whitespace().count()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_statement() {
        let text = "    Mr. MERKLEY. I rise today to speak about immigration reform. This is an important issue facing our nation.";
        let statements = parse_crec_text(text);
        assert_eq!(statements.len(), 1);
        assert_eq!(statements[0].speaker, "Mr. MERKLEY");
        assert!(statements[0].text.contains("immigration reform"));
    }

    #[test]
    fn test_parse_multiple_speakers() {
        let text = r#"
    Mr. MERKLEY. I yield to my colleague.
    Ms. PELOSI. I thank the gentleman for yielding. We must act on this important legislation.
        "#;
        let statements = parse_crec_text(text);
        assert_eq!(statements.len(), 2);
        assert_eq!(statements[0].speaker, "Mr. MERKLEY");
        assert_eq!(statements[1].speaker, "Ms. PELOSI");
    }

    #[test]
    fn test_presiding_officer() {
        let text = "    The PRESIDING OFFICER. The Senator from Oregon is recognized for the next fifteen minutes.";
        let statements = parse_crec_text(text);
        assert_eq!(statements.len(), 1);
        assert_eq!(statements[0].speaker, "The PRESIDING OFFICER");
    }

    #[test]
    fn test_speaker_pro_tempore() {
        let text = "    The SPEAKER pro tempore. The Chair recognizes the gentleman from California for one minute.";
        let statements = parse_crec_text(text);
        assert_eq!(statements.len(), 1);
        assert_eq!(statements[0].speaker, "The SPEAKER pro tempore");
    }

    #[test]
    fn test_hyphenated_name() {
        let text = "    Mrs. MILLER-MEEKS. I represent the great state of Iowa and I am honored to serve.";
        let statements = parse_crec_text(text);
        assert_eq!(statements.len(), 1);
        assert_eq!(statements[0].speaker, "Mrs. MILLER-MEEKS");
    }
}
