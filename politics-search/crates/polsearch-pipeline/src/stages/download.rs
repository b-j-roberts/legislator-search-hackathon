//! Audio download stage with automatic retries

use backon::{ExponentialBuilder, Retryable};
use md5::Digest;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tokio::io::AsyncWriteExt;
use tokio_stream::StreamExt;

/// Download audio with automatic retries using backon
///
/// # Errors
/// Returns an error if download fails after all retries
pub async fn download_audio(
    client: &reqwest::Client,
    content_url: &str,
    output_dir: &Path,
) -> color_eyre::Result<PathBuf> {
    let download = || async { do_download(client, content_url, output_dir).await };

    download
        .retry(
            ExponentialBuilder::default()
                .with_max_times(3)
                .with_min_delay(Duration::from_secs(2))
                .with_max_delay(Duration::from_secs(30)),
        )
        .when(is_retryable_error)
        .notify(|err, dur| {
            tracing::warn!("Download failed, retrying in {:?}: {}", dur, err);
        })
        .await
}

/// Check if error is worth retrying
fn is_retryable_error(err: &color_eyre::Report) -> bool {
    let msg = err.to_string();
    // retry on network errors and 5xx, but not 404
    msg.contains("timeout")
        || msg.contains("connection")
        || msg.contains("HTTP 5")
        || msg.contains("HTTP 429")
}

async fn do_download(
    client: &reqwest::Client,
    content_url: &str,
    output_dir: &Path,
) -> color_eyre::Result<PathBuf> {
    let response = client.get(content_url).send().await?;

    if !response.status().is_success() {
        color_eyre::eyre::bail!("HTTP {}: {}", response.status(), content_url);
    }

    // determine extension from content-type
    let content_type = response
        .headers()
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("audio/mpeg");

    let extension = match content_type {
        "audio/mp4" | "audio/m4a" => "m4a",
        "audio/wav" | "audio/x-wav" => "wav",
        _ => "mp3",
    };

    // generate filename from URL hash
    let hash = md5::Md5::digest(content_url);
    let filename = format!("{hash:x}.{extension}");
    let output_path = output_dir.join(&filename);

    tokio::fs::create_dir_all(output_dir).await?;

    // stream to file
    let mut file = tokio::fs::File::create(&output_path).await?;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        file.write_all(&chunk?).await?;
    }

    Ok(output_path)
}
