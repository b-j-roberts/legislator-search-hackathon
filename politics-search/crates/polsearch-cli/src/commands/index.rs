//! Unified FTS index creation for all `LanceDB` tables

use color_eyre::eyre::Result;
use colored::Colorize;
use lancedb::index::Index;
use lancedb::table::OptimizeAction;
use polsearch_pipeline::stages::FTS_TABLE_NAME;
use std::time::Instant;

/// Create FTS indexes on all applicable tables
pub async fn run(lancedb_path: &str) -> Result<()> {
    let db = lancedb::connect(lancedb_path).execute().await?;
    let start = Instant::now();
    let mut indexed_tables = 0;

    // Index text_fts table (used by FTS-only mode)
    if let Ok(table) = db.open_table(FTS_TABLE_NAME).execute().await {
        let row_count = table.count_rows(None).await?;
        println!(
            "{}",
            format!("Creating FTS index on {} ({} rows)...", FTS_TABLE_NAME, row_count).cyan()
        );

        table
            .create_index(
                &["text"],
                Index::FTS(lancedb::index::scalar::FtsIndexBuilder::default()),
            )
            .execute()
            .await?;
        println!("{}", format!("  {} FTS index created", FTS_TABLE_NAME).green());

        println!("{}", "  Optimizing...".dimmed());
        let stats = table.optimize(OptimizeAction::All).await?;
        if let Some(compaction) = stats.compaction {
            println!("    Compacted {} fragments", compaction.files_removed);
        }
        if let Some(prune) = stats.prune {
            println!("    Pruned {} bytes", prune.bytes_removed);
        }
        indexed_tables += 1;
    } else {
        println!(
            "{}",
            format!("Skipping {} (table not found)", FTS_TABLE_NAME).dimmed()
        );
    }

    // Index text_embeddings table (used by hybrid search)
    if let Ok(table) = db.open_table("text_embeddings").execute().await {
        let row_count = table.count_rows(None).await?;
        println!(
            "{}",
            format!("Creating FTS index on text_embeddings ({} rows)...", row_count).cyan()
        );

        table
            .create_index(
                &["text"],
                Index::FTS(lancedb::index::scalar::FtsIndexBuilder::default()),
            )
            .execute()
            .await?;
        println!("{}", "  text_embeddings FTS index created".green());

        println!("{}", "  Optimizing...".dimmed());
        let stats = table.optimize(OptimizeAction::All).await?;
        if let Some(compaction) = stats.compaction {
            println!("    Compacted {} fragments", compaction.files_removed);
        }
        if let Some(prune) = stats.prune {
            println!("    Pruned {} bytes", prune.bytes_removed);
        }
        indexed_tables += 1;
    } else {
        println!(
            "{}",
            "Skipping text_embeddings (table not found)".dimmed()
        );
    }

    let duration = start.elapsed();
    println!();
    if indexed_tables > 0 {
        println!("{}", "Done!".green().bold());
        println!(
            "  Indexed {} table(s) in {:.1}s",
            indexed_tables,
            duration.as_secs_f64()
        );
    } else {
        println!(
            "{}",
            "No tables to index. Run 'polsearch fts ingest' or 'polsearch hearings ingest' first."
                .yellow()
        );
    }

    Ok(())
}
