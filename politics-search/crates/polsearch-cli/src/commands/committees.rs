//! Committees list command

use color_eyre::eyre::Result;
use colored::Colorize;

use super::get_database;

/// List all committees
pub async fn list(chamber: Option<String>, show_counts: bool) -> Result<()> {
    let db = get_database().await?;

    println!();
    println!("{}", "=== Committees ===".cyan().bold());

    if show_counts {
        let committees_with_counts = db.committees().get_with_counts().await?;

        if committees_with_counts.is_empty() {
            println!("{}", "No committees found".yellow());
            return Ok(());
        }

        // Filter by chamber if specified
        let filtered: Vec<_> = if let Some(ref c) = chamber {
            committees_with_counts
                .into_iter()
                .filter(|(comm, _)| {
                    comm.chamber.as_ref().is_some_and(|ch| ch.eq_ignore_ascii_case(c))
                })
                .collect()
        } else {
            committees_with_counts
        };

        for (committee, count) in filtered {
            let chamber_str = committee
                .chamber
                .as_ref()
                .map_or_else(|| "Joint".to_string(), Clone::clone);
            println!(
                "{} ({}) - {} hearings",
                committee.name.green(),
                chamber_str.dimmed(),
                count.to_string().cyan()
            );
            println!("  slug: {}", committee.slug.dimmed());
        }
    } else {
        let committees = if let Some(ref c) = chamber {
            db.committees().get_by_chamber(c).await?
        } else {
            db.committees().get_all().await?
        };

        if committees.is_empty() {
            println!("{}", "No committees found".yellow());
            return Ok(());
        }

        for committee in committees {
            let chamber_str = committee
                .chamber
                .as_ref()
                .map_or_else(|| "Joint".to_string(), Clone::clone);
            println!(
                "{} ({})",
                committee.name.green(),
                chamber_str.dimmed()
            );
            println!("  slug: {}", committee.slug.dimmed());
        }
    }

    println!();
    Ok(())
}

/// Search committees by name
pub async fn search(query: &str) -> Result<()> {
    let db = get_database().await?;

    println!();
    println!(
        "{}",
        format!("=== Committees matching \"{}\" ===", query).cyan().bold()
    );

    let committees = db.committees().search(query).await?;

    if committees.is_empty() {
        println!("{}", "No matching committees found".yellow());
        return Ok(());
    }

    for committee in committees {
        let chamber_str = committee
            .chamber
            .as_ref()
            .map_or_else(|| "Joint".to_string(), Clone::clone);
        println!(
            "{} ({})",
            committee.name.green(),
            chamber_str.dimmed()
        );
        println!("  slug: {}", committee.slug.dimmed());
    }

    println!();
    Ok(())
}
