//! Content detail endpoint

use axum::extract::{Path, State};
use axum::Json;
use std::sync::Arc;
use uuid::Uuid;

use crate::error::ApiError;
use crate::models::ContentDetailResponse;
use crate::AppState;

/// Get content details by ID
///
/// Returns full metadata for a hearing or floor speech by its ID.
#[utoipa::path(
    get,
    path = "/content/{id}",
    params(
        ("id" = Uuid, Path, description = "Content ID (UUID)")
    ),
    responses(
        (status = 200, description = "Content details", body = ContentDetailResponse),
        (status = 404, description = "Content not found"),
        (status = 500, description = "Internal error")
    )
)]
pub async fn get_content(
    State(state): State<Arc<AppState>>,
    Path(id): Path<Uuid>,
) -> Result<Json<ContentDetailResponse>, ApiError> {
    // try to find as hearing first
    if let Some(hearing) = state.db.hearings().get_by_id(id).await? {
        let chambers_str = hearing.chambers.join(", ");

        return Ok(Json(ContentDetailResponse {
            id: hearing.id,
            content_type: "hearing".to_string(),
            title: hearing.title,
            date: Some(hearing.hearing_date.format("%Y-%m-%d").to_string()),
            source_url: Some(hearing.source_url),
            committee: hearing.committee_raw,
            chambers: Some(chambers_str),
            congress: Some(hearing.congress),
            page_type: None,
            total_statements: hearing.total_statements,
            total_segments: hearing.total_segments,
        }));
    }

    // try to find as floor speech
    if let Some(speech) = state.db.floor_speeches().get_by_id(id).await? {
        return Ok(Json(ContentDetailResponse {
            id: speech.id,
            content_type: "floor_speech".to_string(),
            title: speech.title,
            date: Some(speech.speech_date.format("%Y-%m-%d").to_string()),
            source_url: Some(speech.source_url),
            committee: None,
            chambers: Some(speech.chamber.clone()),
            congress: None,
            page_type: Some(speech.page_type),
            total_statements: speech.total_statements,
            total_segments: speech.total_segments,
        }));
    }

    Err(ApiError::NotFound {
        message: format!("Content with ID {} not found", id),
    })
}
