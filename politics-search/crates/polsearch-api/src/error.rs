//! API error types

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde::Serialize;
use std::fmt;

#[derive(Debug)]
pub enum ApiError {
    Validation { message: String, field: Option<String> },
    NotFound { message: String },
    Internal(String),
}

impl fmt::Display for ApiError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Validation { message, .. } => write!(f, "Validation error: {message}"),
            Self::NotFound { message } => write!(f, "Not found: {message}"),
            Self::Internal(msg) => write!(f, "Internal error: {msg}"),
        }
    }
}

#[derive(Serialize)]
struct ErrorResponse {
    error: &'static str,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    field: Option<String>,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let (status, error_type, message, field) = match self {
            Self::Validation { message, field } => {
                (StatusCode::BAD_REQUEST, "validation_error", message, field)
            }
            Self::NotFound { message } => {
                (StatusCode::NOT_FOUND, "not_found", message, None)
            }
            Self::Internal(msg) => {
                tracing::error!("Internal error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, "internal_error", "Operation failed".to_string(), None)
            }
        };

        let body = ErrorResponse {
            error: error_type,
            message,
            field,
        };

        (status, axum::Json(body)).into_response()
    }
}

impl From<color_eyre::Report> for ApiError {
    fn from(err: color_eyre::Report) -> Self {
        Self::Internal(err.to_string())
    }
}

impl From<lancedb::Error> for ApiError {
    fn from(err: lancedb::Error) -> Self {
        Self::Internal(err.to_string())
    }
}

impl From<polsearch_db::DbError> for ApiError {
    fn from(err: polsearch_db::DbError) -> Self {
        Self::Internal(err.to_string())
    }
}
