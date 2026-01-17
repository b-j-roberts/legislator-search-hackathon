//! Utility functions for `PolSearch`

use chrono::{DateTime, Datelike, Utc};

/// Converts a name to a URL-safe slug
///
/// # Examples
/// ```
/// assert_eq!(polsearch_util::slugify("What Bitcoin Did"), "what-bitcoin-did");
/// assert_eq!(polsearch_util::slugify("The Bitcoin Standard Podcast"), "the-bitcoin-standard-podcast");
/// ```
#[must_use]
pub fn slugify(name: &str) -> String {
    slug::slugify(name)
}

/// Extracts the year-month string from a datetime (format: "YYYY-MM")
///
/// # Examples
/// ```
/// use chrono::{TimeZone, Utc};
/// let dt = Utc.with_ymd_and_hms(2024, 1, 15, 12, 0, 0).unwrap();
/// assert_eq!(polsearch_util::parse_year_month(&dt), "2024-01");
/// ```
#[must_use]
pub fn parse_year_month(dt: &DateTime<Utc>) -> String {
    format!("{:04}-{:02}", dt.year(), dt.month())
}

/// Parses a year-month string into year and month components
///
/// # Examples
/// ```
/// assert_eq!(polsearch_util::split_year_month("2024-01"), Some((2024, 1)));
/// assert_eq!(polsearch_util::split_year_month("invalid"), None);
/// ```
#[must_use]
pub fn split_year_month(year_month: &str) -> Option<(i32, u32)> {
    let parts: Vec<&str> = year_month.split('-').collect();
    if parts.len() != 2 {
        return None;
    }
    let year = parts[0].parse().ok()?;
    let month = parts[1].parse().ok()?;
    if !(1..=12).contains(&month) {
        return None;
    }
    Some((year, month))
}

/// Generates a batch name from date range parameters
///
/// # Examples
/// ```
/// assert_eq!(polsearch_util::batch_name_from_month("2026-01"), "2026-01");
/// assert_eq!(polsearch_util::batch_name_from_year(2026), "2026");
/// assert_eq!(polsearch_util::batch_name_from_range("2024-06", "2025-01"), "2024-06 to 2025-01");
/// ```
#[must_use]
pub fn batch_name_from_month(month: &str) -> String {
    month.to_string()
}

#[must_use]
pub fn batch_name_from_year(year: i32) -> String {
    format!("{year}")
}

#[must_use]
pub fn batch_name_from_range(from: &str, to: &str) -> String {
    format!("{from} to {to}")
}

/// Truncates a string to a maximum length, adding "..." if truncated
///
/// # Examples
/// ```
/// assert_eq!(polsearch_util::truncate("hello", 10), "hello");
/// assert_eq!(polsearch_util::truncate("hello world", 8), "hello...");
/// ```
#[must_use]
pub fn truncate(s: &str, max_len: usize) -> String {
    if s.len() <= max_len {
        s.to_string()
    } else {
        format!("{}...", &s[..max_len - 3])
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn test_slugify() {
        assert_eq!(slugify("What Bitcoin Did"), "what-bitcoin-did");
        assert_eq!(
            slugify("The Bitcoin Standard Podcast"),
            "the-bitcoin-standard-podcast"
        );
        assert_eq!(slugify("TFTC"), "tftc");
        assert_eq!(slugify("What is Money?"), "what-is-money");
        assert_eq!(slugify("Once Bitten!"), "once-bitten");
    }

    #[test]
    fn test_parse_year_month() {
        let dt = Utc.with_ymd_and_hms(2024, 1, 15, 12, 0, 0).unwrap();
        assert_eq!(parse_year_month(&dt), "2024-01");

        let dt = Utc.with_ymd_and_hms(2025, 12, 31, 23, 59, 59).unwrap();
        assert_eq!(parse_year_month(&dt), "2025-12");
    }

    #[test]
    fn test_split_year_month() {
        assert_eq!(split_year_month("2024-01"), Some((2024, 1)));
        assert_eq!(split_year_month("2025-12"), Some((2025, 12)));
        assert_eq!(split_year_month("invalid"), None);
        assert_eq!(split_year_month("2024-13"), None);
        assert_eq!(split_year_month("2024-00"), None);
    }

    #[test]
    fn test_batch_names() {
        assert_eq!(batch_name_from_month("2026-01"), "2026-01");
        assert_eq!(batch_name_from_year(2026), "2026");
        assert_eq!(
            batch_name_from_range("2024-06", "2025-01"),
            "2024-06 to 2025-01"
        );
    }
}
