use eyre::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Chamber of Congress
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Chamber {
    House,
    Senate,
}

/// Political party affiliation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum Party {
    #[serde(alias = "D")]
    Democrat,
    #[serde(alias = "R")]
    Republican,
    #[serde(alias = "I")]
    Independent,
    #[serde(other)]
    Other,
}

/// Information about a member of Congress
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Member {
    pub bioguide_id: String,
    pub name: String,
    pub first_name: String,
    pub last_name: String,
    pub state: String,
    pub chamber: Chamber,
    pub party: Party,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub district: Option<String>,
}

impl Member {
    /// Create search variants of the member's name for fuzzy matching
    pub fn search_names(&self) -> Vec<String> {
        let mut names = vec![
            self.name.clone(),
            format!("{} {}", self.first_name, self.last_name),
            self.last_name.clone(),
            format!("Rep. {}", self.last_name),
            format!("Sen. {}", self.last_name),
            format!("Representative {}", self.last_name),
            format!("Senator {}", self.last_name),
        ];

        // add state-qualified versions
        names.push(format!("{} ({})", self.last_name, self.state));
        names.push(format!("{} {}", self.last_name, self.state));

        names
    }
}

/// Lookup service for members of Congress
pub struct MemberLookup {
    by_bioguide: HashMap<String, Member>,
    by_name_lower: HashMap<String, String>, // lowercase name -> bioguide_id
}

impl MemberLookup {
    /// Create an empty lookup
    pub fn new() -> Self {
        Self {
            by_bioguide: HashMap::new(),
            by_name_lower: HashMap::new(),
        }
    }

    /// Load members from a YAML file
    pub fn from_yaml(path: &str) -> Result<Self> {
        let content =
            std::fs::read_to_string(path).wrap_err_with(|| format!("failed to read {}", path))?;

        let members: Vec<Member> =
            serde_yaml::from_str(&content).wrap_err("failed to parse members YAML")?;

        let mut lookup = Self::new();
        for member in members {
            lookup.add_member(member);
        }
        Ok(lookup)
    }

    /// Load members from the @unitedstates/congress-legislators data
    pub fn from_legislators_yaml(current_path: &str, historical_path: Option<&str>) -> Result<Self> {
        let mut lookup = Self::new();

        // load current legislators
        lookup.load_legislators_file(current_path)?;

        // optionally load historical legislators
        if let Some(path) = historical_path {
            lookup.load_legislators_file(path)?;
        }

        Ok(lookup)
    }

    fn load_legislators_file(&mut self, path: &str) -> Result<()> {
        let content =
            std::fs::read_to_string(path).wrap_err_with(|| format!("failed to read {}", path))?;

        let legislators: Vec<LegislatorYaml> =
            serde_yaml::from_str(&content).wrap_err("failed to parse legislators YAML")?;

        for leg in legislators {
            if let Some(member) = Self::convert_legislator(leg) {
                self.add_member(member);
            }
        }

        Ok(())
    }

    fn convert_legislator(leg: LegislatorYaml) -> Option<Member> {
        let bioguide_id = leg.id.bioguide?;
        let name = leg.name;
        let first_name = name.first;
        let last_name = name.last;
        let full_name = format!("{} {}", first_name, last_name);

        // get most recent term
        let term = leg.terms.into_iter().last()?;

        let chamber = match term.term_type.as_str() {
            "sen" => Chamber::Senate,
            "rep" => Chamber::House,
            _ => return None,
        };

        let party = match term.party.as_deref() {
            Some("Democrat") => Party::Democrat,
            Some("Republican") => Party::Republican,
            Some("Independent") => Party::Independent,
            _ => Party::Other,
        };

        Some(Member {
            bioguide_id,
            name: full_name,
            first_name,
            last_name,
            state: term.state,
            chamber,
            party,
            district: term.district.map(|d| d.to_string()),
        })
    }

    /// Add a member to the lookup
    pub fn add_member(&mut self, member: Member) {
        // index by various name forms
        for name in member.search_names() {
            self.by_name_lower
                .insert(name.to_lowercase(), member.bioguide_id.clone());
        }

        self.by_bioguide.insert(member.bioguide_id.clone(), member);
    }

    /// Get a member by bioguide ID
    pub fn by_bioguide(&self, id: &str) -> Option<&Member> {
        self.by_bioguide.get(id)
    }

    /// Find a member by name (case-insensitive)
    pub fn by_name(&self, name: &str) -> Option<&Member> {
        let bioguide_id = self.by_name_lower.get(&name.to_lowercase())?;
        self.by_bioguide.get(bioguide_id)
    }

    /// Search for members matching a partial name
    pub fn search(&self, query: &str) -> Vec<&Member> {
        let query_lower = query.to_lowercase();
        let mut matches: Vec<&Member> = self
            .by_bioguide
            .values()
            .filter(|m| {
                m.name.to_lowercase().contains(&query_lower)
                    || m.last_name.to_lowercase().contains(&query_lower)
            })
            .collect();

        matches.sort_by(|a, b| a.last_name.cmp(&b.last_name));
        matches
    }

    /// Get all members
    pub fn all_members(&self) -> impl Iterator<Item = &Member> {
        self.by_bioguide.values()
    }

    /// Get member count
    pub fn len(&self) -> usize {
        self.by_bioguide.len()
    }

    /// Check if empty
    pub fn is_empty(&self) -> bool {
        self.by_bioguide.is_empty()
    }
}

impl Default for MemberLookup {
    fn default() -> Self {
        Self::new()
    }
}

// internal structs for parsing @unitedstates/congress-legislators format

#[derive(Debug, Deserialize)]
struct LegislatorYaml {
    id: LegislatorId,
    name: LegislatorName,
    terms: Vec<LegislatorTerm>,
}

#[derive(Debug, Deserialize)]
struct LegislatorId {
    bioguide: Option<String>,
}

#[derive(Debug, Deserialize)]
struct LegislatorName {
    first: String,
    last: String,
}

#[derive(Debug, Deserialize)]
struct LegislatorTerm {
    #[serde(rename = "type")]
    term_type: String,
    state: String,
    party: Option<String>,
    district: Option<u32>,
}
