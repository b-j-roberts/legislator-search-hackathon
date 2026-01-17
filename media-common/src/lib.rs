/// Shared types for media appearance tracking
pub mod types;

/// Rate-limited HTTP client with retry support
pub mod client;

/// Member of Congress lookup and search
pub mod members;

pub use client::HttpClient;
pub use members::{Chamber, Member, MemberLookup, Party};
pub use types::{
    MediaAppearance, MediaAppearanceOutput, MediaInfo, Outlet, OutletType, OutputMetadata,
    SourceType,
};

/// Generate a unique event ID for a media appearance
pub fn generate_event_id(source: SourceType, external_id: &str) -> String {
    format!("{}_{}", source, external_id)
}

/// Write media appearances to a YAML file
pub fn write_yaml(output: &MediaAppearanceOutput, path: &str) -> eyre::Result<()> {
    use eyre::Context;
    let content = serde_yaml::to_string(output).wrap_err("failed to serialize to YAML")?;
    std::fs::write(path, content).wrap_err_with(|| format!("failed to write to {}", path))?;
    Ok(())
}

/// Read media appearances from a YAML file
pub fn read_yaml(path: &str) -> eyre::Result<MediaAppearanceOutput> {
    use eyre::Context;
    let content =
        std::fs::read_to_string(path).wrap_err_with(|| format!("failed to read {}", path))?;
    let output: MediaAppearanceOutput =
        serde_yaml::from_str(&content).wrap_err("failed to parse YAML")?;
    Ok(output)
}
