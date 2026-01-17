//! Seed podcasts from YAML into the database

use color_eyre::eyre::{Result, WrapErr};
use colored::Colorize;
use polsearch_core::{Source, SourceType};
use polsearch_util::slugify;
use serde::Deserialize;
use std::fs;
use std::path::Path;

use super::get_database;

#[derive(Debug, Deserialize)]
struct SourcesFile {
    podcasts: Vec<SourceEntry>,
}

#[derive(Debug, Deserialize)]
struct SourceEntry {
    name: String,
    rss_url: String,
    tier: i16,
    #[serde(default)]
    known_hosts: Vec<String>,
    artwork_url: Option<String>,
}

pub async fn run() -> Result<()> {
    let db = get_database().await?;

    // Look for podcasts.yaml in config/ directory
    let config_path = Path::new("config/podcasts.yaml");
    if !config_path.exists() {
        return Err(color_eyre::eyre::eyre!(
            "config/podcasts.yaml not found. Please create it first."
        ));
    }

    let content =
        fs::read_to_string(config_path).wrap_err("Failed to read config/podcasts.yaml")?;

    let podcasts_file: SourcesFile =
        serde_yaml::from_str(&content).wrap_err("Failed to parse config/podcasts.yaml")?;

    println!(
        "{}",
        format!(
            "Found {} podcasts in config/podcasts.yaml",
            podcasts_file.podcasts.len()
        )
        .dimmed()
    );

    let mut created = 0;
    let mut updated = 0;
    let mut skipped = 0;

    for entry in podcasts_file.podcasts {
        let slug = slugify(&entry.name);

        // Check if podcast already exists
        if let Some(mut existing) = db.podcasts().get_by_slug(&slug).await? {
            // Update if RSS URL changed
            if existing.url == entry.rss_url {
                println!(
                    "{}",
                    format!("Skipping {} (unchanged)", entry.name).dimmed()
                );
                skipped += 1;
            } else {
                existing.url = entry.rss_url;
                existing.tier = entry.tier;
                existing.known_hosts = entry.known_hosts;
                if let Some(url) = entry.artwork_url {
                    existing.artwork_url = Some(url);
                }
                db.podcasts().update(&existing).await?;
                println!("{} {} (RSS URL changed)", "Updated:".yellow(), entry.name);
                updated += 1;
            }
            continue;
        }

        let mut podcast = Source::new(entry.name.clone(), slug, entry.rss_url, entry.tier, SourceType::Audio);
        podcast = podcast.with_known_hosts(entry.known_hosts);
        if let Some(url) = entry.artwork_url {
            podcast = podcast.with_artwork_url(url);
        }

        db.podcasts().create(&podcast).await?;
        println!("{} {}", "Created:".green(), entry.name);
        created += 1;
    }

    println!(
        "{} Created: {}, Updated: {}, Skipped: {}",
        "Done!".green().bold(),
        created.to_string().cyan(),
        updated.to_string().cyan(),
        skipped.to_string().dimmed()
    );
    Ok(())
}
