# ADR 001: Hearing Text Storage Architecture

## Status

Accepted

## Context

Hearing transcripts contain full-text content that is used for semantic search. Initially, this text was stored in both PostgreSQL (in `hearing_statements.text` and `hearing_segments.text_preview`) and LanceDB (for vector embeddings and search).

This dual storage created several issues:
- **Data duplication**: Same content stored in two places
- **Storage overhead**: PostgreSQL storing large TEXT fields unnecessarily
- **Consistency risk**: Two sources of truth for the same data

## Decision

**LanceDB is the single source of truth for full-text content.**

PostgreSQL will only store:
- Metadata (ids, timestamps, indexes)
- Relations (foreign keys between hearings, statements, segments)
- Derived data (`word_count` for filtering)

The following columns are removed from PostgreSQL:
- `hearing_statements.text`
- `hearing_segments.text_preview`

## Consequences

### Positive
- Single source of truth for text content
- Reduced PostgreSQL storage requirements
- Simpler data consistency model
- Cleaner separation of concerns (Postgres = metadata, LanceDB = content + search)

### Negative
- Cannot query full text directly from PostgreSQL
- Must join with LanceDB for any operation requiring text content
- Slightly more complex retrieval for display purposes

### Neutral
- `word_count` is still stored in PostgreSQL (computed during ingestion)
- All existing queries that only need metadata continue to work
- Search operations remain unchanged (already use LanceDB)

## Implementation

1. Migration drops `text` from `hearing_statements` and `text_preview` from `hearing_segments`
2. Models updated to remove these fields
3. Ingestion pipeline calculates `word_count` before creating statements
4. Text continues to be written to LanceDB during ingestion
