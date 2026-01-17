use clap::{Parser, Subcommand};
use color_eyre::Result;

mod common;
mod release;
mod swift;
mod version;

#[derive(Parser)]
#[command(name = "xtask")]
#[command(about = "Build automation for polsearch")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Bump version: major, minor, or patch
    #[command(name = "bump-version")]
    BumpVersion {
        /// Version component to bump: 'major', 'minor', or 'patch'
        bump_type: String,
    },

    /// Build Swift library (with hash-based caching)
    #[command(name = "build-swift")]
    BuildSwift {
        /// Force rebuild even if up to date
        #[arg(long, short)]
        force: bool,
    },

    /// Build release and optionally install locally
    #[command(name = "release")]
    Release {
        /// Target: 'local' to install to ~/.local/bin
        #[arg(default_value = "local")]
        target: String,
    },
}

fn main() -> Result<()> {
    color_eyre::install()?;

    let cli = Cli::parse();

    match cli.command {
        Commands::BumpVersion { bump_type } => version::bump_version(bump_type),
        Commands::BuildSwift { force } => swift::build_swift(force),
        Commands::Release { target } => release::build_release(&target),
    }
}
