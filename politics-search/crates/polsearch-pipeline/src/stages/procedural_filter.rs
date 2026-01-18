//! Procedural text filtering for congressional hearings and floor speeches

/// Common procedural phrases that indicate low-value content
const PROCEDURAL_PHRASES: &[&str] = &[
    "thank you",
    "i yield back",
    "the chair recognizes",
    "without objection",
    "so ordered",
    "hearing adjourned",
    "the gentleman yields",
    "the gentlewoman yields",
    "i reserve my time",
    "reclaiming my time",
    "will the gentleman yield",
    "will the gentlewoman yield",
    "the hearing is adjourned",
    "we are adjourned",
    "we'll stand in recess",
    "the committee stands adjourned",
];

/// CREC document titles that indicate procedural/administrative content
/// These titles should be filtered out when ingesting floor speeches
const PROCEDURAL_CREC_TITLES: &[&str] = &[
    "PRAYER",
    "PLEDGE OF ALLEGIANCE",
    "THE JOURNAL",
    "ADJOURNMENT",
    "DESIGNATION OF THE SPEAKER PRO TEMPORE",
    "ADDITIONAL SPONSORS",
    "REPORTS OF COMMITTEES",
    "REPORTS OF COMMITTEES ON PUBLIC BILLS AND RESOLUTIONS",
    "EXECUTIVE COMMUNICATIONS",
    "EXECUTIVE COMMUNICATIONS, ETC.",
    "PUBLIC BILLS AND RESOLUTIONS",
    "SUBMISSION OF CONCURRENT AND SENATE RESOLUTIONS",
    "STATEMENTS ON INTRODUCED BILLS AND JOINT RESOLUTIONS",
    "AMENDMENTS SUBMITTED AND PROPOSED",
    "TEXT OF AMENDMENTS",
    "AUTHORITY FOR COMMITTEES TO MEET",
    "PRIVILEGES OF THE FLOOR",
    "ORDERS FOR MONDAY",
    "ORDERS FOR TUESDAY",
    "ORDERS FOR WEDNESDAY",
    "ORDERS FOR THURSDAY",
    "ORDERS FOR FRIDAY",
    "PROGRAM",
    "RECESS",
    "MORNING BUSINESS",
    "MORNING HOUR DEBATE",
    "ENROLLED BILLS SIGNED",
    "BILLS PRESENTED TO THE PRESIDENT",
    "COMMUNICATION FROM THE CLERK OF THE HOUSE",
    "SENATE ENROLLED BILLS SIGNED",
    "HOUSE ENROLLED BILLS SIGNED",
];

/// CREC title prefixes that indicate procedural content
const PROCEDURAL_CREC_PREFIXES: &[&str] = &[
    "Daily Digest",
    "FrontMatter",
    "Constitutional Authority",
];

/// Minimum word count for a statement to be considered meaningful
const MIN_WORD_COUNT: usize = 10;

/// Check if a statement should be skipped as procedural content
#[must_use]
pub fn should_skip_statement(text: &str) -> bool {
    let word_count = text.split_whitespace().count();
    if word_count < MIN_WORD_COUNT {
        return true;
    }

    let lower = text.to_lowercase();
    PROCEDURAL_PHRASES.iter().any(|p| lower.contains(p))
}

/// Filter procedural statements from a list, returning only meaningful content
#[must_use]
pub fn filter_statements<T, F>(statements: Vec<T>, get_text: F) -> Vec<T>
where
    F: Fn(&T) -> &str,
{
    statements
        .into_iter()
        .filter(|s| !should_skip_statement(get_text(s)))
        .collect()
}

/// Check if a CREC floor speech title indicates procedural content that should be skipped
#[must_use]
pub fn is_procedural_crec_title(title: &str) -> bool {
    let upper_title = title.to_uppercase();

    // check exact matches
    if PROCEDURAL_CREC_TITLES.iter().any(|t| upper_title == *t) {
        return true;
    }

    // check prefixes
    if PROCEDURAL_CREC_PREFIXES
        .iter()
        .any(|p| title.starts_with(p))
    {
        return true;
    }

    // check for common patterns
    if upper_title.contains("DAILY DIGEST") || upper_title.contains("FRONTMATTER") {
        return true;
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_short_statement_skipped() {
        assert!(should_skip_statement("Thank you."));
        assert!(should_skip_statement("I yield back."));
    }

    #[test]
    fn test_procedural_statement_skipped() {
        assert!(should_skip_statement(
            "Thank you very much for that wonderful testimony today."
        ));
        assert!(should_skip_statement(
            "I yield back the balance of my time to the chairman."
        ));
    }

    #[test]
    fn test_meaningful_statement_kept() {
        assert!(!should_skip_statement(
            "The economic impact of this policy has been devastating for rural communities across the nation."
        ));
    }
}
