//! REST API server for `PolSearch`

mod error;
mod models;
mod routes;

use axum::{routing::get, Router};
use color_eyre::eyre::Result;
use polsearch_db::Database;
use polsearch_pipeline::stages::TextEmbedder;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

/// Application state shared across handlers
pub struct AppState {
    pub db: Database,
    pub embedder: Mutex<TextEmbedder>,
    pub lancedb_path: String,
    pub search_timeout: Duration,
}

#[derive(OpenApi)]
#[openapi(
    paths(routes::health, routes::search),
    components(schemas(
        models::HealthResponse,
        models::SearchResponse,
        models::SearchResult,
        models::SearchMode,
        models::ContentType,
        models::ContextScope,
        models::Chamber
    )),
    info(
        title = "PolSearch API",
        description = "Search congressional hearings, floor speeches, and votes",
        version = "0.1.0"
    )
)]
struct ApiDoc;

#[tokio::main]
async fn main() -> Result<()> {
    color_eyre::install()?;

    // load .env
    dotenvy::dotenv().ok();

    // initialize tracing
    let log_level = std::env::var("LOG_LEVEL").unwrap_or_else(|_| "info".to_string());
    tracing_subscriber::fmt()
        .with_env_filter(log_level)
        .init();

    // load configuration
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(3000);

    let database_url = std::env::var("DATABASE_URL")?;
    let lancedb_path = std::env::var("LANCEDB_PATH")
        .unwrap_or_else(|_| shellexpand::tilde("~/.polsearch/lancedb").to_string());
    let search_timeout_secs: u64 = std::env::var("SEARCH_TIMEOUT_SECS")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(30);
    let search_timeout = Duration::from_secs(search_timeout_secs);

    // connect to PostgreSQL
    tracing::info!("Connecting to PostgreSQL...");
    let db = Database::connect(&database_url).await?;

    // initialize embedding model
    tracing::info!("Loading embedding model...");
    let embedder = TextEmbedder::new()?;

    let state = Arc::new(AppState {
        db,
        embedder: Mutex::new(embedder),
        lancedb_path,
        search_timeout,
    });

    // build router
    let app = Router::new()
        .route("/health", get(routes::health))
        .route("/search", get(routes::search))
        .merge(SwaggerUi::new("/swagger-ui").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .layer(CorsLayer::very_permissive())
        .layer(TraceLayer::new_for_http())
        .with_state(state);

    let addr = format!("0.0.0.0:{port}");
    tracing::info!("Starting server on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
