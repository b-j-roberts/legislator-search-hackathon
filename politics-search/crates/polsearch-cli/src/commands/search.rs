//! Search command for podcast transcriptions using `LanceDB` hybrid search

use arrow_array::RecordBatch;
use chrono::{DateTime, Utc};
use color_eyre::eyre::{bail, eyre, Result};
use colored::Colorize;
use futures::TryStreamExt;
use lancedb::index::scalar::FullTextSearchQuery;
use lancedb::query::{ExecutableQuery, QueryBase};
use polsearch_pipeline::stages::TextEmbedder;
use polsearch_util::truncate;
use serde::Serialize;
use uuid::Uuid;

use super::get_database;
use crate::{ContentTypeFilter, OutputFormat, SearchMode};

/// Context segment for RAG output
#[derive(Serialize, Clone)]
struct ContextSegment {
    index: i32,
    text: String,
    speaker: Option<String>,
}

/// Search result with enriched metadata
#[derive(Serialize)]
struct SearchResult {
    content_id: Uuid,
    segment_index: i32,
    text: String,
    start_time_ms: i32,
    end_time_ms: i32,
    score: f32,
    podcast_name: String,
    episode_title: String,
    published_at: DateTime<Utc>,
    speaker_name: Option<String>,
    content_url: String,
    /// Combined text with speaker labels for RAG (only present when --context > 0)
    #[serde(skip_serializing_if = "Option::is_none")]
    context_text: Option<String>,
    /// Individual context segments (only present when --context > 0)
    #[serde(skip_serializing_if = "Option::is_none")]
    context_segments: Option<Vec<ContextSegment>>,
}

/// Run the search command
#[allow(clippy::too_many_arguments)]
pub async fn run(
    query: &str,
    limit: usize,
    offset: usize,
    group: bool,
    mode: SearchMode,
    content_types: Vec<ContentTypeFilter>,
    podcast: Option<String>,
    from: Option<String>,
    to: Option<String>,
    speaker: Option<String>,
    committee: Option<String>,
    chamber: Option<String>,
    congress: Option<i16>,
    lancedb_path: &str,
    format: OutputFormat,
    context_size: usize,
) -> Result<()> {
    // Build content type filter for LanceDB
    let type_filter = build_content_type_filter(&content_types);

    // Log hearing-specific filters if used
    if (committee.is_some() || chamber.is_some() || congress.is_some())
        && !content_types.iter().any(|t| {
            matches!(
                t,
                ContentTypeFilter::All
                    | ContentTypeFilter::Hearing
                    | ContentTypeFilter::FloorSpeech
            )
        })
    {
        println!("{}", "Warning: hearing/speech filters (--committee, --chamber, --congress) have no effect without --type hearing or --type floor_speech".yellow());
    }
    let db = get_database().await?;

    // validate date range if provided
    let date_range = match (&from, &to) {
        (Some(f), Some(t)) => Some((f.as_str(), t.as_str())),
        (None, None) => None,
        _ => bail!("Must specify both --from and --to for date range filtering"),
    };

    // resolve podcast filter
    let source_id = if let Some(ref slug) = podcast {
        let p = db
            .podcasts()
            .find_by_fuzzy_match(slug)
            .await?
            .ok_or_else(|| eyre!("Source not found: {}", slug))?;
        Some(p.id)
    } else {
        None
    };

    // resolve speaker filter
    let speaker_id = if let Some(ref slug) = speaker {
        let s = db
            .speakers()
            .get_by_slug(slug)
            .await?
            .ok_or_else(|| eyre!("Speaker not found: {}", slug))?;
        Some(s.id)
    } else {
        None
    };

    // get filtered episode IDs if any filters are active
    let episode_filter = if source_id.is_some() || date_range.is_some() || speaker_id.is_some() {
        let ids = get_filtered_content_ids(&db, source_id, date_range, speaker_id).await?;
        if ids.is_empty() {
            println!("{}", "No episodes match the specified filters".yellow());
            return Ok(());
        }
        Some(ids)
    } else {
        None
    };

    // execute search (request offset + limit + 1 to handle pagination and detect more results)
    let fetch_count = offset + limit + 1;
    let mut raw_results = execute_search(
        lancedb_path,
        query,
        fetch_count,
        mode,
        episode_filter.as_deref(),
        type_filter.as_deref(),
    )
    .await?;

    // skip the first `offset` results
    if offset > 0 {
        if raw_results.len() <= offset {
            println!("{}", "No results at this offset".yellow());
            return Ok(());
        }
        raw_results = raw_results.into_iter().skip(offset).collect();
    }

    if raw_results.is_empty() {
        println!("{}", "No results found".yellow());
        return Ok(());
    }

    // check if there are more results than requested
    let has_more = raw_results.len() > limit;
    if has_more {
        raw_results.truncate(limit);
    }

    // enrich results with metadata
    let mut results = enrich_results(&db, raw_results).await?;

    // expand context if requested
    if context_size > 0 {
        expand_context(&db, lancedb_path, &mut results, context_size).await?;
    }

    // output results
    match format {
        OutputFormat::Text => {
            if group {
                print_results_grouped(
                    query, &results, offset, has_more, mode, &podcast, &from, &to, &speaker,
                );
            } else {
                print_results_flat(
                    query, &results, limit, offset, has_more, mode, &podcast, &from, &to, &speaker,
                );
            }
        }
        OutputFormat::Json => {
            let output = JsonOutput {
                query,
                results: &results,
                total_returned: results.len(),
                has_more,
            };
            println!("{}", serde_json::to_string_pretty(&output)?);
        }
    }

    Ok(())
}

