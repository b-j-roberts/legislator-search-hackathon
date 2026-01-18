//! Search endpoint

use arrow_array::{Array, RecordBatch};
use axum::extract::{Query, State};
use axum::Json;
use futures::TryStreamExt;
use lancedb::index::scalar::FullTextSearchQuery;
use lancedb::query::{ExecutableQuery, QueryBase};
use lancedb::Error as LanceError;
use polsearch_db::Database;
use polsearch_pipeline::stages::{TextEmbedder, FTS_TABLE_NAME};
use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use uuid::Uuid;

use crate::error::ApiError;
use crate::models::{
    Chamber, ContentType, SearchMode as RequestMode, SearchParams, SearchResponse, SearchResult,
};
use crate::AppState;

/// Check if a `LanceDB` error is due to a missing FTS inverted index
fn is_missing_fts_index_error(e: &LanceError) -> bool {
    let msg = e.to_string();
    msg.contains("INVERTED index") || msg.contains("full text search")
}

/// Raw search result from `LanceDB`
struct RawSearchResult {
    content_id: Uuid,
    content_id_str: String,
    segment_index: i32,
    text: String,
    start_time_ms: i32,
    end_time_ms: i32,
    score: f32,
    content_type: String,
    speaker_name: Option<String>,
    title: Option<String>,
}

/// Internal search mode tracking (for fallback detection)
#[derive(Clone, Copy)]
enum InternalMode {
    Hybrid,
    Vector,
    Fts,
    Phrase,
}

impl InternalMode {
    const fn as_str(self) -> &'static str {
        match self {
            Self::Hybrid => "hybrid",
            Self::Vector => "vector",
            Self::Fts => "fts",
            Self::Phrase => "phrase",
        }
    }
}

impl From<RequestMode> for InternalMode {
    fn from(mode: RequestMode) -> Self {
        match mode {
            RequestMode::Hybrid => Self::Hybrid,
            RequestMode::Vector => Self::Vector,
            RequestMode::Fts => Self::Fts,
            RequestMode::Phrase => Self::Phrase,
        }
    }
}

/// Build content type filter for `LanceDB`
fn build_content_type_filter(types: &[ContentType]) -> Option<String> {
    if types.is_empty() || types.iter().any(|t| matches!(t, ContentType::All)) {
        return None;
    }

    let type_values: Vec<&str> = types
        .iter()
        .filter_map(|t| match t {
            ContentType::All => None,
            ContentType::Hearing => Some("hearing"),
            ContentType::FloorSpeech => Some("floor_speech"),
            ContentType::Vote => Some("vote"),
        })
        .collect();

    if type_values.is_empty() {
        None
    } else {
        Some(format!(
            "content_type IN ({})",
            type_values.iter().map(|t| format!("'{t}'")).collect::<Vec<_>>().join(", ")
        ))
    }
}

/// Filter parameters for `PostgreSQL` pre-filtering
struct FilterParams<'a> {
    chamber: Option<&'a Chamber>,
    committee: Option<&'a str>,
    congress: Option<i16>,
    from_date: Option<&'a str>,
    to_date: Option<&'a str>,
    speaker: Option<&'a str>,
}

impl<'a> FilterParams<'a> {
    const fn has_pg_filters(&self) -> bool {
        self.chamber.is_some()
            || self.committee.is_some()
            || self.congress.is_some()
            || self.from_date.is_some()
            || self.to_date.is_some()
    }
}

/// Build speaker name filter for `LanceDB` (case-insensitive LIKE)
fn build_speaker_filter(speaker: &str) -> String {
    let escaped = speaker.replace('\'', "''").replace('%', "\\%");
    format!("LOWER(speaker_name) LIKE '%{}%'", escaped.to_lowercase())
}

