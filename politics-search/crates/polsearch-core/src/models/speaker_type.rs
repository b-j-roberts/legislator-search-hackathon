//! Speaker type classification

use serde::{Deserialize, Serialize};

/// Type of speaker in congressional proceedings
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SpeakerType {
    /// Member of the Senate
    Senator,
    /// Member of the House of Representatives
    Representative,
    /// Presiding officer (Speaker, President Pro Tempore, etc.)
    PresidingOfficer,
    /// Witness at a hearing (not a member of Congress)
    Witness,
    /// Unable to determine speaker type
    Unknown,
}

impl SpeakerType {
    /// Returns the string representation
    #[must_use]
    pub const fn as_str(&self) -> &'static str {
        match self {
            Self::Senator => "senator",
            Self::Representative => "representative",
            Self::PresidingOfficer => "presiding_officer",
            Self::Witness => "witness",
            Self::Unknown => "unknown",
        }
    }

    /// Returns true if this speaker is a member of Congress or presiding officer
    #[must_use]
    pub const fn is_congressional(&self) -> bool {
        matches!(self, Self::Senator | Self::Representative | Self::PresidingOfficer)
    }

    /// Parse from string representation
    #[must_use]
    pub fn from_str(s: &str) -> Self {
        match s {
            "senator" => Self::Senator,
            "representative" => Self::Representative,
            "presiding_officer" => Self::PresidingOfficer,
            "witness" => Self::Witness,
            _ => Self::Unknown,
        }
    }

    /// Detect speaker type from label, content type, and chamber
    #[must_use]
    pub fn detect(label: &str, content_type: &str, chamber: Option<&str>) -> Self {
        let label_upper = label.to_uppercase();

        // explicit congressional titles
        if label_upper.starts_with("SENATOR ") {
            return Self::Senator;
        }
        if label_upper.starts_with("REPRESENTATIVE ")
            || label_upper.starts_with("CONGRESSMAN ")
            || label_upper.starts_with("CONGRESSWOMAN ")
        {
            return Self::Representative;
        }

        // presiding officers
        if label_upper.contains("PRESIDING OFFICER")
            || label_upper.contains("SPEAKER PRO TEMPORE")
            || label_upper.contains("PRESIDENT PRO TEMPORE")
            || label_upper == "THE SPEAKER"
            || label_upper.starts_with("THE SPEAKER ")
            || label_upper == "THE CHAIR"
            || label_upper.starts_with("THE CHAIR ")
        {
            return Self::PresidingOfficer;
        }

        // chairman/ranking member in hearings - use chamber to determine
        if label_upper.starts_with("CHAIRMAN ")
            || label_upper.starts_with("CHAIRWOMAN ")
            || label_upper.starts_with("RANKING MEMBER ")
        {
            return match chamber {
                Some(c) if c.contains("Senate") => Self::Senator,
                Some(c) if c.contains("House") => Self::Representative,
                _ => Self::Unknown,
            };
        }

        // hearings with Mr./Ms./Dr. prefix and no congressional title = witness
        if content_type == "hearing"
            && (label_upper.starts_with("MR. ")
                || label_upper.starts_with("MS. ")
                || label_upper.starts_with("MRS. ")
                || label_upper.starts_with("DR. "))
        {
            return Self::Witness;
        }

        // floor speech Mr./Ms. - use chamber
        if content_type == "floor_speech" {
            return match chamber {
                Some(c) if c.contains("Senate") => Self::Senator,
                Some(c) if c.contains("House") => Self::Representative,
                _ => Self::Unknown,
            };
        }

        Self::Unknown
    }
}

impl std::fmt::Display for SpeakerType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn detect_senator() {
        assert_eq!(
            SpeakerType::detect("Senator MERKLEY", "hearing", Some("Senate")),
            SpeakerType::Senator
        );
        assert_eq!(
            SpeakerType::detect("Senator SMITH", "floor_speech", Some("Senate")),
            SpeakerType::Senator
        );
    }

    #[test]
    fn detect_representative() {
        assert_eq!(
            SpeakerType::detect("Representative CROW", "hearing", Some("House")),
            SpeakerType::Representative
        );
        assert_eq!(
            SpeakerType::detect("Congressman JOHNSON", "hearing", Some("House")),
            SpeakerType::Representative
        );
        assert_eq!(
            SpeakerType::detect("Congresswoman PELOSI", "hearing", Some("House")),
            SpeakerType::Representative
        );
    }

    #[test]
    fn detect_presiding_officer() {
        assert_eq!(
            SpeakerType::detect("The PRESIDING OFFICER", "floor_speech", Some("Senate")),
            SpeakerType::PresidingOfficer
        );
        assert_eq!(
            SpeakerType::detect("The SPEAKER pro tempore", "floor_speech", Some("House")),
            SpeakerType::PresidingOfficer
        );
    }

    #[test]
    fn detect_witness() {
        assert_eq!(
            SpeakerType::detect("Mr. SMITH", "hearing", Some("Senate")),
            SpeakerType::Witness
        );
        assert_eq!(
            SpeakerType::detect("Ms. JOHNSON", "hearing", Some("House")),
            SpeakerType::Witness
        );
        assert_eq!(
            SpeakerType::detect("Dr. WILLIAMS", "hearing", None),
            SpeakerType::Witness
        );
    }

    #[test]
    fn detect_floor_speech_by_chamber() {
        assert_eq!(
            SpeakerType::detect("Mr. JOHNSON", "floor_speech", Some("Senate")),
            SpeakerType::Senator
        );
        assert_eq!(
            SpeakerType::detect("Ms. PELOSI", "floor_speech", Some("House")),
            SpeakerType::Representative
        );
    }

    #[test]
    fn detect_chairman_by_chamber() {
        assert_eq!(
            SpeakerType::detect("Chairman CROW", "hearing", Some("House")),
            SpeakerType::Representative
        );
        assert_eq!(
            SpeakerType::detect("Chairwoman WATERS", "hearing", Some("House")),
            SpeakerType::Representative
        );
        assert_eq!(
            SpeakerType::detect("Chairman MENENDEZ", "hearing", Some("Senate")),
            SpeakerType::Senator
        );
    }
}
