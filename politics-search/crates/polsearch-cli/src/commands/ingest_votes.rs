//! Ingest congressional vote data command

use chrono::DateTime;
use color_eyre::eyre::{eyre, Result};
use colored::Colorize;
use dashmap::DashMap;
use polsearch_core::{IndividualVote, Legislator, Nomination, RollCallVote};
use polsearch_db::Database;
use rayon::prelude::*;
use serde::Deserialize;
use std::collections::HashMap;
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use walkdir::WalkDir;

use super::get_database;

/// Statistics for vote ingestion (atomic for parallel access)
#[derive(Debug, Default)]
pub struct AtomicIngestStats {
    pub files_processed: AtomicUsize,
    pub files_skipped: AtomicUsize,
    pub votes_created: AtomicUsize,
    pub individual_votes_created: AtomicUsize,
    pub legislators_created: AtomicUsize,
    pub nominations_created: AtomicUsize,
}

/// Statistics for vote ingestion (final values)
#[derive(Debug, Default)]
pub struct IngestStats {
    pub files_processed: usize,
    pub files_skipped: usize,
    pub votes_created: usize,
    pub individual_votes_created: usize,
    pub legislators_created: usize,
    pub nominations_created: usize,
}

impl AtomicIngestStats {
    fn to_stats(&self) -> IngestStats {
        IngestStats {
            files_processed: self.files_processed.load(Ordering::Relaxed),
            files_skipped: self.files_skipped.load(Ordering::Relaxed),
            votes_created: self.votes_created.load(Ordering::Relaxed),
            individual_votes_created: self.individual_votes_created.load(Ordering::Relaxed),
            legislators_created: self.legislators_created.load(Ordering::Relaxed),
            nominations_created: self.nominations_created.load(Ordering::Relaxed),
        }
    }
}

/// JSON structure for vote data files
#[derive(Debug, Deserialize)]
struct VoteJson {
    vote_id: String,
    congress: i16,
    chamber: String,
    session: String,
    number: i32,
    date: String,
    question: String,
    #[serde(rename = "type")]
    vote_type: Option<String>,
    category: Option<String>,
    subject: Option<String>,
    result: String,
    result_text: Option<String>,
    requires: Option<String>,
    source_url: Option<String>,
    nomination: Option<NominationJson>,
    votes: HashMap<String, Vec<VoterEntry>>,
}

#[derive(Debug, Deserialize)]
struct NominationJson {
    number: String,
    title: String,
}

/// A voter entry can be either a full voter object or just "VP" for Vice President tie-breakers
#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum VoterEntry {
    Voter(VoterJson),
    #[allow(dead_code)]
    VicePresident(String),
}

#[derive(Debug, Deserialize)]
struct VoterJson {
    id: String,
    display_name: String,
    party: String,
    state: String,
    first_name: Option<String>,
    last_name: Option<String>,
}

/// Run the ingest votes command
pub async fn run(
    path: &str,
    limit: Option<usize>,
    force: bool,
    dry_run: bool,
) -> Result<()> {
    let votes_path = Path::new(path);

    if !votes_path.exists() {
        return Err(eyre!("Votes directory not found: {}", path));
    }

    if dry_run {
        println!(
            "{}",
            format!("[DRY RUN] Would process vote files in {}", path).yellow()
        );

        let count = count_vote_files(votes_path, limit);
        println!(
            "Would process {} vote files{}",
            count.to_string().cyan(),
            if force { " (force mode)" } else { "" }
        );
        return Ok(());
    }

    println!(
        "{}",
        format!("Ingesting votes from {}...", path).cyan()
    );
    if force {
        println!("{}", "Force mode enabled - will re-process existing votes".yellow());
    }

    let db = get_database().await?;
    let stats = ingest_votes(&db, votes_path, limit, force).await?;

    println!();
    println!("{}", "Ingestion complete:".green().bold());
    println!(
        "  Files processed:    {}",
        stats.files_processed.to_string().cyan()
    );
    println!(
        "  Files skipped:      {}",
        stats.files_skipped.to_string().yellow()
    );
    println!(
        "  Votes created:      {}",
        stats.votes_created.to_string().cyan()
    );
    println!(
        "  Individual votes:   {}",
        stats.individual_votes_created.to_string().cyan()
    );
    println!(
        "  Legislators:        {}",
        stats.legislators_created.to_string().cyan()
    );
    println!(
        "  Nominations:        {}",
        stats.nominations_created.to_string().cyan()
    );

    Ok(())
}

