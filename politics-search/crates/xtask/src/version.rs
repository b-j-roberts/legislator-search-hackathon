use crate::common::print_success;
use color_eyre::{Result, eyre::ContextCompat};
use colored::Colorize;
use xshell::{Shell, cmd};

const CARGO_TOML_PATH: &str = "Cargo.toml";

pub fn bump_version(bump_type: String) -> Result<()> {
    let sh = Shell::new()?;

    // ensure we're in the project root
    if !sh.path_exists(CARGO_TOML_PATH) {
        color_eyre::eyre::bail!("Cargo.toml not found. Run from the project root.");
    }

    let cargo_toml = sh.read_file(CARGO_TOML_PATH)?;

    // extract current version from [workspace.package]
    let current_version = extract_workspace_version(&cargo_toml)
        .context("Could not find version in [workspace.package]")?;

    println!("{} {current_version}", "Current version:".blue().bold());

    // calculate new version
    let new_version = calculate_bumped_version(&current_version, &bump_type)?;
    println!("{} {new_version}", "Bumping to:".green().bold());

    // update Cargo.toml
    let new_cargo_toml = cargo_toml.replace(
        &format!("version = \"{current_version}\""),
        &format!("version = \"{new_version}\""),
    );
    sh.write_file(CARGO_TOML_PATH, new_cargo_toml)?;
    print_success("Updated Cargo.toml");

    // update Cargo.lock
    println!("{}", "Updating Cargo.lock...".dimmed());
    cmd!(sh, "cargo update -p polsearch-cli").run()?;

    println!(
        "{} Version bumped to {new_version}",
        "SUCCESS:".green().bold()
    );
    Ok(())
}

fn extract_workspace_version(content: &str) -> Option<String> {
    // look for version = "x.y.z" in the [workspace.package] section
    let workspace_package_start = content.find("[workspace.package]")?;
    let section_content = &content[workspace_package_start..];

    // find the next section boundary or end of file
    let section_end = section_content[1..]
        .find("\n[")
        .map(|i| i + 1)
        .unwrap_or(section_content.len());

    let section = &section_content[..section_end];

    // find version line in this section
    for line in section.lines() {
        let line = line.trim();
        if line.starts_with("version = ") {
            return line.split('"').nth(1).map(|s| s.to_string());
        }
    }
    None
}

fn calculate_bumped_version(current_version: &str, bump_type: &str) -> Result<String> {
    let parts: Vec<&str> = current_version.split('.').collect();
    if parts.len() != 3 {
        color_eyre::eyre::bail!("Version must be x.y.z, got: {}", current_version);
    }

    let (mut major, mut minor, mut patch) = (
        parts[0].parse::<u32>()?,
        parts[1].parse::<u32>()?,
        parts[2].parse::<u32>()?,
    );

    match bump_type {
        "major" => {
            major += 1;
            minor = 0;
            patch = 0;
        }
        "minor" => {
            minor += 1;
            patch = 0;
        }
        "patch" => {
            patch += 1;
        }
        _ => color_eyre::eyre::bail!("Bump type must be 'major', 'minor', or 'patch'"),
    }

    Ok(format!("{major}.{minor}.{patch}"))
}
