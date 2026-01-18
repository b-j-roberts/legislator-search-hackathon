# PolSearch API Reference

Base URL: `${BASE_URL}`

## Endpoints

### GET /health

Health check endpoint.

**Response:**

```json
{
  "status": "ok"
}
```

---

### GET /search

Search congressional hearings, floor speeches, and votes.

**Query Parameters:**

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `q` | string | Yes | - | Search query text (non-empty) |
| `mode` | string | No | `hybrid` | Search mode: `hybrid`, `vector`, `fts`, `phrase` |
| `type` | string | No | `all` | Content types (comma-separated): `hearing`, `floor_speech`, `vote`, `all` |
| `speaker` | string | No | - | Filter by speaker name (fuzzy match) |
| `committee` | string | No | - | Filter by committee name (fuzzy match, hearings only) |
| `chamber` | string | No | - | Filter by chamber: `house`, `senate` |
| `congress` | integer | No | - | Filter by congress number |
| `from` | string | No | - | Start date filter (YYYY-MM-DD or YYYY-MM) |
| `to` | string | No | - | End date filter (YYYY-MM-DD or YYYY-MM) |
| `limit` | integer | No | 10 | Results per page (1-100) |
| `offset` | integer | No | 0 | Pagination offset |
| `enrich` | boolean | No | true | Include metadata from PostgreSQL |
| `context` | integer | No | 0 | Number of context segments before/after (0-10) |
| `context_scope` | string | No | `same` | Context scope: `same` (same content) or `related` |

**Search Modes:**

- `hybrid`: Combines vector similarity + full-text search for best quality
- `vector`: Semantic similarity using embeddings only
- `fts`: Keyword-based full-text search
- `phrase`: Exact phrase matching

**Response:**

```json
{
  "query": "climate change",
  "mode": "hybrid",
  "mode_used": "hybrid",
  "results": [
    {
      "content_id": "550e8400-e29b-41d4-a716-446655440000",
      "segment_index": 42,
      "text": "The impacts of climate change on coastal communities...",
      "start_time_ms": 123000,
      "end_time_ms": 145000,
      "score": 0.95,
      "content_type": "hearing",
      "speaker_name": "Dr. Jane Smith",
      "title": "Climate Change Impacts on U.S. Infrastructure",
      "date": "2023-06-15",
      "source_url": "https://www.govinfo.gov/...",
      "committee": "Committee on Science, Space, and Technology",
      "chamber": "House",
      "congress": 118,
      "context_before": ["Previous segment text..."],
      "context_after": ["Following segment text..."]
    }
  ],
  "total_returned": 10,
  "has_more": true,
  "next_offset": 10
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `query` | string | Original search query |
| `mode` | string | Requested search mode |
| `mode_used` | string | Actual mode used (may differ if fallback occurred) |
| `results` | array | Array of search results |
| `total_returned` | integer | Number of results in this response |
| `has_more` | boolean | Whether more results are available |
| `next_offset` | integer | Offset for next page (if has_more is true) |

**Result Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `content_id` | UUID | Content identifier |
| `segment_index` | integer | Segment position within content |
| `text` | string | The matching text segment |
| `start_time_ms` | integer | Start time in milliseconds (audio content) |
| `end_time_ms` | integer | End time in milliseconds (audio content) |
| `score` | float | Relevance score (0-1, higher is better) |
| `content_type` | string | Type: `hearing`, `floor_speech`, or `vote` |
| `speaker_name` | string | Speaker name (if available) |
| `title` | string | Content title (when enriched) |
| `date` | string | Content date YYYY-MM-DD (when enriched) |
| `source_url` | string | GovInfo source URL (when enriched) |
| `committee` | string | Committee name (hearings only, when enriched) |
| `chamber` | string | Chamber: House, Senate, or both (when enriched) |
| `congress` | integer | Congress number (hearings only, when enriched) |
| `context_before` | array | Preceding text segments (when context > 0) |
| `context_after` | array | Following text segments (when context > 0) |

**Error Responses:**

- `400`: Validation error (e.g., missing or empty query)
- `500`: Internal server error

---

### GET /content/{id}

Get full content details by UUID.

**Path Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | UUID | Content identifier |

**Response (Hearing):**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "content_type": "hearing",
  "title": "Climate Change Impacts on U.S. Infrastructure",
  "date": "2023-06-15",
  "source_url": "https://www.govinfo.gov/...",
  "committee": "Committee on Science, Space, and Technology",
  "chambers": "House",
  "congress": 118,
  "total_statements": 45,
  "total_segments": 234
}
```

**Response (Vote):**

```json
{
  "id": "019bce64-977b-7993-a2b7-30ddfcfbb7be",
  "content_type": "vote",
  "title": "On Passage: H R 21 Born-Alive Abortion Survivors Protection Act",
  "date": "2025-01-23",
  "source_url": "https://clerk.house.gov/evs/2025/roll027.xml",
  "chambers": "House",
  "congress": 119,
  "total_statements": 0,
  "total_segments": 1,
  "vote_result": "Passed",
  "vote_result_text": "Passed",
  "vote_type": "On Passage of the Bill",
  "category": "passage",
  "vote_counts": {
    "yea": 217,
    "nay": 212,
    "present": 1,
    "not_voting": 3
  }
}
```

**Response Fields:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Content identifier |
| `content_type` | string | Type: `hearing`, `floor_speech`, or `vote` |
| `title` | string | Content title (vote question for votes) |
| `date` | string | Date in YYYY-MM-DD format |
| `source_url` | string | Link to original document |
| `committee` | string | Committee name (hearings only) |
| `chambers` | string | Chamber(s): House, Senate, or "House, Senate" for joint |
| `congress` | integer | Congress number (hearings and votes) |
| `page_type` | string | Page type (floor speeches only) |
| `total_statements` | integer | Number of statements in content |
| `total_segments` | integer | Number of searchable segments |
| `vote_result` | string | Vote outcome: "Passed", "Failed", etc. (votes only) |
| `vote_result_text` | string | Full result text like "Passed (215-206)" (votes only) |
| `vote_type` | string | Vote type: "On Passage", "On the Nomination", etc. (votes only) |
| `category` | string | Vote category: "passage", "amendment", "procedural", etc. (votes only) |
| `vote_counts` | object | Vote tally breakdown (votes only) |

**Vote Counts Object:**

| Field | Type | Description |
|-------|------|-------------|
| `yea` | integer | Number of yea votes |
| `nay` | integer | Number of nay votes |
| `present` | integer | Number of present votes |
| `not_voting` | integer | Number not voting |

**Error Responses:**

- `404`: Content not found
- `500`: Internal server error

---

## Examples

### Search for healthcare legislation mentions

```bash
curl "${BASE_URL}/search?q=affordable%20care%20act&type=floor_speech&chamber=senate"
```

### Find testimony about AI regulation

```bash
curl "${BASE_URL}/search?q=artificial%20intelligence%20regulation&type=hearing&committee=Commerce"
```

### Search with exact phrase matching

```bash
curl "${BASE_URL}/search?q=threat%20to%20democracy&mode=phrase"
```

### Get context around a match

```bash
curl "${BASE_URL}/search?q=border%20security&context=5"
```

### Paginate through results

```bash
# First page
curl "${BASE_URL}/search?q=economic%20policy&limit=20"

# Next page
curl "${BASE_URL}/search?q=economic%20policy&limit=20&offset=20"
```