/// Get filtered content IDs from `PostgreSQL` based on filter params
async fn get_filtered_content_ids(
    db: &Database,
    content_types: &[ContentType],
    filters: &FilterParams<'_>,
) -> Result<Option<HashSet<Uuid>>, ApiError> {
    if !filters.has_pg_filters() {
        return Ok(None);
    }

    let chamber_str = filters.chamber.map(|c| match c {
        Chamber::House => "House",
        Chamber::Senate => "Senate",
    });

    let mut all_ids = HashSet::new();

    let includes_hearings = content_types.iter().any(|t| matches!(t, ContentType::All | ContentType::Hearing));
    let includes_floor_speeches = content_types.iter().any(|t| matches!(t, ContentType::All | ContentType::FloorSpeech));

    // get hearing IDs if hearings are included
    if includes_hearings {
        let hearing_ids = db
            .hearings()
            .get_filtered_ids(
                chamber_str,
                filters.committee,
                filters.congress,
                filters.from_date,
                filters.to_date,
            )
            .await?;
        all_ids.extend(hearing_ids);
    }

    // get floor speech IDs if floor speeches are included
    if includes_floor_speeches {
        let floor_speech_ids = db
            .floor_speeches()
            .get_filtered_ids(chamber_str, filters.from_date, filters.to_date)
            .await?;
        all_ids.extend(floor_speech_ids);
    }

    Ok(Some(all_ids))
}

/// Build `content_id` IN filter for `LanceDB`
fn build_content_id_filter(ids: &HashSet<Uuid>) -> Option<String> {
    if ids.is_empty() {
        return None;
    }

    // limit to avoid overly long filter expressions
    let id_strs: Vec<String> = ids.iter().take(1000).map(|id| format!("'{id}'")).collect();
    Some(format!("content_id IN ({})", id_strs.join(", ")))
}

/// Combine multiple filter expressions with AND
fn combine_filters(filters: Vec<Option<String>>) -> Option<String> {
    let active: Vec<String> = filters.into_iter().flatten().collect();
    if active.is_empty() {
        None
    } else if active.len() == 1 {
        Some(active.into_iter().next().unwrap_or_default())
    } else {
        Some(active.into_iter().map(|f| format!("({f})")).collect::<Vec<_>>().join(" AND "))
    }
}

/// Normalize score to 0-1 range based on search mode
fn normalize_score(score: f32, mode: InternalMode, max_score: f32) -> f32 {
    match mode {
        InternalMode::Hybrid => (score / 0.05).min(1.0),
        InternalMode::Vector => (1.0 - score / 2.0).clamp(0.0, 1.0),
        InternalMode::Fts => {
            if max_score > 0.0 {
                (score / max_score).min(1.0)
            } else {
                0.0
            }
        }
        InternalMode::Phrase => 1.0,
    }
}

/// Execute search against `LanceDB`
async fn execute_search(
    lancedb_path: &str,
    query: &str,
    limit: usize,
    mode: InternalMode,
    type_filter: Option<&str>,
    embedder: &mut TextEmbedder,
) -> Result<(Vec<RawSearchResult>, InternalMode), ApiError> {
    let db = lancedb::connect(lancedb_path).execute().await?;
    let filter_expr = type_filter.map(ToString::to_string);
    let mut mode_used = mode;

    let batches: Vec<RecordBatch> = match mode {
        InternalMode::Vector => {
            let table = db.open_table("text_embeddings").execute().await?;
            let query_embedding = embedder.embed(query)?;

            let mut search = table.vector_search(query_embedding)?;
            if let Some(ref filter) = filter_expr {
                search = search.only_if(filter.clone());
            }
            search.limit(limit).execute().await?.try_collect().await?
        }
        InternalMode::Fts => {
            let fts_table = db.open_table(FTS_TABLE_NAME).execute().await.ok();
            let embeddings_table = db.open_table("text_embeddings").execute().await?;

            let try_fts = |table: lancedb::Table, filter: Option<String>| async move {
                let mut search = table
                    .query()
                    .full_text_search(FullTextSearchQuery::new(query.to_string()));
                if let Some(ref f) = filter {
                    search = search.only_if(f.clone());
                }
                search.limit(limit).execute().await
            };

            let result = if let Some(fts_t) = fts_table {
                match try_fts(fts_t, filter_expr.clone()).await {
                    Ok(stream) => Ok(stream),
                    Err(e) if is_missing_fts_index_error(&e) => {
                        try_fts(embeddings_table.clone(), filter_expr.clone()).await
                    }
                    Err(e) => Err(e),
                }
            } else {
                try_fts(embeddings_table.clone(), filter_expr.clone()).await
            };

            match result {
                Ok(stream) => stream.try_collect().await?,
                Err(e) if is_missing_fts_index_error(&e) => {
                    tracing::error!("FTS index not found, falling back to vector search");
                    mode_used = InternalMode::Vector;
                    let query_embedding = embedder.embed(query)?;
                    let mut vector_search = embeddings_table.vector_search(query_embedding)?;
                    if let Some(ref filter) = filter_expr {
                        vector_search = vector_search.only_if(filter.clone());
                    }
                    vector_search.limit(limit).execute().await?.try_collect().await?
                }
                Err(e) => return Err(e.into()),
            }
        }
        InternalMode::Hybrid => {
            let table = db.open_table("text_embeddings").execute().await?;
            let query_embedding = embedder.embed(query)?;

            let mut search = table
                .vector_search(query_embedding.clone())?
                .full_text_search(FullTextSearchQuery::new(query.to_string()));
            if let Some(ref filter) = filter_expr {
                search = search.only_if(filter.clone());
            }

            match search.limit(limit).execute().await {
                Ok(stream) => stream.try_collect().await?,
                Err(e) if is_missing_fts_index_error(&e) => {
                    tracing::error!("FTS index not found, falling back to vector search");
                    mode_used = InternalMode::Vector;
                    let mut vector_search = table.vector_search(query_embedding)?;
                    if let Some(ref filter) = filter_expr {
                        vector_search = vector_search.only_if(filter.clone());
                    }
                    vector_search.limit(limit).execute().await?.try_collect().await?
                }
                Err(e) => return Err(e.into()),
            }
        }
        InternalMode::Phrase => {
            let table = match db.open_table(FTS_TABLE_NAME).execute().await {
                Ok(t) => t,
                Err(_) => db.open_table("text_embeddings").execute().await?,
            };

            let escaped_query = query.replace('\'', "''").replace('%', "\\%");
            let like_filter = format!("text LIKE '%{escaped_query}%'");

            let combined_filter = match filter_expr {
                Some(ref type_filter) => format!("({type_filter}) AND ({like_filter})"),
                None => like_filter,
            };

            table
                .query()
                .only_if(combined_filter)
                .limit(limit)
                .execute()
                .await?
                .try_collect()
                .await?
        }
    };

    let results = parse_search_results(&batches, mode_used)?;
    Ok((results, mode_used))
}

