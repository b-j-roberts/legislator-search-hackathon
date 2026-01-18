//! Search command for congressional content using LanceDB hybrid search

use arrow_array::{Array, RecordBatch};
use color_eyre::eyre::{eyre, Result};
use colored::Colorize;
use futures::TryStreamExt;
use lancedb::index::scalar::FullTextSearchQuery;
use lancedb::query::{ExecutableQuery, QueryBase};
use polsearch_pipeline::stages::TextEmbedder;
use polsearch_util::truncate;
use serde::Serialize;
use uuid::Uuid;

use crate::{ContentTypeFilter, OutputFormat, SearchMode};

/// Search result with metadata
#[derive(Serialize)]
struct SearchResult {
    content_id: Uuid,
    segment_index: i32,
    text: String,
    start_time_ms: i32,
    end_time_ms: i32,
    score: f32,
    content_type: String,
    speaker_name: Option<String>,
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
                ContentTypeFilter::All | ContentTypeFilter::Hearing | ContentTypeFilter::FloorSpeech
            )
        })
    {
        println!(
            "{}",
            "Warning: hearing/speech filters (--committee, --chamber, --congress) have no effect without --type hearing or --type floor_speech".yellow()
        );
    }

    // TODO: implement speaker, committee, chamber, congress filtering
    if speaker.is_some() {
        println!(
            "{}",
            "Note: --speaker filtering not yet implemented for congressional content".yellow()
        );
    }
    if committee.is_some() || chamber.is_some() || congress.is_some() {
        println!(
            "{}",
            "Note: --committee, --chamber, --congress filtering not yet implemented".yellow()
        );
    }

    // TODO: implement date range filtering
    if from.is_some() || to.is_some() {
        println!(
            "{}",
            "Note: date range filtering not yet implemented for congressional content".yellow()
        );
    }

    let _ = context_size; // TODO: implement context expansion

    // execute search
    let fetch_count = offset + limit + 1;
    let mut raw_results =
        execute_search(lancedb_path, query, fetch_count, mode, type_filter.as_deref()).await?;

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

    // convert to SearchResult
    let results: Vec<SearchResult> = raw_results
        .into_iter()
        .map(|r| SearchResult {
            content_id: r.content_id,
            segment_index: r.segment_index,
            text: r.text,
            start_time_ms: r.start_time_ms,
            end_time_ms: r.end_time_ms,
            score: r.score,
            content_type: r.content_type,
            speaker_name: r.speaker_name,
        })
        .collect();

    // output results
    match format {
        OutputFormat::Text => {
            if group {
                print_results_grouped(query, &results, offset, has_more, mode);
            } else {
                print_results_flat(query, &results, limit, offset, has_more, mode);
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

/// Raw search result from LanceDB
struct RawSearchResult {
    content_id: Uuid,
    segment_index: i32,
    text: String,
    start_time_ms: i32,
    end_time_ms: i32,
    score: f32,
    content_type: String,
    speaker_name: Option<String>,
}

/// Execute search against LanceDB
async fn execute_search(
    lancedb_path: &str,
    query: &str,
    limit: usize,
    mode: SearchMode,
    type_filter: Option<&str>,
) -> Result<Vec<RawSearchResult>> {
    let db = lancedb::connect(lancedb_path).execute().await?;
    let table = db.open_table("text_embeddings").execute().await?;

    let filter_expr = type_filter.map(ToString::to_string);

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

    parse_search_results(&batches)
}

/// Parse LanceDB results into RawSearchResult structs
fn parse_search_results(batches: &[RecordBatch]) -> Result<Vec<RawSearchResult>> {
    use arrow_array::{Float32Array, Int32Array, StringArray};

    let mut results = Vec::new();

    for batch in batches {
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

        let content_types = batch
            .column_by_name("content_type")
            .and_then(|c| c.as_any().downcast_ref::<StringArray>());

        let speaker_names = batch
            .column_by_name("speaker_name")
            .and_then(|c| c.as_any().downcast_ref::<StringArray>());

        for i in 0..batch.num_rows() {
            let content_id_str = content_ids.value(i);
            let content_id = Uuid::parse_str(content_id_str)?;

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
                segment_index: segment_indices.value(i),
                text: texts.value(i).to_string(),
                start_time_ms: start_times.value(i),
                end_time_ms: end_times.value(i),
                score,
                content_type,
                speaker_name,
            });
        }
    }

    Ok(results)
}

/// Format a score for display based on search mode
fn format_score(score: f32, mode: SearchMode, max_score: f32) -> String {
    match mode {
        SearchMode::Hybrid => {
            let pct = (score / 0.05 * 100.0).min(100.0);
            format!("{pct:.0}%")
        }
        SearchMode::Fts => {
            let pct = if max_score > 0.0 {
                (score / max_score * 100.0).min(100.0)
            } else {
                0.0
            };
            format!("{pct:.0}%")
        }
        SearchMode::Phrase => "100%".to_string(),
        SearchMode::Vector => {
            let similarity = ((1.0 - score / 2.0) * 100.0).clamp(0.0, 100.0);
            format!("{similarity:.0}%")
        }
    }
}

/// Format and print search results in flat list format
fn print_results_flat(
    query: &str,
    results: &[SearchResult],
    limit: usize,
    offset: usize,
    has_more: bool,
    mode: SearchMode,
) {
    println!();
    println!("{}", format!("=== Search: \"{query}\" ===").cyan().bold());
    println!();

    let max_score = results.iter().map(|r| r.score).fold(0.0_f32, f32::max);

    for (i, result) in results.iter().enumerate() {
        let result_num = offset + i + 1;

        let speaker_str = result
            .speaker_name
            .as_ref()
            .map_or_else(String::new, |s| format!(" | {}", s.cyan()));

        let type_label = match result.content_type.as_str() {
            "hearing" => "Hearing".green(),
            "floor_speech" => "Floor Speech".blue(),
            "vote" => "Vote".magenta(),
            _ => result.content_type.normal(),
        };

        println!(
            "[{}] {} | {}{}",
            format!("{result_num}").yellow(),
            format_score(result.score, mode, max_score).dimmed(),
            type_label,
            speaker_str
        );
        println!("    \"{}\"", truncate(&result.text, 100));
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

/// Format and print search results grouped by content type
fn print_results_grouped(
    query: &str,
    results: &[SearchResult],
    offset: usize,
    has_more: bool,
    mode: SearchMode,
) {
    println!();
    println!("{}", format!("=== Search: \"{query}\" ===").cyan().bold());
    println!();

    let max_score = results.iter().map(|r| r.score).fold(0.0_f32, f32::max);

    // group by content type
    use std::collections::HashMap;
    let mut grouped: HashMap<&str, Vec<(usize, &SearchResult)>> = HashMap::new();

    for (i, result) in results.iter().enumerate() {
        let result_num = offset + i + 1;
        grouped
            .entry(&result.content_type)
            .or_default()
            .push((result_num, result));
    }

    // sort groups by max score
    let mut groups: Vec<_> = grouped.into_iter().collect();
    groups.sort_by(|a, b| {
        let max_a = a.1.iter().map(|(_, r)| r.score).fold(0.0_f32, f32::max);
        let max_b = b.1.iter().map(|(_, r)| r.score).fold(0.0_f32, f32::max);
        max_b
            .partial_cmp(&max_a)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    for (content_type, mut items) in groups {
        let type_label = match content_type {
            "hearing" => "Hearings".green().bold(),
            "floor_speech" => "Floor Speeches".blue().bold(),
            "vote" => "Votes".magenta().bold(),
            _ => content_type.normal().bold(),
        };
        println!("{type_label}");

        // sort by score descending
        items.sort_by(|a, b| {
            b.1.score
                .partial_cmp(&a.1.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        });

        for (result_num, result) in items {
            let speaker_str = result
                .speaker_name
                .as_ref()
                .map_or_else(String::new, |s| format!(" | {}", s.cyan()));

            println!(
                "  [{}] {}{}",
                format!("{result_num}").yellow(),
                format_score(result.score, mode, max_score).dimmed(),
                speaker_str
            );
            println!("       \"{}\"", truncate(&result.text, 80));
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

/// Build a content type filter for LanceDB queries
fn build_content_type_filter(types: &[ContentTypeFilter]) -> Option<String> {
    if types.is_empty() || types.iter().any(|t| matches!(t, ContentTypeFilter::All)) {
        return None;
    }

    let type_values: Vec<&str> = types
        .iter()
        .map(|t| match t {
            ContentTypeFilter::All => "all",
            ContentTypeFilter::Hearing => "hearing",
            ContentTypeFilter::FloorSpeech => "floor_speech",
            ContentTypeFilter::Vote => "vote",
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
