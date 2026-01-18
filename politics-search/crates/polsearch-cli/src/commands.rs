pub mod committees;
pub mod db;
pub mod embed_votes;
pub mod fetch_floor_speeches;
pub mod fts;
pub mod ingest_floor_speeches;
pub mod ingest_hearings;
pub mod ingest_votes;
pub mod missing_hearings;
pub mod search;

use color_eyre::eyre::Result;
use polsearch_db::Database;
use std::env;

pub async fn get_database() -> Result<Database> {
    let url = env::var("DATABASE_URL")?;
    let db = Database::connect(&url).await?;
    Ok(db)
}