/// Parse `LanceDB` results into `RawSearchResult` structs
fn parse_search_results(
    batches: &[RecordBatch],
    mode: InternalMode,
) -> Result<Vec<RawSearchResult>, ApiError> {
    use arrow_array::{Float32Array, Int32Array, StringArray};

    let mut results = Vec::new();
    let is_fts_table = matches!(mode, InternalMode::Fts | InternalMode::Phrase);

    for batch in batches {
        // skip empty batches
        if batch.num_rows() == 0 {
            continue;
        }

        let relevance_scores = batch
            .column_by_name("_relevance_score")
            .and_then(|c| c.as_any().downcast_ref::<Float32Array>());

        let distances = batch
            .column_by_name("_distance")
            .and_then(|c| c.as_any().downcast_ref::<Float32Array>());

        let fts_scores = batch
            .column_by_name("_score")
            .and_then(|c| c.as_any().downcast_ref::<Float32Array>());

        let content_ids = batch
            .column_by_name("content_id")
            .and_then(|c| c.as_any().downcast_ref::<StringArray>())
            .ok_or_else(|| ApiError::Internal("Missing content_id column".into()))?;

        let segment_indices = batch
            .column_by_name("segment_index")
            .and_then(|c| c.as_any().downcast_ref::<Int32Array>())
            .ok_or_else(|| ApiError::Internal("Missing segment_index column".into()))?;

        let start_times = batch
            .column_by_name("start_time_ms")
            .and_then(|c| c.as_any().downcast_ref::<Int32Array>());

        let end_times = batch
            .column_by_name("end_time_ms")
            .and_then(|c| c.as_any().downcast_ref::<Int32Array>());

        if !is_fts_table && (start_times.is_none() || end_times.is_none()) {
            return Err(ApiError::Internal("Missing time columns".into()));
        }

        let texts = batch
            .column_by_name("text")
            .and_then(|c| c.as_any().downcast_ref::<StringArray>())
            .ok_or_else(|| ApiError::Internal("Missing text column".into()))?;

        let content_types = batch
            .column_by_name("content_type")
            .and_then(|c| c.as_any().downcast_ref::<StringArray>());

        let speaker_names = batch
            .column_by_name("speaker_name")
            .and_then(|c| c.as_any().downcast_ref::<StringArray>());

        for i in 0..batch.num_rows() {
            let content_id_str = content_ids.value(i);
            // FTS table uses package_id strings, embeddings table uses UUIDs
            // Try to parse as UUID, fall back to nil UUID (enrichment will use content_id_str)
            let content_id = Uuid::parse_str(content_id_str).unwrap_or(Uuid::nil());

            let score = relevance_scores
                .map(|s| s.value(i))
                .or_else(|| distances.map(|d| d.value(i)))
                .or_else(|| fts_scores.map(|s| s.value(i)))
                .unwrap_or(0.0);

            let content_type = content_types
                .and_then(|ct| {
                    if ct.is_null(i) {
                        None
                    } else {
                        Some(ct.value(i).to_string())
                    }
                })
                .unwrap_or_else(|| "unknown".to_string());

            let speaker_name = speaker_names.and_then(|sn| {
                if sn.is_null(i) {
                    None
                } else {
                    Some(sn.value(i).to_string())
                }
            });

            results.push(RawSearchResult {
                content_id,
                content_id_str: content_id_str.to_string(),
                segment_index: segment_indices.value(i),
                text: texts.value(i).to_string(),
                start_time_ms: start_times.map_or(0, |t| t.value(i)),
                end_time_ms: end_times.map_or(0, |t| t.value(i)),
                score,
                content_type,
                speaker_name,
                title: None,
            });
        }
    }

    Ok(results)
}

