use crate::common::print_success;
use color_eyre::Result;
use colored::Colorize;
use std::path::PathBuf;
use xshell::{Shell, cmd};

const BINARY_NAME: &str = "polsearch";
const RELEASE_BINARY: &str = "target/release/polsearch";

/// Build release binary and optionally install to local bin
pub fn build_release(target: &str) -> Result<()> {
    let sh = Shell::new()?;

    println!("{}", "Building release...".blue());
    cmd!(sh, "cargo build --release -p polsearch-cli").run()?;
    print_success("Release build complete");

    match target {
        "local" => install_local(&sh)?,
        _ => println!("{}", format!("Unknown target: {target}").yellow()),
    }

    Ok(())
}

fn install_local(sh: &Shell) -> Result<()> {
    let home = std::env::var("HOME")?;
    let bin_dir = PathBuf::from(&home).join(".local/bin");

    // ensure directory exists
    if !bin_dir.exists() {
        std::fs::create_dir_all(&bin_dir)?;
    }

    let dest = bin_dir.join(BINARY_NAME);
    cmd!(sh, "cp {RELEASE_BINARY} {dest}").run()?;

    print_success(&format!("Installed {BINARY_NAME} to {}", dest.display()));
    Ok(())
}
