# PolSearch API Specification

Technical reference for the PolSearch API - a semantic search service for congressional hearings, floor speeches, and voting records.

> **API Owner:** Praveen Perera
> **Version:** 0.1.0
> **License:** MIT
> **Base URL:** `http://10.246.40.37:3000` (internal network)

---

## Overview

PolSearch provides hybrid search (vector + full-text) over congressional content including:
- **Hearings** - Committee hearing transcripts
- **Floor Speeches** - Speeches delivered on the House/Senate floor
- **Votes** - Roll call voting records

The API supports multiple search modes, rich filtering, pagination, and optional metadata enrichment.

---

## Authentication

Currently no authentication required for internal network access.

---

## Endpoints

### Health Check

```
GET /health
```

**Response:**
```json
{
  "status": "ok"
}
```

---

### Search

```
GET /search
```

Primary search endpoint for querying congressional content.

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | **Yes** | - | Search query text (min 1 char) |
| `mode` | enum | No | `hybrid` | Search mode: `hybrid`, `vector`, `fts`, `phrase` |
| `type` | string | No | `all` | Content types (comma-separated): `hearing`, `floor_speech`, `vote`, `all` |
| `limit` | integer | No | 10 | Results per page (1-100) |
| `offset` | integer | No | 0 | Pagination offset |
| `enrich` | boolean | No | false | Include metadata from PostgreSQL (title, date, speaker, source_url, chamber, committee, congress) |
| `context` | integer | No | 0 | Number of context segments before/after (0-10, 0 = disabled) |
| `context_scope` | enum | No | `same` | Context scope: `same` (same content) or `related` |
| `speaker` | string | No | - | Filter by speaker name (fuzzy match) |
| `committee` | string | No | - | Filter by committee (fuzzy match, hearings only) |
| `chamber` | enum | No | - | Filter by chamber: `house` or `senate` |
| `congress` | integer | No | - | Filter by congress number (e.g., 118) |
| `from` | string | No | - | Start date (`YYYY-MM-DD` or `YYYY-MM`) |
| `to` | string | No | - | End date (`YYYY-MM-DD` or `YYYY-MM`) |

#### Search Modes

| Mode | Description | Best For |
|------|-------------|----------|
| `hybrid` | Combines vector similarity + full-text search | General queries (recommended) |
| `vector` | Pure semantic/embedding search | Conceptual/meaning-based queries |
| `fts` | Full-text search with ranking | Exact term matching |
| `phrase` | Exact phrase matching | Quoted searches, specific terminology |

#### Response Schema

```typescript
interface SearchResponse {
  query: string;           // Original query string
  mode: string;            // Requested search mode
  mode_used: string;       // Actual mode (may differ if fallback)
  results: SearchResult[];
  total_returned: number;  // Number of results returned
  has_more: boolean;       // More results available
  next_offset?: number;    // Offset for next page (if has_more)
}

interface SearchResult {
  // Required fields
  content_id: string;      // UUID of content
  content_type: string;    // "hearing" | "floor_speech" | "vote"
  segment_index: number;   // Segment position within content
  text: string;            // Matching text segment
  score: number;           // Relevance score (0-1, higher = better)
  start_time_ms: number;   // Audio start time (ms)
  end_time_ms: number;     // Audio end time (ms)

  // Optional fields
  content_id_str?: string; // Original ID string (for FTS results)

  // Enriched fields (when enrich=true)
  title?: string;          // Content title
  date?: string;           // Content date (YYYY-MM-DD)
  speaker_name?: string;   // Speaker name
  speaker_type?: string;   // Speaker role: "representative" | "senator" | "presiding_officer" | "witness"
  source_url?: string;     // Direct URL to GovInfo source document
  chamber?: string;        // "House", "Senate", or "House, Senate" (joint)
  committee?: string;      // Committee name (hearings only)
  congress?: number;       // Congress number (hearings only)

  // Context fields (when context > 0)
  context_before?: string[];
  context_after?: string[];
}
```

#### Example Request

```bash
curl "http://10.246.40.72:3000/search?q=climate%20change&type=hearing,floor_speech&chamber=senate&limit=20&enrich=true"
```

#### Example Response

```json
{
  "query": "climate change",
  "mode": "hybrid",
  "mode_used": "hybrid",
  "results": [
    {
      "content_id": "550e8400-e29b-41d4-a716-446655440000",
      "content_type": "hearing",
      "segment_index": 42,
      "text": "The impacts of climate change on coastal communities require immediate federal action...",
      "score": 0.89,
      "start_time_ms": 1234567,
      "end_time_ms": 1245678,
      "title": "Climate Resilience and Infrastructure",
      "date": "2024-03-15",
      "speaker_name": "Sen. Sheldon Whitehouse",
      "source_url": "https://www.govinfo.gov/content/pkg/CHRG-118shrg12345/html/CHRG-118shrg12345.htm",
      "chamber": "Senate",
      "committee": "Environment and Public Works",
      "congress": 118
    }
  ],
  "total_returned": 1,
  "has_more": true,
  "next_offset": 20
}
```

#### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Validation error (missing query, invalid params) |
| 500 | Internal server error |

---

### Get Content Details

```
GET /content/{id}
```

Retrieve full metadata for a specific hearing or floor speech by ID.

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | **Yes** | Content ID from search results |

#### Response Schema

```typescript
interface ContentDetailResponse {
  // Required fields
  id: string;              // UUID
  content_type: string;    // "hearing" | "floor_speech"
  title: string;           // Content title
  total_statements: number; // Total statements in content
  total_segments: number;   // Total searchable segments

  // Optional fields
  date?: string;           // Content date (YYYY-MM-DD)
  chambers?: string;       // "House", "Senate", or "House, Senate"
  committee?: string;      // Committee name (hearings only)
  congress?: number;       // Congress number (hearings only)
  page_type?: string;      // Page type (floor speeches only)
  source_url?: string;     // Direct URL to GovInfo source document
}
```

#### Example Request

```bash
curl "http://10.246.40.72:3000/content/550e8400-e29b-41d4-a716-446655440000"
```

#### Example Response

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "content_type": "hearing",
  "title": "Climate Resilience and Infrastructure",
  "total_statements": 47,
  "total_segments": 312,
  "date": "2024-03-15",
  "chambers": "Senate",
  "committee": "Environment and Public Works",
  "congress": 118,
  "source_url": "https://www.govinfo.gov/content/pkg/CHRG-118shrg12345/html/CHRG-118shrg12345.htm"
}
```

#### Error Responses

| Status | Description |
|--------|-------------|
| 404 | Content not found |
| 500 | Internal server error |

---

## Integration Architecture

### Frontend → PolSearch Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Browser   │────▶│ Next.js API  │────▶│  PolSearch  │
│  (Frontend) │     │   /api/search│     │ 10.246.x.x  │
└─────────────┘     └──────────────┘     └─────────────┘
```

The frontend never calls PolSearch directly. All requests go through Next.js API routes that:
1. Receive request from browser
2. Forward to PolSearch (pure passthrough)
3. Return response to browser

This hides the internal IP and allows future enhancements.

### AI Orchestration Flow

```
User Query → Maple AI → [Structured JSON Output] → Frontend Parses
                                                        ↓
                                          Frontend calls /api/search
                                                        ↓
                                          Results fed back to Maple
                                                        ↓
                                          Maple synthesizes response
```

1. User sends natural language query
2. Maple AI interprets intent and outputs JSON with search parameters
3. Frontend parses JSON, calls PolSearch API
4. Search results fed back to Maple in same conversation
5. Maple synthesizes conversational response citing the results

### Maple JSON Output Format

When Maple decides to search, it outputs a fenced JSON block:

```json
{
  "action": "search",
  "params": {
    "q": "climate change legislation",
    "type": "hearing,floor_speech",
    "speaker": "Whitehouse",
    "chamber": "senate",
    "from": "2023-01-01",
    "limit": 10,
    "enrich": true
  }
}
```

Frontend regex-extracts this JSON and executes the search.

---

## Content Type Details

### Hearings

Congressional committee hearings with witness testimony.

- Filterable by: `committee`, `chamber`, `congress`, date range
- Contains: Transcript segments with speaker attribution
- Audio timestamps: Available for seeking to specific moments
- Source URL: Links directly to GovInfo hearing document

### Floor Speeches

Speeches delivered on the House or Senate floor.

- Filterable by: `speaker`, `chamber`, `congress`, date range
- Contains: Full speech text segmented
- Audio timestamps: Available
- Source URL: Links directly to GovInfo Congressional Record

### Votes

Roll call voting records on bills and amendments.

- Filterable by: `chamber`, `congress`, date range
- Contains: Vote descriptions and outcomes
- Note: Individual legislator votes not in this API (separate data source)

---

## Source URLs

The API now provides `source_url` directly in search results and content details when `enrich=true`. These are direct links to official GovInfo documents.

**No URL construction needed** - the API handles this automatically.

Example source URLs:
- Hearings: `https://www.govinfo.gov/content/pkg/CHRG-118shrg12345/html/CHRG-118shrg12345.htm`
- Floor Speeches: `https://www.govinfo.gov/content/pkg/CREC-2024-03-15/html/CREC-2024-03-15-pt1-PgS1234.htm`

### UI Integration

