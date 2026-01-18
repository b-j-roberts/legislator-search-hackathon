# Spec: Internet Archive TV Clips for “Transnational Repression” Demo

## Overview
Ingest a small, curated set of Internet Archive TV News clips into the existing PolSearch RAG corpus so that:
- `/search` returns **TV clip snippets** alongside congressional hearings/speeches/votes.
- The UI can show a **Media** tab with **clickable citations** that open the Internet Archive embed player at the relevant timestamp.

This spec prioritizes **demo reliability** (curation + small volume) over fully automated ingestion.

---

## Requirements

### Functional
- Search returns TV clip segments when the query is relevant.
- Citations deep-link to an Internet Archive **embed** URL with timestamp parameters.
- 5–10 curated clips relevant to “transnational repression”.
- Clips without usable transcript/snippet are skipped (with a warning).

### Non-Functional
- Reuse existing `media-tv-archive` output (transcript snippets; not full ASR).
- Separate workflow: **search → curate → prepare → ingest**.
- Keep ingestion lightweight (avoid long Rust compile cycles where possible).

---

## Background / Key Constraint (Hybrid vs FTS)
`polsearch-api`’s `mode=hybrid` queries **only** the `text_embeddings` table. If media segments are ingested only into `text_fts`, they will appear in `mode=fts`/`mode=phrase` results but **not** `mode=hybrid`.

**Demo recommendation:**
- Use `mode=phrase` (or `mode=fts`) for the Media tab, and keep Documents as-is.
- Optional upgrade (higher effort): also embed media segments into the embeddings table so `mode=hybrid` includes media.

---

## Architecture

### Data Flow
```
media-tv-archive test/search → YAML output → curate YAML → prepare → chunks.json
                                                                  ↓
                                                   ingest_media.py → LanceDB (text_fts)
                                                                  ↓
                                                   polsearch-api (/search)
                                                                  ↓
                                            Chat UI (Media tab + citations)
```

**Rust** responsibilities (recommended):
- Parse YAML, normalize URLs, chunk text, output JSON.

**Python** responsibilities:
- Insert JSON rows into LanceDB `text_fts` (fast iteration).

---

## Storage Schema

### LanceDB table: `text_fts`
This table already exists in the PolSearch ecosystem as the “FTS-only” table.

Fields:
| Field | Type | Notes |
|------:|------|------|
| `id` | string (UUID) | Unique segment ID |
| `content_type` | string | `"media"` |
| `content_id` | string | Canonical clip identifier; **use the embed URL** (stable, directly clickable) |
| `statement_id` | string or null | Must be nullable in Arrow schema |
| `segment_index` | int | Chunk position within the clip |
| `text` | string | ~150-word chunk |

**Important:** `statement_id` is `null` for this demo flow; the ingestion schema must mark it nullable.

---

## URL Normalization (Internet Archive)
Internet Archive links come in multiple shapes. We need a stable “open player” URL for citations.

### Desired output (citation target)
- `https://archive.org/embed/{identifier}?start={start_sec}&end={end_sec}`

### Inputs we may encounter
- Details page:
  - `https://archive.org/details/{identifier}`
- Details page with clip params (sometimes):
  - `https://archive.org/details/{identifier}?start=120&end=180`
- Direct download MP4 with `t=` style fragments (seen in some pipelines):
  - `https://archive.org/download/{identifier}/{identifier}.mp4?t=389/449&ignore=x.mp4`

### Normalization rules
- Always extract `{identifier}`.
- If `start/end` are present, preserve them into `embed` query params.
- If `t=a/b` is present, map to `start=a` and `end=b`.
- If no timing is available, use the plain embed URL:
  - `https://archive.org/embed/{identifier}`

---

## Implementation Plan

### 1) Find candidate clips
Use `media-tv-archive` in “query mode” to discover relevant segments quickly:

```bash
# Example: targeted query (fast iteration)
cargo run --manifest-path media-tv-archive/Cargo.toml -- \
  test --query "\"Marco Rubio\" \"transnational repression\"" --limit 10
```

If sparse, broaden queries:
- `"Chinese police stations"`
- `"diaspora intimidation"`
- `"foreign agents harassment"`
- `"CCP harassment"`

Then fetch appearances for a chosen lawmaker name (produces YAML for curation):
```bash
cargo run --manifest-path media-tv-archive/Cargo.toml -- \
  search --name "Marco Rubio" --bioguide-id R000595 --max-results 50 --output rubio_tv.yaml
```

### 2) Curate YAML (human-in-the-loop)
Create a curated YAML containing only 5–10 best clips for the demo:
- Prefer C‑SPAN when possible (clearer provenance).
- Prefer clips that clearly contain the phrase/topic terms in the snippet.

### 3) Prepare chunks JSON (Rust)
Add a `prepare` subcommand to `media-tv-archive`:

```bash
cargo run --manifest-path media-tv-archive/Cargo.toml -- \
  prepare --input curated_tv.yaml --output chunks.json --chunk-words 150
```

Prepare logic:
- Parse YAML (`MediaAppearanceOutput`)
- Require a transcript snippet in each appearance (skip if missing)
- Normalize URL → embed URL (per rules above)
- Chunk transcript into ~150-word segments
- For each chunk:
  - Generate `id` (UUID)
  - Set `content_type = "media"`
  - Set `content_id = embed_url_with_time` (primary citation URL)
  - `statement_id = null`
  - `segment_index = 0..N`
  - `text = chunk_text` (optional: prefix with `[Outlet | Date]` for nicer display)

Output format (`chunks.json`):
```json
[
  {
    "id": "uuid-string",
    "content_type": "media",
    "content_id": "https://archive.org/embed/CSPAN_...?start=120&end=180",
    "statement_id": null,
    "segment_index": 0,
    "text": "transcript chunk..."
  }
]
```

### 4) Insert into LanceDB (Python)
Create `video-processing/scripts/ingest_media.py`:
- Reads `chunks.json`
- Inserts into `text_fts`
- Uses a schema with **nullable** `statement_id`

Usage:
```bash
python video-processing/scripts/ingest_media.py --db ~/.polsearch/lancedb --json chunks.json
```

### 5) UI: Media tab
In the UI, show a **Media** tab if any search result has `content_type === "media"`.

For each media result, render:
- snippet (`text`)
- “Open clip” linking to:
  - `source_url` if API sets it, else `content_id_str` (FTS results) / `content_id` (if preserved)

**Important UX note:** keep Documents as the default; Media is additive.

---

## API Notes

### Minimal approach (no API changes)
- Media chunks live in `text_fts`.
- Query `mode=phrase` or `mode=fts`.
- Use `content_id_str` from `/search` results as the URL (it will contain our embed URL).

### Optional cleanup (small API changes)
- Add `media` to `ContentType` enum so clients can request `type=media`.
- For `content_type="media"`, copy `content_id_str` into `source_url` in the response so the UI can link consistently.

---

## Verification

```bash
# Media-only search (if API supports type=media); otherwise just use query and filter client-side
curl -s "http://localhost:3000/search?q=transnational%20repression&mode=phrase&enrich=false"
```

Expected:
- Some results have `content_type: "media"`
- For those results, `content_id_str` contains `https://archive.org/embed/...`

---

## Demo Flow
1. Ask: “What are lawmakers saying about transnational repression?”
2. Show Documents tab (hearings/speeches) with citations.
3. Click Media tab → show TV clip snippets.
4. Click “Open clip” → Internet Archive player opens at the relevant timestamp.
5. Tie it together: “This topic appears both in congressional record and on broadcast media.”

