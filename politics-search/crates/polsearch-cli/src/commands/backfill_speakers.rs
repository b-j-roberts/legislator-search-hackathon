//! Backfill speaker matching for already-transcribed episodes

use arrow_array::{
    Array, FixedSizeListArray, Int32Array, RecordBatch, RecordBatchIterator, StringArray,
};
use arrow_schema::{DataType, Field, Schema};
use color_eyre::eyre::Result;
use colored::Colorize;
use futures::TryStreamExt;
use lancedb::query::{ExecutableQuery, QueryBase};
use lancedb::table::Table;
use polsearch_core::Speaker;
use std::sync::Arc;
use uuid::Uuid;

use super::get_database;

/// Result of searching for a matching speaker centroid
struct CentroidMatch {
    speaker_id: Uuid,
    distance: f32,
    sample_count: i32,
    vector: Vec<f32>,
}

pub async fn run(lancedb_path: &str) -> Result<()> {
    let db = get_database().await?;
    let lancedb = lancedb::connect(lancedb_path).execute().await?;

    // Get all content_speakers without a linked speaker
    let unlinked: Vec<(Uuid, Uuid, String)> = sqlx::query!(
        r#"
        SELECT es.id, es.content_id, es.local_speaker_label
        FROM content_speakers es
        JOIN content e ON es.content_id = e.id
        WHERE es.speaker_id IS NULL AND e.is_processed = true
        ORDER BY e.id
        "#
    )
    .fetch_all(db.pool())
    .await?
    .into_iter()
    .map(|r| (r.id, r.content_id, r.local_speaker_label))
    .collect();

    if unlinked.is_empty() {
        println!(
            "{}",
            "No unlinked episode speakers found - nothing to backfill".green()
        );
        return Ok(());
    }

    println!(
        "Found {} episode speakers to backfill",
        unlinked.len().to_string().cyan()
    );

    let centroids_table = lancedb.open_table("speaker_centroids").execute().await?;
    let embeddings_table = lancedb.open_table("speaker_embeddings").execute().await?;

    let mut linked_count = 0;
    let mut new_speaker_count = 0;

    for (content_speaker_id, _content_id, _local_label) in &unlinked {
        // Get the speaker embedding for this content_speaker
        let embedding = get_speaker_embedding(&embeddings_table, *content_speaker_id).await?;

        let Some(embedding) = embedding else {
            println!(
                "{} {}",
                "No embedding found for content_speaker".yellow(),
                content_speaker_id
            );
            continue;
        };

        // Search for matching centroid
        let centroid_match = find_matching_centroid(&centroids_table, &embedding).await?;

        if let Some(matched) = centroid_match {
            // Link to existing speaker
            link_to_existing_speaker(
                db.pool(),
                *content_speaker_id,
                &matched,
                &embedding,
                &centroids_table,
            )
            .await?;
            linked_count += 1;
        } else {
            // Create new speaker and centroid
            create_new_speaker(db.pool(), *content_speaker_id, &embedding, &centroids_table)
                .await?;
            new_speaker_count += 1;
        }
    }

    println!("{}", "Backfill complete:".green().bold());
    println!(
        "  Linked to existing speakers: {}",
        linked_count.to_string().cyan()
    );
    println!(
        "  Created new speakers: {}",
        new_speaker_count.to_string().cyan()
    );

    Ok(())
}

/// Get the speaker embedding for an `content_speaker` from `LanceDB`
async fn get_speaker_embedding(
    embeddings_table: &Table,
    content_speaker_id: Uuid,
) -> Result<Option<Vec<f32>>> {
    let query = format!("content_speaker_id = '{content_speaker_id}'");
    let stream = embeddings_table
        .query()
        .only_if(query)
        .limit(1)
        .execute()
        .await?;

    let batches: Vec<RecordBatch> = stream.try_collect().await?;

    for batch in &batches {
        if batch.num_rows() == 0 {
            continue;
        }

        let vectors = batch
            .column_by_name("vector")
            .and_then(|c| c.as_any().downcast_ref::<FixedSizeListArray>());

        if let Some(vectors) = vectors {
            let vector_list = vectors.value(0);
            let vector_array = vector_list
                .as_any()
                .downcast_ref::<arrow_array::Float32Array>()
                .ok_or_else(|| color_eyre::eyre::eyre!("Failed to extract embedding vector"))?;

            let vector: Vec<f32> = (0..vector_array.len())
                .map(|j| vector_array.value(j))
                .collect();

            return Ok(Some(vector));
        }
    }

    Ok(None)
}