/// Enrich search results with metadata from `PostgreSQL`
async fn enrich_results(results: &mut [SearchResult], db: &Database) -> Result<(), ApiError> {
    if results.is_empty() {
        return Ok(());
    }

    // separate results by whether they have a valid UUID or need string-based lookup
    let mut hearing_ids: Vec<Uuid> = Vec::new();
    let mut hearing_package_ids: Vec<String> = Vec::new();
    let mut hearing_segment_keys: Vec<(Uuid, i32)> = Vec::new();
    let mut floor_speech_ids: Vec<Uuid> = Vec::new();
    let mut floor_speech_event_ids: Vec<String> = Vec::new();
    let mut floor_speech_segment_keys: Vec<(Uuid, i32)> = Vec::new();

    for r in results.iter() {
        let is_nil = r.content_id.is_nil();
        match r.content_type.as_str() {
            "hearing" => {
                if is_nil {
                    hearing_package_ids.push(r.content_id_str.clone());
                } else {
                    hearing_ids.push(r.content_id);
                    hearing_segment_keys.push((r.content_id, r.segment_index));
                }
            }
            "floor_speech" => {
                if is_nil {
                    floor_speech_event_ids.push(r.content_id_str.clone());
                } else {
                    floor_speech_ids.push(r.content_id);
                    floor_speech_segment_keys.push((r.content_id, r.segment_index));
                }
            }
            _ => {}
        }
    }

    // fetch metadata by UUID
    let hearing_metadata = db.hearings().get_metadata_batch(&hearing_ids).await?;
    let floor_speech_metadata = db.floor_speeches().get_metadata_batch(&floor_speech_ids).await?;

    // fetch metadata by package_id/event_id for FTS results
    let hearing_pkg_metadata = db
        .hearings()
        .get_metadata_batch_by_package_id(&hearing_package_ids)
        .await?;
    let floor_speech_event_metadata = db
        .floor_speeches()
        .get_metadata_batch_by_event_id(&floor_speech_event_ids)
        .await?;

    let hearing_speakers = db
        .hearing_segments()
        .get_speakers_for_segments(&hearing_segment_keys)
        .await?;
    let floor_speech_speakers = db
        .floor_speech_segments()
        .get_speakers_for_segments(&floor_speech_segment_keys)
        .await?;

    for r in results.iter_mut() {
        let is_nil = r.content_id.is_nil();
        match r.content_type.as_str() {
            "hearing" => {
                if is_nil {
                    if let Some((title, _committee, date, source_url)) = hearing_pkg_metadata.get(&r.content_id_str) {
                        r.title = Some(title.clone());
                        r.date = date.map(|d| d.format("%Y-%m-%d").to_string());
                        r.source_url = source_url.clone();
                    }
                } else {
                    if let Some((title, _committee, date, source_url)) = hearing_metadata.get(&r.content_id) {
                        r.title = Some(title.clone());
                        r.date = date.map(|d| d.format("%Y-%m-%d").to_string());
                        r.source_url = source_url.clone();
                    }
                    if r.speaker_name.is_none() {
                        if let Some(speaker) = hearing_speakers.get(&(r.content_id, r.segment_index)) {
                            r.speaker_name = speaker.clone();
                        }
                    }
                }
            }
            "floor_speech" => {
                if is_nil {
                    if let Some((title, _chamber, date, source_url)) = floor_speech_event_metadata.get(&r.content_id_str) {
                        r.title = Some(title.clone());
                        r.date = date.map(|d| d.format("%Y-%m-%d").to_string());
                        r.source_url = source_url.clone();
                    }
                } else {
                    if let Some((title, _chamber, date, source_url)) = floor_speech_metadata.get(&r.content_id) {
                        r.title = Some(title.clone());
                        r.date = date.map(|d| d.format("%Y-%m-%d").to_string());
                        r.source_url = source_url.clone();
                    }
                    if r.speaker_name.is_none() {
                        if let Some(speaker) =
                            floor_speech_speakers.get(&(r.content_id, r.segment_index))
                        {
                            r.speaker_name = speaker.clone();
                        }
                    }
                }
            }
            _ => {}
        }
    }

    Ok(())
}

