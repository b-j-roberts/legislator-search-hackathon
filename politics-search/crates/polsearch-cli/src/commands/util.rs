//! Utility commands for data transfer and deployment

use color_eyre::eyre::{bail, Result};
use std::process::Command;
use tracing::info;

/// Archive paths into a tarball for transfer
pub async fn archive(paths: &[String], output: &str) -> Result<()> {
    if paths.is_empty() {
        bail!("No paths specified for archiving");
    }

    // Expand tildes in paths
    let expanded_paths: Vec<String> = paths
        .iter()
        .map(|p| shellexpand::tilde(p).to_string())
        .collect();

    info!("Creating archive: {}", output);
    info!("Including paths: {:?}", expanded_paths);

    let mut cmd = Command::new("tar");
    cmd.arg("-czvf").arg(output);

    for path in &expanded_paths {
        cmd.arg(path);
    }

    let status = cmd.status()?;

    if !status.success() {
        bail!("tar command failed with exit code: {:?}", status.code());
    }

    info!("Archive created: {}", output);
    Ok(())
}

/// Push archive to remote server via rsync
pub async fn push(archive: &str, remote: &str) -> Result<()> {
    info!("Pushing {} to {}", archive, remote);

    let status = Command::new("rsync")
        .args(["-avz", "--progress", archive, remote])
        .status()?;

    if !status.success() {
        bail!("rsync command failed with exit code: {:?}", status.code());
    }

    info!("Push complete");
    Ok(())
}

/// Pull archive from remote server via rsync
pub async fn pull(remote: &str, output: &str) -> Result<()> {
    info!("Pulling {} to {}", remote, output);

    let status = Command::new("rsync")
        .args(["-avz", "--progress", remote, output])
        .status()?;

    if !status.success() {
        bail!("rsync command failed with exit code: {:?}", status.code());
    }

    info!("Pull complete");
    Ok(())
}

/// Extract archive to destination
pub async fn unarchive(archive: &str, dest: &str) -> Result<()> {
    let expanded_dest = shellexpand::tilde(dest).to_string();

    info!("Extracting {} to {}", archive, expanded_dest);

    // Create destination if it doesn't exist
    std::fs::create_dir_all(&expanded_dest)?;

    let status = Command::new("tar")
        .args(["-xzvf", archive, "-C", &expanded_dest])
        .status()?;

    if !status.success() {
        bail!("tar command failed with exit code: {:?}", status.code());
    }

    info!("Extraction complete");
    Ok(())
}