fn count_vote_files(path: &Path, limit: Option<usize>) -> usize {
    let mut count = 0;
    for entry in WalkDir::new(path)
        .into_iter()
        .filter_map(|e: Result<walkdir::DirEntry, walkdir::Error>| e.ok())
    {
        if entry.path().file_name().is_some_and(|n| n == "data.json") {
            count += 1;
            if let Some(max) = limit {
                if count >= max {
                    break;
                }
            }
        }
    }
    count
}

async fn ingest_votes(
    db: &Database,
    path: &Path,
    limit: Option<usize>,
    force: bool,
) -> Result<IngestStats> {
    let stats = Arc::new(AtomicIngestStats::default());
    let legislator_cache: Arc<DashMap<String, uuid::Uuid>> = Arc::new(DashMap::new());

    let mut files: Vec<walkdir::DirEntry> = WalkDir::new(path)
        .into_iter()
        .filter_map(|e: Result<walkdir::DirEntry, walkdir::Error>| e.ok())
        .filter(|e: &walkdir::DirEntry| e.path().file_name().is_some_and(|n| n == "data.json"))
        .collect();

    files.sort_by(|a, b| a.path().cmp(b.path()));

    if let Some(max) = limit {
        files.truncate(max);
    }

    let total = files.len();
    let progress_counter = Arc::new(AtomicUsize::new(0));

    println!(
        "  Processing {} files in parallel...",
        total.to_string().cyan()
    );

    // get handle to current runtime for use in rayon threads
    let handle = tokio::runtime::Handle::current();

    // process files in parallel using rayon
    // use block_in_place to allow blocking within the async context
    tokio::task::block_in_place(|| {
        files.par_iter().for_each(|entry| {
            let file_path = entry.path();
            let db = db.clone();
            let stats = Arc::clone(&stats);
            let legislator_cache = Arc::clone(&legislator_cache);
            let progress_counter = Arc::clone(&progress_counter);

            // use the main runtime handle instead of creating new runtimes
            let result = handle.block_on(ingest_vote_file(&db, file_path, force, &legislator_cache, &stats));

            let current = progress_counter.fetch_add(1, Ordering::Relaxed) + 1;

            match result {
                Ok(created) => {
                    if created {
                        stats.files_processed.fetch_add(1, Ordering::Relaxed);
                    } else {
                        stats.files_skipped.fetch_add(1, Ordering::Relaxed);
                    }
                }
                Err(e) => {
                    eprintln!(
                        "  {} Failed to process {}: {}",
                        "Warning:".yellow(),
                        file_path.display(),
                        e
                    );
                    stats.files_skipped.fetch_add(1, Ordering::Relaxed);
                }
            }

            // progress every 500 files or at the end
            if current % 500 == 0 || current == total {
                println!(
                    "  Processed {}/{} files...",
                    current.to_string().cyan(),
                    total
                );
            }
        });
    });

    Ok(stats.to_stats())
}