/// Expand search results with context segments from `LanceDB`
async fn expand_context(
    results: &mut [SearchResult],
    lancedb_path: &str,
    context_count: i32,
) -> Result<(), ApiError> {
    use arrow_array::{Int32Array, StringArray};

    if results.is_empty() || context_count == 0 {
        return Ok(());
    }

    let db = lancedb::connect(lancedb_path).execute().await?;
    let table = db.open_table("text_embeddings").execute().await?;

    // group results by content_id for efficient querying
    let mut content_segments: HashMap<Uuid, Vec<(usize, i32)>> = HashMap::new();
    for (idx, result) in results.iter().enumerate() {
        content_segments
            .entry(result.content_id)
            .or_default()
            .push((idx, result.segment_index));
    }

    // for each content, fetch all needed context segments in one query
    for (content_id, segments) in content_segments {
        // calculate min and max segment indices needed
        let min_idx = segments.iter().map(|(_, idx)| idx - context_count).min().unwrap_or(0);
        let max_idx = segments.iter().map(|(_, idx)| idx + context_count).max().unwrap_or(0);

        // query for all segments in range for this content
        let filter = format!(
            "content_id = '{}' AND segment_index >= {} AND segment_index <= {}",
            content_id, min_idx, max_idx
        );

        let batches: Vec<RecordBatch> = table
            .query()
            .only_if(filter)
            .select(lancedb::query::Select::columns(&["segment_index", "text"]))
            .execute()
            .await?
            .try_collect()
            .await?;

        // build map of segment_index -> text
        let mut segment_texts: HashMap<i32, String> = HashMap::new();
        for batch in &batches {
            if let (Some(indices), Some(texts)) = (
                batch.column_by_name("segment_index").and_then(|c| c.as_any().downcast_ref::<Int32Array>()),
                batch.column_by_name("text").and_then(|c| c.as_any().downcast_ref::<StringArray>()),
            ) {
                for i in 0..batch.num_rows() {
                    segment_texts.insert(indices.value(i), texts.value(i).to_string());
                }
            }
        }

        // populate context for each result from this content
        for (result_idx, segment_idx) in segments {
            let result = &mut results[result_idx];

            // get context_before (in order from earliest to just before current)
            let mut before = Vec::new();
            for i in (segment_idx - context_count)..segment_idx {
                if let Some(text) = segment_texts.get(&i) {
                    before.push(text.clone());
                }
            }
            result.context_before = before;

            // get context_after (in order from just after current to latest)
            let mut after = Vec::new();
            for i in (segment_idx + 1)..=(segment_idx + context_count) {
                if let Some(text) = segment_texts.get(&i) {
                    after.push(text.clone());
                }
            }
            result.context_after = after;
        }
    }

    Ok(())
}

