//! Merge duplicate speakers

use color_eyre::eyre::{Result, bail};
use colored::Colorize;
use uuid::Uuid;

use super::get_database;

pub async fn run(from_id: &str, into_id: &str) -> Result<()> {
    let db = get_database().await?;

    let from_uuid: Uuid = from_id
        .parse()
        .map_err(|_| color_eyre::eyre::eyre!("Invalid UUID for --from: {}", from_id))?;

    let into_uuid: Uuid = into_id
        .parse()
        .map_err(|_| color_eyre::eyre::eyre!("Invalid UUID for --into: {}", into_id))?;

    if from_uuid == into_uuid {
        bail!("Cannot merge speaker into itself");
    }

    // Verify both speakers exist
    let from_speaker = db
        .speakers()
        .get_by_id(from_uuid)
        .await?
        .ok_or_else(|| color_eyre::eyre::eyre!("Speaker not found: {}", from_id))?;

    let into_speaker = db
        .speakers()
        .get_by_id(into_uuid)
        .await?
        .ok_or_else(|| color_eyre::eyre::eyre!("Speaker not found: {}", into_id))?;

    // Check if from_speaker is already merged
    if from_speaker.is_merged() {
        bail!(
            "Speaker {} is already merged into another speaker",
            from_speaker.name.as_deref().unwrap_or("(unnamed)")
        );
    }

    // Perform the merge
    db.speakers().merge(from_uuid, into_uuid).await?;

    let from_name = from_speaker.name.as_deref().unwrap_or("(unnamed)");
    let into_name = into_speaker.name.as_deref().unwrap_or("(unnamed)");

    println!(
        "{} '{}' into '{}'",
        "Merged speaker".green().bold(),
        from_name.cyan(),
        into_name.cyan()
    );
    println!("  {}: {}", "From ID".dimmed(), from_uuid);
    println!("  {}: {}", "Into ID".dimmed(), into_uuid);

    Ok(())
}