/// JSON output structure
#[derive(Serialize)]
struct JsonOutput<'a> {
    query: &'a str,
    results: &'a [SearchResult],
    total_returned: usize,
    has_more: bool,
}

/// Get episode IDs matching the filters
async fn get_filtered_content_ids(
    db: &polsearch_db::Database,
    source_id: Option<Uuid>,
    date_range: Option<(&str, &str)>,
    speaker_id: Option<Uuid>,
) -> Result<Vec<Uuid>> {
    // if speaker filter is active, we need to join through content_speakers
    if let Some(sid) = speaker_id {
        let ids = db
            .content_speakers()
            .get_content_ids_by_speaker(sid)
            .await?;

        // apply additional filters if present
        let filtered: Vec<Uuid> = if source_id.is_some() || date_range.is_some() {
            let episodes = db.episodes();
            let mut result = Vec::new();
            for id in ids {
                if let Some(ep) = episodes.get_by_id(id).await? {
                    let matches_podcast = source_id.is_none_or(|pid| ep.source_id == pid);
                    let matches_date = date_range.is_none_or(|(from, to)| {
                        ep.year_month.as_str() >= from && ep.year_month.as_str() <= to
                    });
                    if matches_podcast && matches_date && ep.is_processed {
                        result.push(id);
                    }
                }
            }
            result
        } else {
            ids
        };

        return Ok(filtered);
    }

    // no speaker filter, use simpler query
    let (from, to) = date_range.unwrap_or(("0000-00", "9999-99"));

    let ids: Vec<(Uuid,)> = if let Some(pid) = source_id {
        sqlx::query_as(
            r"
            SELECT id FROM content
            WHERE is_processed = true
              AND source_id = $1
              AND year_month >= $2 AND year_month <= $3
            ",
        )
        .bind(pid)
        .bind(from)
        .bind(to)
        .fetch_all(db.pool())
        .await?
    } else {
        sqlx::query_as(
            r"
            SELECT id FROM content
            WHERE is_processed = true
              AND year_month >= $1 AND year_month <= $2
            ",
        )
        .bind(from)
        .bind(to)
        .fetch_all(db.pool())
        .await?
    };

    Ok(ids.into_iter().map(|(id,)| id).collect())
}

/// Raw search result from `LanceDB`
struct RawSearchResult {
    content_id: Uuid,
    segment_index: i32,
    text: String,
    start_time_ms: i32,
    end_time_ms: i32,
    /// Score value - interpretation depends on search mode:
    /// - Vector: distance (lower is better)
    /// - FTS: score (higher is better)
    /// - Hybrid: relevance score (higher is better)
    score: f32,
}