async fn ingest_vote_file(
    db: &Database,
    path: &Path,
    force: bool,
    legislator_cache: &DashMap<String, uuid::Uuid>,
    stats: &AtomicIngestStats,
) -> Result<bool> {
    let content = std::fs::read_to_string(path)?;
    let vote_json: VoteJson = serde_json::from_str(&content)?;

    // check if already exists
    if !force && db.roll_call_votes().exists_by_vote_id(&vote_json.vote_id).await? {
        return Ok(false);
    }

    // parse date
    let vote_date = DateTime::parse_from_rfc3339(&vote_json.date)
        .or_else(|_| DateTime::parse_from_str(&vote_json.date, "%Y-%m-%dT%H:%M:%S%:z"))
        .map(|dt| dt.with_timezone(&chrono::Utc))
        .map_err(|e| eyre!("Failed to parse date '{}': {}", vote_json.date, e))?;

    // normalize chamber
    let chamber = match vote_json.chamber.as_str() {
        "h" => "House",
        "s" => "Senate",
        other => other,
    }.to_string();

    // handle nomination if present
    let nomination_id = if let Some(nom) = &vote_json.nomination {
        let nomination = Nomination::new(
            vote_json.congress,
            nom.number.clone(),
            nom.title.clone(),
            None,
        );
        let id = db.nominations().get_or_create(&nomination).await?;
        stats.nominations_created.fetch_add(1, Ordering::Relaxed);
        Some(id)
    } else {
        None
    };

    // count votes
    let mut yea_count = 0;
    let mut nay_count = 0;
    let mut present_count = 0;
    let mut not_voting_count = 0;

    for (position, voters) in &vote_json.votes {
        let normalized = normalize_position(position);
        let count = voters.len() as i32;
        match normalized.as_str() {
            "yea" => yea_count += count,
            "nay" => nay_count += count,
            "present" => present_count += count,
            "not_voting" => not_voting_count += count,
            _ => {}
        }
    }

    // create roll call vote
    let mut roll_call = RollCallVote::new(
        vote_json.vote_id.clone(),
        vote_json.congress,
        chamber.clone(),
        vote_json.session.clone(),
        vote_json.number,
        vote_date,
        vote_json.question.clone(),
        vote_json.result.clone(),
    );

    roll_call = roll_call.with_metadata(
        vote_json.vote_type.clone(),
        vote_json.category.clone(),
        vote_json.subject.clone(),
        vote_json.result_text.clone(),
        vote_json.requires.clone(),
        vote_json.source_url.clone(),
    );

    roll_call = roll_call.with_counts(yea_count, nay_count, present_count, not_voting_count);

    if let Some(nom_id) = nomination_id {
        roll_call = roll_call.with_nomination(nom_id);
    }

    db.roll_call_votes().create(&roll_call).await?;
    stats.votes_created.fetch_add(1, Ordering::Relaxed);

    // process individual votes
    let mut individual_votes = Vec::new();
    let is_senate = chamber == "Senate";

    for (position, voters) in &vote_json.votes {
        let normalized = normalize_position(position);

        for entry in voters {
            // skip VP (Vice President tie-breaker votes)
            let voter = match entry {
                VoterEntry::Voter(v) => v,
                VoterEntry::VicePresident(_) => continue,
            };

            // get or create legislator
            let legislator_id = get_or_create_legislator(
                db,
                voter,
                &chamber,
                is_senate,
                legislator_cache,
                stats,
            ).await?;

            let individual_vote = IndividualVote::new(
                roll_call.id,
                legislator_id,
                normalized.clone(),
                Some(position.clone()),
                voter.party.clone(),
                voter.state.clone(),
            );

            individual_votes.push(individual_vote);
        }
    }

    if !individual_votes.is_empty() {
        db.individual_votes().create_batch(&individual_votes).await?;
        stats.individual_votes_created.fetch_add(individual_votes.len(), Ordering::Relaxed);
    }

    Ok(true)
}

async fn get_or_create_legislator(
    db: &Database,
    voter: &VoterJson,
    _chamber: &str,
    is_senate: bool,
    cache: &DashMap<String, uuid::Uuid>,
    stats: &AtomicIngestStats,
) -> Result<uuid::Uuid> {
    // for senate, the id is LIS ID (e.g., "S354")
    // for house, the id is bioguide ID (e.g., "A000370")
    let cache_key = voter.id.clone();

    if let Some(id) = cache.get(&cache_key) {
        return Ok(*id);
    }

    let legislator = if is_senate {
        // senate uses LIS ID in the vote data
        // we need bioguide_id - for now use LIS as placeholder, will be updated later
        Legislator::from_senate_vote(
            voter.id.clone(), // using LIS as bioguide placeholder for now
            voter.id.clone(),
            voter.first_name.clone().unwrap_or_default(),
            voter.last_name.clone().unwrap_or_default(),
            voter.display_name.clone(),
            voter.party.clone(),
            voter.state.clone(),
        )
    } else {
        Legislator::from_house_vote(
            voter.id.clone(),
            voter.display_name.clone(),
            voter.party.clone(),
            voter.state.clone(),
        )
    };

    // check if exists
    let existing = if is_senate {
        db.legislators().get_by_lis(&voter.id).await?
    } else {
        db.legislators().get_by_bioguide(&voter.id).await?
    };

    let id = if let Some(existing) = existing {
        existing.id
    } else {
        db.legislators().create(&legislator).await?;
        stats.legislators_created.fetch_add(1, Ordering::Relaxed);
        legislator.id
    };

    cache.insert(cache_key, id);
    Ok(id)
}

fn normalize_position(raw: &str) -> String {
    match raw.to_lowercase().as_str() {
        "aye" | "yea" => "yea".to_string(),
        "no" | "nay" => "nay".to_string(),
        "present" => "present".to_string(),
        "not voting" => "not_voting".to_string(),
        other => other.to_lowercase().replace(' ', "_"),
    }
}
