use axum::{
    extract::Request,
    http::{header::AUTHORIZATION, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
};

pub async fn require_auth(request: Request, next: Next) -> Response {
    let Ok(auth_token) = std::env::var("API_AUTH_TOKEN") else {
        return next.run(request).await;
    };

    if auth_token.is_empty() {
        return next.run(request).await;
    }

    let auth_header = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|h| h.to_str().ok());

    match auth_header {
        Some(header) if header.strip_prefix("Bearer ").is_some_and(|t| t == auth_token) => {
            next.run(request).await
        }
        _ => (
            StatusCode::UNAUTHORIZED,
            [("WWW-Authenticate", "Bearer")],
            axum::Json(serde_json::json!({
                "error": "unauthorized",
                "message": "Invalid or missing Bearer token"
            })),
        )
            .into_response(),
    }
}
