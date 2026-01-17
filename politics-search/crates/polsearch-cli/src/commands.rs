pub mod backfill_batches;
pub mod backfill_duration;
pub mod backfill_speakers;
pub mod db;
pub mod fetch_episodes;
pub mod list_podcasts;
pub mod merge_speakers;
pub mod search;
pub mod seed;
pub mod speakers;
pub mod stats;
pub mod status;
pub mod transcribe_plan;
pub mod verify;

use color_eyre::eyre::Result;
use polsearch_db::Database;
use std::env;

pub async fn get_database() -> Result<Database> {
    let url = env::var("DATABASE_URL")?;
    let db = Database::connect(&url).await?;
    Ok(db)
}