/// Execute search against `LanceDB`
async fn execute_search(
    lancedb_path: &str,
    query: &str,
    limit: usize,
    mode: SearchMode,
    episode_filter: Option<&[Uuid]>,
    type_filter: Option<&str>,
) -> Result<Vec<RawSearchResult>> {
    let db = lancedb::connect(lancedb_path).execute().await?;
    let table = db.open_table("text_embeddings").execute().await?;

    // build filter expression combining episode filter and type filter
    let episode_filter_expr = episode_filter.map(|ids| {
        let id_list: Vec<String> = ids.iter().map(|id| format!("'{id}'")).collect();
        format!("content_id IN ({})", id_list.join(", "))
    });

    let filter_expr = match (episode_filter_expr, type_filter) {
        (Some(ef), Some(tf)) => Some(format!("({ef}) AND ({tf})")),
        (Some(ef), None) => Some(ef),
        (None, Some(tf)) => Some(tf.to_string()),
        (None, None) => None,
    };

    let batches: Vec<RecordBatch> = match mode {
        SearchMode::Vector => {
            let mut embedder = TextEmbedder::new()?;
            let query_embedding = embedder.embed(query)?;

            let mut search = table.vector_search(query_embedding)?;
            if let Some(ref filter) = filter_expr {
                search = search.only_if(filter.clone());
            }
            search.limit(limit).execute().await?.try_collect().await?
        }
        SearchMode::Fts => {
            let mut search = table
                .query()
                .full_text_search(FullTextSearchQuery::new(query.to_string()));
            if let Some(ref filter) = filter_expr {
                search = search.only_if(filter.clone());
            }
            search.limit(limit).execute().await?.try_collect().await?
        }
        SearchMode::Hybrid => {
            let mut embedder = TextEmbedder::new()?;
            let query_embedding = embedder.embed(query)?;

            let mut search = table
                .vector_search(query_embedding)?
                .full_text_search(FullTextSearchQuery::new(query.to_string()));
            if let Some(ref filter) = filter_expr {
                search = search.only_if(filter.clone());
            }
            search.limit(limit).execute().await?.try_collect().await?
        }
        SearchMode::Phrase => {
            // use SQL LIKE for exact substring matching
            let escaped_query = query.replace('\'', "''").replace('%', "\\%");
            let like_filter = format!("text LIKE '%{}%'", escaped_query);

            let combined_filter = match filter_expr {
                Some(ref episode_filter) => format!("({}) AND ({})", episode_filter, like_filter),
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

    parse_search_results(&batches)
}

/// Parse `LanceDB` results into `RawSearchResult` structs
fn parse_search_results(batches: &[RecordBatch]) -> Result<Vec<RawSearchResult>> {
    use arrow_array::{Float32Array, Int32Array, StringArray};

    let mut results = Vec::new();

    for batch in batches {
        // try different score columns depending on search mode
        // _relevance_score: hybrid search (f32) - higher is better
        // _distance: vector search (f32) - lower is better
        // _score: FTS search (f32) - higher is better
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
            .ok_or_else(|| eyre!("Missing content_id column"))?;

        let segment_indices = batch
            .column_by_name("segment_index")
            .and_then(|c| c.as_any().downcast_ref::<Int32Array>())
            .ok_or_else(|| eyre!("Missing segment_index column"))?;

        let start_times = batch
            .column_by_name("start_time_ms")
            .and_then(|c| c.as_any().downcast_ref::<Int32Array>())
            .ok_or_else(|| eyre!("Missing start_time_ms column"))?;

        let end_times = batch
            .column_by_name("end_time_ms")
            .and_then(|c| c.as_any().downcast_ref::<Int32Array>())
            .ok_or_else(|| eyre!("Missing end_time_ms column"))?;

        let texts = batch
            .column_by_name("text")
            .and_then(|c| c.as_any().downcast_ref::<StringArray>())
            .ok_or_else(|| eyre!("Missing text column"))?;

        for i in 0..batch.num_rows() {
            let content_id_str = content_ids.value(i);
            let content_id = Uuid::parse_str(content_id_str)?;

            // prefer _relevance_score (hybrid), then _distance (vector), then _score (FTS)
            let score = relevance_scores
                .map(|s| s.value(i))
                .or_else(|| distances.map(|d| d.value(i)))
                .or_else(|| fts_scores.map(|s| s.value(i)))
                .unwrap_or(0.0);

            results.push(RawSearchResult {
                content_id,
                segment_index: segment_indices.value(i),
                text: texts.value(i).to_string(),
                start_time_ms: start_times.value(i),
                end_time_ms: end_times.value(i),
                score,
            });
        }
    }

    Ok(results)
}

/// Enrich raw results with podcast/episode/speaker metadata
async fn enrich_results(
    db: &polsearch_db::Database,
    raw_results: Vec<RawSearchResult>,
) -> Result<Vec<SearchResult>> {
    // collect unique episode IDs
    let content_ids: Vec<Uuid> = raw_results.iter().map(|r| r.content_id).collect();

    // batch fetch episodes with their podcasts
    let episode_podcast_map = db.episodes().get_by_ids_with_sources(&content_ids).await?;

    // collect segment keys for speaker lookup
    let segment_keys: Vec<(Uuid, i32)> = raw_results
        .iter()
        .map(|r| (r.content_id, r.segment_index))
        .collect();

    // batch fetch speaker names
    let speaker_map = db
        .segments()
        .get_speakers_for_segments(&segment_keys)
        .await?;

    // build enriched results
    let mut results = Vec::new();
    for raw in raw_results {
        let (podcast_name, episode_title, published_at, content_url) = episode_podcast_map
            .get(&raw.content_id)
            .map(|(name, title, date, url)| (name.clone(), title.clone(), *date, url.clone()))
            .unwrap_or_else(|| {
                (
                    "Unknown".to_string(),
                    "Unknown".to_string(),
                    Utc::now(),
                    String::new(),
                )
            });

        let speaker_name = speaker_map
            .get(&(raw.content_id, raw.segment_index))
            .cloned()
            .flatten();

        results.push(SearchResult {
            content_id: raw.content_id,
            segment_index: raw.segment_index,
            text: raw.text,
            start_time_ms: raw.start_time_ms,
            end_time_ms: raw.end_time_ms,
            score: raw.score,
            podcast_name,
            episode_title,
            published_at,
            speaker_name,
            content_url,
            context_text: None,
            context_segments: None,
        });
    }

    Ok(results)
}

/// Expand search results with surrounding context segments
async fn expand_context(
    db: &polsearch_db::Database,
    lancedb_path: &str,
    results: &mut [SearchResult],
    context_size: usize,
) -> Result<()> {
    if results.is_empty() {
        return Ok(());
    }

    let lance = lancedb::connect(lancedb_path).execute().await?;
    let table = lance.open_table("text_embeddings").execute().await?;

    for result in results.iter_mut() {
        let min_index = (result.segment_index - context_size as i32).max(0);
        let max_index = result.segment_index + context_size as i32;

        // query LanceDB for adjacent segments
        let filter = format!(
            "content_id = '{}' AND segment_index >= {} AND segment_index <= {}",
            result.content_id, min_index, max_index
        );

        let batches: Vec<RecordBatch> = table
            .query()
            .only_if(filter)
            .execute()
            .await?
            .try_collect()
            .await?;

        // parse segment data from batches
        let mut segments: Vec<(i32, String)> = Vec::new();
        for batch in &batches {
            let indices = batch
                .column_by_name("segment_index")
                .and_then(|c| c.as_any().downcast_ref::<arrow_array::Int32Array>());
            let texts = batch
                .column_by_name("text")
                .and_then(|c| c.as_any().downcast_ref::<arrow_array::StringArray>());

            if let (Some(indices), Some(texts)) = (indices, texts) {
                for i in 0..batch.num_rows() {
                    segments.push((indices.value(i), texts.value(i).to_string()));
                }
            }
        }

        // sort by segment index
        segments.sort_by_key(|(idx, _)| *idx);

        // get speaker names for these segments
        let segment_keys: Vec<(Uuid, i32)> = segments
            .iter()
            .map(|(idx, _)| (result.content_id, *idx))
            .collect();
        let speaker_map = db.segments().get_speakers_for_segments(&segment_keys).await?;

        // build context segments with speaker names
        let context_segments: Vec<ContextSegment> = segments
            .iter()
            .map(|(idx, text)| ContextSegment {
                index: *idx,
                text: text.clone(),
                speaker: speaker_map
                    .get(&(result.content_id, *idx))
                    .cloned()
                    .flatten(),
            })
            .collect();

        // build combined context_text with speaker labels
        let context_text = context_segments
            .iter()
            .map(|seg| {
                let speaker_label = seg.speaker.as_deref().unwrap_or("Unknown");
                format!("[{}] {}", speaker_label, seg.text)
            })
            .collect::<Vec<_>>()
            .join(" ");

        result.context_text = Some(context_text);
        result.context_segments = Some(context_segments);
    }

    Ok(())
}

/// Format a score for display based on search mode
/// For FTS mode, `max_score` is used to normalize to percentage (top result = 100%)
fn format_score(score: f32, mode: SearchMode, max_score: f32) -> String {
    match mode {
        SearchMode::Hybrid => {
            // RRF scores: 0.05 = 100% (top rank in both rankers)
            let pct = (score / 0.05 * 100.0).min(100.0);
            format!("{:.0}%", pct)
        }
        SearchMode::Fts => {
            // BM25 scores: normalize relative to max (top result = 100%)
            let pct = if max_score > 0.0 {
                (score / max_score * 100.0).min(100.0)
            } else {
                0.0
            };
            format!("{:.0}%", pct)
        }
        SearchMode::Phrase => {
            // exact phrase matches are all 100% (no ranking, just match/no-match)
            "100%".to_string()
        }
        SearchMode::Vector => {
            // Distance: lower is better, convert to similarity percentage
            // Typical L2 distances range 0-2 for normalized vectors
            let similarity = ((1.0 - score / 2.0) * 100.0).clamp(0.0, 100.0);
            format!("{:.0}%", similarity)
        }
    }
}

/// Format and print search results in flat list format
#[allow(clippy::too_many_arguments)]
fn print_results_flat(
    query: &str,
    results: &[SearchResult],
    limit: usize,
    offset: usize,
    has_more: bool,
    mode: SearchMode,
    podcast: &Option<String>,
    from: &Option<String>,
    to: &Option<String>,
    speaker: &Option<String>,
) {
    println!();
    println!("{}", format!("=== Search: \"{}\" ===", query).cyan().bold());

    // show active filters
    let mut filters = Vec::new();
    if let Some(p) = podcast {
        filters.push(format!("podcast={p}"));
    }
    if let Some(f) = from {
        filters.push(format!("from={f}"));
    }
    if let Some(t) = to {
        filters.push(format!("to={t}"));
    }
    if let Some(s) = speaker {
        filters.push(format!("speaker={s}"));
    }
    if !filters.is_empty() {
        println!("{}", format!("Filters: {}", filters.join(", ")).dimmed());
    }
    println!();

    // calculate max score for FTS normalization
    let max_score = results
        .iter()
        .map(|r| r.score)
        .fold(0.0_f32, f32::max);

    for (i, result) in results.iter().enumerate() {
        let result_num = offset + i + 1;
        let time_str = format!(
            "{}:{:02}-{}:{:02}",
            result.start_time_ms / 60000,
            (result.start_time_ms / 1000) % 60,
            result.end_time_ms / 60000,
            (result.end_time_ms / 1000) % 60
        );

        let date_str = result.published_at.format("%b %d, %Y").to_string();

        let speaker_str = result
            .speaker_name
            .as_ref()
            .map_or_else(String::new, |s| format!(" | {}", s.cyan()));

        println!(
            "[{}] {} | {} | {}",
            format!("{result_num}").yellow(),
            format_score(result.score, mode, max_score).dimmed(),
            result.podcast_name.green(),
            truncate(&result.episode_title, 50)
        );
        println!(
            "    {} | {}{}",
            date_str.dimmed(),
            time_str.dimmed(),
            speaker_str
        );
        println!("    \"{}\"", truncate(&result.text, 100));
        if !result.content_url.is_empty() {
            let start_seconds = result.start_time_ms / 1000;
            println!("    {}#t={}", result.content_url.blue().underline(), start_seconds);
        }
        println!();
    }

    let start = offset + 1;
    let end = offset + results.len();

    if has_more {
        let next_offset = offset + limit;
        println!(
            "{}",
            format!(
                "Showing results {start}-{end} (more available, use --offset {next_offset} to see next page)"
            )
            .yellow()
        );
    } else if offset > 0 {
        println!("{}", format!("Showing results {start}-{end}").dimmed());
    } else {
        println!("{}", format!("Found {} results", results.len()).dimmed());
    }
}

/// Format and print search results grouped by podcast and episode
#[allow(clippy::too_many_arguments)]
fn print_results_grouped(
    query: &str,
    results: &[SearchResult],
    offset: usize,
    has_more: bool,
    mode: SearchMode,
    podcast: &Option<String>,
    from: &Option<String>,
    to: &Option<String>,
    speaker: &Option<String>,
) {
    println!();
    println!("{}", format!("=== Search: \"{}\" ===", query).cyan().bold());

    // show active filters
    let mut filters = Vec::new();
    if let Some(p) = podcast {
        filters.push(format!("podcast={p}"));
    }
    if let Some(f) = from {
        filters.push(format!("from={f}"));
    }
    if let Some(t) = to {
        filters.push(format!("to={t}"));
    }
    if let Some(s) = speaker {
        filters.push(format!("speaker={s}"));
    }
    if !filters.is_empty() {
        println!("{}", format!("Filters: {}", filters.join(", ")).dimmed());
    }
    println!();

    // calculate max score for FTS normalization
    let max_score = results
        .iter()
        .map(|r| r.score)
        .fold(0.0_f32, f32::max);

    // group results by podcast -> episode
    use std::collections::HashMap;

    #[allow(clippy::type_complexity)]
    let mut grouped: HashMap<
        &str,
        HashMap<(&str, &chrono::DateTime<Utc>), Vec<(usize, &SearchResult)>>,
    > = HashMap::new();

    for (i, result) in results.iter().enumerate() {
        let result_num = offset + i + 1;
        grouped
            .entry(&result.podcast_name)
            .or_default()
            .entry((&result.episode_title, &result.published_at))
            .or_default()
            .push((result_num, result));
    }

    // convert to vec and sort podcasts by their max score
    let mut podcasts: Vec<_> = grouped.into_iter().collect();
    podcasts.sort_by(|a, b| {
        let max_a =
            a.1.values()
                .flatten()
                .map(|(_, r)| r.score)
                .fold(0.0_f32, f32::max);
        let max_b =
            b.1.values()
                .flatten()
                .map(|(_, r)| r.score)
                .fold(0.0_f32, f32::max);
        max_b
            .partial_cmp(&max_a)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    // print grouped results
    for (podcast_name, episodes) in podcasts {
        println!("{}", podcast_name.green().bold());

        // sort episodes by their max score
        let mut episodes: Vec<_> = episodes.into_iter().collect();
        episodes.sort_by(|a, b| {
            let max_a = a.1.iter().map(|(_, r)| r.score).fold(0.0_f32, f32::max);
            let max_b = b.1.iter().map(|(_, r)| r.score).fold(0.0_f32, f32::max);
            max_b
                .partial_cmp(&max_a)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        for ((episode_title, published_at), mut segment_results) in episodes {
            let date_str = published_at.format("%b %d, %Y").to_string();
            println!(
                "  {} {}",
                truncate(episode_title, 60),
                format!("({})", date_str).dimmed()
            );

            // sort by score descending (highest first) within each episode
            segment_results.sort_by(|a, b| {
                b.1.score
                    .partial_cmp(&a.1.score)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });

            for (result_num, result) in segment_results {
                let time_str = format!(
                    "{}:{:02}-{}:{:02}",
                    result.start_time_ms / 60000,
                    (result.start_time_ms / 1000) % 60,
                    result.end_time_ms / 60000,
                    (result.end_time_ms / 1000) % 60
                );

                let speaker_str = result
                    .speaker_name
                    .as_ref()
                    .map_or_else(String::new, |s| format!(" | {}", s.cyan()));

                println!(
                    "    [{}] {} | {}{}",
                    format!("{result_num}").yellow(),
                    format_score(result.score, mode, max_score).dimmed(),
                    time_str.dimmed(),
                    speaker_str
                );
                println!("         \"{}\"", truncate(&result.text, 80));
                if !result.content_url.is_empty() {
                    let start_seconds = result.start_time_ms / 1000;
                    println!("         {}#t={}", result.content_url.blue().underline(), start_seconds);
                }
            }
        }
        println!();
    }

    let start = offset + 1;
    let end = offset + results.len();

    if has_more {
        println!(
            "{}",
            format!("Showing results {start}-{end} (more available)").yellow()
        );
    } else if offset > 0 {
        println!("{}", format!("Showing results {start}-{end}").dimmed());
    } else {
        println!("{}", format!("Found {} results", results.len()).dimmed());
    }
}

/// Build a content type filter for `LanceDB` queries
fn build_content_type_filter(types: &[ContentTypeFilter]) -> Option<String> {
    // If "all" is in the list or list is empty, no filter needed
    if types.is_empty() || types.iter().any(|t| matches!(t, ContentTypeFilter::All)) {
        return None;
    }

    let type_values: Vec<&str> = types
        .iter()
        .map(|t| match t {
            ContentTypeFilter::All => "all",
            ContentTypeFilter::Podcast => "podcast",
            ContentTypeFilter::Hearing => "hearing",
            ContentTypeFilter::FloorSpeech => "floor_speech",
        })
        .collect();

    if type_values.is_empty() {
        None
    } else {
        Some(format!(
            "content_type IN ({})",
            type_values
                .iter()
                .map(|t| format!("'{t}'"))
                .collect::<Vec<_>>()
                .join(", ")
        ))
    }
}