/// Search endpoint handler
#[utoipa::path(
    get,
    path = "/search",
    params(SearchParams),
    responses(
        (status = 200, description = "Search results", body = SearchResponse),
        (status = 400, description = "Validation error"),
        (status = 500, description = "Internal error")
    )
)]
#[allow(clippy::significant_drop_tightening)]
pub async fn search(
    State(state): State<Arc<AppState>>,
    Query(params): Query<SearchParams>,
) -> Result<Json<SearchResponse>, ApiError> {
    // validate query
    let query = params.q.trim();
    if query.is_empty() {
        return Err(ApiError::Validation {
            message: "Query parameter 'q' is required".into(),
            field: Some("q".into()),
        });
    }

    let limit = params.limit.min(100);
    let offset = params.offset;

    // build content type filter
    let content_types = params.parse_content_types();
    let type_filter = build_content_type_filter(&content_types);

    // build PostgreSQL-based filters
    let filter_params = FilterParams {
        chamber: params.chamber.as_ref(),
        committee: params.committee.as_deref(),
        congress: params.congress,
        from_date: params.from.as_deref(),
        to_date: params.to.as_deref(),
        speaker: params.speaker.as_deref(),
    };

    // get filtered content IDs from PostgreSQL
    let (content_id_filter, empty_filter_result) = if filter_params.has_pg_filters() {
        let filtered_ids = get_filtered_content_ids(&state.db, &content_types, &filter_params).await?;
        match filtered_ids {
            Some(ids) if ids.is_empty() => (None, true),
            Some(ids) => (build_content_id_filter(&ids), false),
            None => (None, false),
        }
    } else {
        (None, false)
    };

    // if PostgreSQL filter found no matching content, return empty results immediately
    if empty_filter_result {
        return Ok(Json(SearchResponse {
            query: query.to_string(),
            mode: InternalMode::from(params.mode).as_str().to_string(),
            mode_used: InternalMode::from(params.mode).as_str().to_string(),
            results: vec![],
            total_returned: 0,
            has_more: false,
            next_offset: None,
        }));
    }

    // build speaker filter for LanceDB
    let speaker_filter = filter_params.speaker.map(build_speaker_filter);

    // combine all filters
    let combined_filter = combine_filters(vec![type_filter, content_id_filter, speaker_filter]);

    // execute search
    let mode: InternalMode = params.mode.into();
    let fetch_count = offset + limit + 1;

    let (mut raw_results, mode_used) = {
        let mut embedder = state.embedder.lock().await;
        let search_future = execute_search(
            &state.lancedb_path,
            query,
            fetch_count,
            mode,
            combined_filter.as_deref(),
            &mut embedder,
        );
        tokio::time::timeout(state.search_timeout, search_future)
            .await
            .map_err(|_| ApiError::Internal("Search timed out".into()))??
    };

    // skip offset
    if offset > 0 {
        if raw_results.len() <= offset {
            return Ok(Json(SearchResponse {
                query: query.to_string(),
                mode: mode.as_str().to_string(),
                mode_used: mode_used.as_str().to_string(),
                results: vec![],
                total_returned: 0,
                has_more: false,
                next_offset: None,
            }));
        }
        raw_results = raw_results.into_iter().skip(offset).collect();
    }

    // check for more
    let has_more = raw_results.len() > limit;
    if has_more {
        raw_results.truncate(limit);
    }

    // calculate max score for normalization
    let max_score = raw_results.iter().map(|r| r.score).fold(0.0_f32, f32::max);

    // convert to response
    let mut results: Vec<SearchResult> = raw_results
        .into_iter()
        .map(|r| SearchResult {
            content_id: r.content_id,
            content_id_str: r.content_id_str,
            segment_index: r.segment_index,
            text: r.text,
            start_time_ms: r.start_time_ms,
            end_time_ms: r.end_time_ms,
            score: normalize_score(r.score, mode_used, max_score),
            content_type: r.content_type,
            speaker_name: r.speaker_name,
            title: r.title,
            date: None,
            source_url: None,
            context_before: vec![],
            context_after: vec![],
        })
        .collect();

    // enrich with metadata if requested
    if params.enrich {
        if let Err(e) = enrich_results(&mut results, &state.db).await {
            tracing::warn!("Failed to enrich results: {}", e);
        }
    }

    // expand context if requested
    if params.context > 0 {
        let context_count = params.context.min(10) as i32;
        if let Err(e) = expand_context(&mut results, &state.lancedb_path, context_count).await {
            tracing::warn!("Failed to expand context: {}", e);
        }
    }

    let total_returned = results.len();

    Ok(Json(SearchResponse {
        query: query.to_string(),
        mode: mode.as_str().to_string(),
        mode_used: mode_used.as_str().to_string(),
        results,
        total_returned,
        has_more,
        next_offset: if has_more { Some(offset + limit) } else { None },
    }))
}