/// Search for a matching speaker centroid (cosine distance < 0.3)
async fn find_matching_centroid(
    centroids_table: &Table,
    embedding: &[f32],
) -> Result<Option<CentroidMatch>> {
    let row_count = centroids_table.count_rows(None).await?;
    if row_count == 0 {
        return Ok(None);
    }

    let stream = centroids_table
        .vector_search(embedding.to_vec())?
        .limit(1)
        .execute()
        .await?;

    let batches: Vec<RecordBatch> = stream.try_collect().await.unwrap_or_default();

    for batch in &batches {
        let distances = batch
            .column_by_name("_distance")
            .and_then(|c| c.as_any().downcast_ref::<arrow_array::Float32Array>());
        let speaker_ids = batch
            .column_by_name("speaker_id")
            .and_then(|c| c.as_any().downcast_ref::<StringArray>());
        let sample_counts = batch
            .column_by_name("sample_count")
            .and_then(|c| c.as_any().downcast_ref::<Int32Array>());
        let vectors = batch
            .column_by_name("vector")
            .and_then(|c| c.as_any().downcast_ref::<FixedSizeListArray>());

        if let (Some(distances), Some(speaker_ids), Some(sample_counts), Some(vectors)) =
            (distances, speaker_ids, sample_counts, vectors)
        {
            for i in 0..batch.num_rows() {
                let distance = distances.value(i);
                if distance < 0.3 {
                    let speaker_id_str = speaker_ids.value(i);
                    let speaker_id: Uuid = speaker_id_str
                        .parse()
                        .map_err(|_| color_eyre::eyre::eyre!("Invalid UUID: {}", speaker_id_str))?;

                    let vector_list = vectors.value(i);
                    let vector_array = vector_list
                        .as_any()
                        .downcast_ref::<arrow_array::Float32Array>()
                        .ok_or_else(|| color_eyre::eyre::eyre!("Failed to extract vector"))?;
                    let vector: Vec<f32> = (0..vector_array.len())
                        .map(|j| vector_array.value(j))
                        .collect();

                    return Ok(Some(CentroidMatch {
                        speaker_id,
                        distance,
                        sample_count: sample_counts.value(i),
                        vector,
                    }));
                }
            }
        }
    }

    Ok(None)
}

/// Link an episode speaker to an existing global speaker and update the centroid
async fn link_to_existing_speaker(
    pool: &sqlx::PgPool,
    content_speaker_id: Uuid,
    matched: &CentroidMatch,
    new_embedding: &[f32],
    centroids_table: &Table,
) -> Result<()> {
    let confidence = 1.0 - matched.distance;

    sqlx::query!(
        "UPDATE content_speakers SET speaker_id = $1, match_confidence = $2 WHERE id = $3",
        matched.speaker_id,
        confidence,
        content_speaker_id
    )
    .execute(pool)
    .await?;

    sqlx::query!(
        "UPDATE speakers SET total_appearances = total_appearances + 1 WHERE id = $1",
        matched.speaker_id
    )
    .execute(pool)
    .await?;

    // Update centroid with running average
    let updated_vector =
        compute_running_average(&matched.vector, new_embedding, matched.sample_count);
    let new_sample_count = matched.sample_count + 1;

    centroids_table
        .delete(&format!("speaker_id = '{}'", matched.speaker_id))
        .await?;

    insert_centroid(
        centroids_table,
        matched.speaker_id,
        &updated_vector,
        new_sample_count,
    )
    .await?;

    Ok(())
}

/// Create a new global speaker and centroid for an unmatched episode speaker
async fn create_new_speaker(
    pool: &sqlx::PgPool,
    content_speaker_id: Uuid,
    embedding: &[f32],
    centroids_table: &Table,
) -> Result<()> {
    let new_speaker = Speaker::new_unidentified();

    sqlx::query!(
        r#"
        INSERT INTO speakers (id, name, slug, total_appearances, is_verified, created_at)
        VALUES ($1, $2, $3, $4, $5, $6)
        "#,
        new_speaker.id,
        new_speaker.name,
        new_speaker.slug,
        1,
        new_speaker.is_verified,
        new_speaker.created_at
    )
    .execute(pool)
    .await?;

    sqlx::query!(
        "UPDATE content_speakers SET speaker_id = $1 WHERE id = $2",
        new_speaker.id,
        content_speaker_id
    )
    .execute(pool)
    .await?;

    insert_centroid(centroids_table, new_speaker.id, embedding, 1).await?;

    Ok(())
}

/// Insert a new centroid into `LanceDB`
async fn insert_centroid(
    centroids_table: &Table,
    speaker_id: Uuid,
    embedding: &[f32],
    sample_count: i32,
) -> Result<()> {
    let schema = Arc::new(Schema::new(vec![
        Field::new("id", DataType::Utf8, false),
        Field::new("speaker_id", DataType::Utf8, false),
        Field::new("sample_count", DataType::Int32, false),
        Field::new(
            "vector",
            DataType::FixedSizeList(Arc::new(Field::new("item", DataType::Float32, true)), 256),
            false,
        ),
    ]));

    let embedding_array =
        FixedSizeListArray::from_iter_primitive::<arrow_array::types::Float32Type, _, _>(
            vec![Some(
                embedding.iter().copied().map(Some).collect::<Vec<_>>(),
            )],
            256,
        );

    let batch = RecordBatch::try_new(
        schema.clone(),
        vec![
            Arc::new(StringArray::from(vec![
                Uuid::new_v7(uuid::Timestamp::now(uuid::NoContext)).to_string(),
            ])),
            Arc::new(StringArray::from(vec![speaker_id.to_string()])),
            Arc::new(Int32Array::from(vec![sample_count])),
            Arc::new(embedding_array) as Arc<dyn Array>,
        ],
    )
    .map_err(|e| color_eyre::eyre::eyre!("Failed to create centroid batch: {}", e))?;

    let batches = RecordBatchIterator::new(vec![Ok(batch)].into_iter(), schema);
    centroids_table.add(Box::new(batches)).execute().await?;

    Ok(())
}

/// Compute running average of two embeddings and L2-normalize
#[expect(clippy::cast_precision_loss)]
fn compute_running_average(old: &[f32], new: &[f32], sample_count: i32) -> Vec<f32> {
    let total = sample_count + 1;
    let mut result: Vec<f32> = old
        .iter()
        .zip(new.iter())
        .map(|(o, n)| (o * sample_count as f32 + n) / total as f32)
        .collect();

    let norm: f32 = result.iter().map(|x| x * x).sum::<f32>().sqrt();
    if norm > 0.0 {
        for x in &mut result {
            *x /= norm;
        }
    }

    result
}