The existing `DocumentCard` component in `results-panel.tsx:82-128` already has an `ExternalLink` icon. Update it to:
1. Accept `sourceUrl` prop
2. Make the card clickable with `target="_blank"`
3. Open GovInfo source in new tab

```tsx
// Current: ExternalLink icon shown but not functional
<ExternalLink className="size-4 text-muted-foreground/0 group-hover:text-accent" />

// Update: Wrap card in anchor or add onClick
<a href={sourceUrl} target="_blank" rel="noopener noreferrer">
  {/* card content */}
</a>
```

---

## Rate Limits & Performance

- No explicit rate limits documented
- Frontend should debounce rapid user actions
- Typical response time: 100-500ms depending on query complexity
- `enrich=true` adds ~50-100ms latency (recommended for display)

---

## Error Handling

### Retry Strategy

On network failure or 5xx errors:
1. Retry after 1 second
2. Retry after 3 seconds
3. Retry after 5 seconds
4. Show error state to user

### Parse Failure Recovery

If Maple outputs malformed JSON for search:
1. Re-prompt Maple asking it to correct the format
2. If still failing, show AI's conversational response without search results

---

## TypeScript Types

For frontend integration, add these types to `src/lib/types.ts` or create `src/types/search.ts`:

```typescript
// =============================================================================
// PolSearch API Types
// =============================================================================

/** Search mode for queries */
export type SearchMode = "hybrid" | "vector" | "fts" | "phrase";

/** Content type filter */
export type ContentType = "hearing" | "floor_speech" | "vote" | "all";

/** Chamber filter (API uses lowercase) */
export type ApiChamber = "house" | "senate";

/** Context scope for RAG mode */
export type ContextScope = "same" | "related";

/** Search request parameters */
export interface SearchParams {
  q: string;
  mode?: SearchMode;
  type?: string;
  limit?: number;
  offset?: number;
  enrich?: boolean;
  context?: number;
  context_scope?: ContextScope;
  speaker?: string;
  committee?: string;
  chamber?: ApiChamber;
  congress?: number;
  from?: string;
  to?: string;
}

/** Speaker type from PolSearch API */
export type SpeakerType = "representative" | "senator" | "presiding_officer" | "witness";

/** Individual search result */
export interface SearchResult {
  content_id: string;
  content_type: string;
  segment_index: number;
  text: string;
  score: number;
  start_time_ms: number;
  end_time_ms: number;
  content_id_str?: string;
  title?: string;
  date?: string;
  speaker_name?: string;
  speaker_type?: SpeakerType;
  source_url?: string;
  chamber?: string;
  committee?: string;
  congress?: number;
  context_before?: string[];
  context_after?: string[];
}

/** Search API response */
export interface SearchResponse {
  query: string;
  mode: string;
  mode_used: string;
  results: SearchResult[];
  total_returned: number;
  has_more: boolean;
  next_offset?: number;
}

/** Content detail response */
export interface ContentDetailResponse {
  id: string;
  content_type: string;
  title: string;
  total_statements: number;
  total_segments: number;
  date?: string;
  chambers?: string;
  committee?: string;
  congress?: number;
  page_type?: string;
  source_url?: string;
}
```

---

## Speaker Extraction (People Tab)

The frontend extracts unique speakers from search results to populate the "People" tab in the Results Panel.

### How It Works

1. Search results include an optional `speaker_name` field
2. The `useResults` hook extracts unique speakers by normalizing names
3. Speakers are aggregated with metadata from all their appearances:
   - `resultCount`: Number of search results they appear in
   - `chamber`: Inferred from name prefix (Sen./Rep.) or result chamber
   - `contentTypes`: Types of content they appear in (hearing, floor_speech, vote)
   - `committees`: Committees they've spoken in (from hearings)
   - `dateRange`: Earliest and latest appearances
   - `sampleSourceUrls`: Up to 3 source URLs for reference

### Speaker Type

```typescript
interface Speaker {
  id: string;           // Normalized name as ID
  name: string;         // Display name from API
  chamber?: Chamber;    // "House" | "Senate" (if determinable)
  resultCount: number;  // Number of appearances
  contentTypes: string[];
  committees: string[];
  dateRange?: {
    earliest?: string;
    latest?: string;
  };
  sampleSourceUrls: string[];
}
```

### UI Display

Speakers are displayed using the `SpeakerCard` component which shows:
- Avatar with initials
- Name and chamber badge
- Content type badges (Hearing, Floor Speech, Vote)
- Committee list (if any)
- Date range of appearances
- Clickable to open source URL

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design and data flow
- [API_INTEG_ROADMAP.md](./API_INTEG_ROADMAP.md) - Integration implementation plan
- [ROADMAP.md](./ROADMAP.md) - Feature roadmap
