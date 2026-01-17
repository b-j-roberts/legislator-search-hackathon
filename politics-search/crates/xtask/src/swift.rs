use crate::common::print_success;
use color_eyre::Result;
use colored::Colorize;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;
use xshell::{Shell, cmd};

const SWIFT_DIR: &str = "swift/PolSearchSwift";
const SOURCES_DIR: &str = "swift/PolSearchSwift/Sources";
const DYLIB_PATH: &str = "swift/PolSearchSwift/.build/release/libPolSearchSwift.dylib";
const HASH_FILE: &str = "swift/PolSearchSwift/.build/.source-hash";

/// Build Swift library if sources have changed
pub fn build_swift(force: bool) -> Result<()> {
    let sh = Shell::new()?;

    if !Path::new(SWIFT_DIR).exists() {
        color_eyre::eyre::bail!("Swift directory not found at {SWIFT_DIR}");
    }

    if force {
        println!("{}", "Force rebuilding Swift library...".blue());
        do_build(&sh)?;
        print_success("Swift library built");
        return Ok(());
    }

    let current_hash = compute_source_hash()?;

    if !needs_rebuild(&current_hash) {
        println!("{}", "Swift library up to date".green());
        return Ok(());
    }

    println!("{}", "Building Swift library...".blue());
    do_build(&sh)?;

    // store the hash
    fs::write(HASH_FILE, &current_hash)?;
    print_success("Swift library built");

    Ok(())
}

fn compute_source_hash() -> Result<String> {
    let mut hasher = Sha256::new();
    let mut swift_files: Vec<_> = walkdir::WalkDir::new(SOURCES_DIR)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.path().extension().is_some_and(|ext| ext == "swift"))
        .collect();

    // sort for consistent ordering
    swift_files.sort_by(|a, b| a.path().cmp(b.path()));

    for entry in swift_files {
        let contents = fs::read(entry.path())?;
        hasher.update(&contents);
    }

    let hash = format!("{:x}", hasher.finalize());
    Ok(hash)
}

fn needs_rebuild(current_hash: &str) -> bool {
    if !Path::new(DYLIB_PATH).exists() {
        return true;
    }

    if !Path::new(HASH_FILE).exists() {
        return true;
    }

    let stored_hash = fs::read_to_string(HASH_FILE).unwrap_or_default();
    stored_hash.trim() != current_hash
}

fn do_build(sh: &Shell) -> Result<()> {
    let swift_dir = Path::new(SWIFT_DIR);
    let _dir = sh.push_dir(swift_dir);
    cmd!(sh, "swift build -c release").run()?;
    Ok(())
}
