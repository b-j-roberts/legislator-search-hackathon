# FTS Ingestion Specification

## Overview

Fast full-text search ingestion for congressional data (hearings, floor speeches, votes)
without embedding generation. Enables immediate fuzzy search while semantic embeddings
are computed in the background.

## Quick Start

### Phase 1: Fast FTS Ingestion (run immediately)

```bash
# Ingest all content types for FTS (text-only, no embeddings)
polsearch fts ingest \
  --hearings-path data/transcripts \
  --speeches-path data/floor_speech_transcripts \
  --votes

# Search immediately with FTS
polsearch search "immigration reform" --mode fts
polsearch search "nomination" --mode fts --type vote
```

### Phase 2: Semantic Embeddings (run later)

Once FTS is working, run embedding ingestion in the background:

```bash
# Ingest with embeddings (slow, can run overnight)
polsearch hearings ingest --path data/transcripts
polsearch speeches ingest --path data/floor_speech_transcripts
polsearch votes embed

# Create vector index
polsearch db index
```

### Phase 3: Enable Hybrid Search

After embeddings are complete:

```bash
# Verify embeddings exist
polsearch db tables
# Should show both text_fts and text_embeddings tables

# Use hybrid search (combines FTS + semantic)
polsearch search "immigration policy" --mode hybrid
```

## Architecture

### Tables

| Table | Purpose | Has Vectors |
|-------|---------|-------------|
| `text_fts` | Fast FTS-only search | No |
| `text_embeddings` | Semantic + hybrid search | Yes (384-dim) |

### Search Modes

| Mode | Table | Speed | Quality |
|------|-------|-------|---------|
| `fts` | text_fts | Fastest | Good for exact/fuzzy matches |
| `semantic` | text_embeddings | Slow (requires embeddings) | Best for meaning-based search |
| `hybrid` | text_embeddings | Slow (requires embeddings) | Combines FTS + semantic |

## Content Types

- **hearing**: Congressional hearing transcript segments
- **floor_speech**: Congressional Record floor speech segments
- **vote**: Roll call vote metadata (question + subject + result)

## CLI Usage

### FTS Ingest Command

```bash
polsearch fts ingest \
  --hearings-path data/transcripts \
  --speeches-path data/floor_speech_transcripts \
  --votes \
  [--limit N] \
  [--force] \
  [--dry-run]
```

**Options:**

| Option | Description |
|--------|-------------|
| `--hearings-path` | Directory containing hearing transcript JSON files |
| `--speeches-path` | Directory containing floor speech JSON files |
| `--votes` | Ingest votes from PostgreSQL |
| `--limit N` | Limit number of files to process (for testing) |
| `--force` | Re-process even if content already exists |
| `--dry-run` | Show what would be processed without making changes |

### FTS Index Command

```bash
polsearch fts index
```

Creates FTS index on the `text_fts` table for faster searches.

## Schema

### text_fts Table

| Column | Type | Description |
|--------|------|-------------|
| `id` | Utf8 | Unique identifier (UUID) |
| `content_type` | Utf8 | "hearing", "floor_speech", or "vote" |
| `content_id` | Utf8 | UUID of parent record |
| `statement_id` | Utf8 | UUID of statement (null for votes) |
| `segment_index` | Int32 | Segment index within content |
| `text` | Utf8 | Searchable text content |

## When Embeddings Are Complete

1. **Verify completion**: `polsearch db tables` shows `text_embeddings` with expected row count
2. **Create vector index**: `polsearch db index`
3. **Switch default mode**: Update search to use `--mode hybrid` for best results
4. **Optional cleanup**: The `text_fts` table can be kept for fast-path searches or removed

## Troubleshooting

### FTS returns no results
- Check table exists: `polsearch db tables`
- Verify FTS index: `polsearch db show text_fts --limit 5`
- Ensure ingestion completed: check for errors in output

### Hybrid search fails
- Embeddings not complete yet - use `--mode fts` until done
- Missing vector index: run `polsearch db index`

### Performance

FTS ingestion is expected to be 10-100x faster than full embedding ingestion because:
1. No embedding model inference (CPU/GPU intensive)
2. Simple text storage only
3. Batch writes to LanceDB

Typical performance:
- FTS ingestion: ~100-500 files/second
- Full embedding ingestion: ~1-10 files/second (depends on hardware)
