# Congress Search

Search congressional hearings, floor speeches, and votes using the PolSearch API.

## Triggers

Use this skill when the user wants to:
- Search congressional hearings
- Find floor speeches by topic, speaker, or date
- Look up what was said in Congress about a topic
- Find statements by specific legislators
- Search for committee hearings
- Query the congressional record

## API Base URL

```
${BASE_URL}
```

Set `BASE_URL` to the API server address (e.g., `http://localhost:3000` or your deployed server).

## Quick Start

### Basic Search

Search for mentions of "climate change" in congressional records:

```bash
curl "${BASE_URL}/search?q=climate%20change"
```

### Search Floor Speeches

Find floor speeches about immigration:

```bash
curl "${BASE_URL}/search?q=immigration&type=floor_speech"
```

### Search by Speaker

Find statements by a specific speaker:

```bash
curl "${BASE_URL}/search?q=healthcare&speaker=Pelosi"
```

### Search Hearings by Committee

Search for hearings from a specific committee:

```bash
curl "${BASE_URL}/search?q=cybersecurity&type=hearing&committee=Homeland%20Security"
```

### Search with Date Range

Find content from a specific time period:

```bash
curl "${BASE_URL}/search?q=infrastructure&from=2023-01-01&to=2023-12-31"
```

### Search by Chamber

Search only House or Senate content:

```bash
curl "${BASE_URL}/search?q=budget&chamber=senate"
```

### Search Votes

Find roll call votes on a topic:

```bash
curl "${BASE_URL}/search?q=immigration&type=vote"
```

### Get Vote Details

Get full vote information including vote counts:

```bash
curl "${BASE_URL}/content/{vote-uuid}"
```

Returns vote result, vote type, category, and full breakdown (yea/nay/present/not_voting).

### Get More Context

Include surrounding segments for better context (up to 10 segments before/after):

```bash
curl "${BASE_URL}/search?q=tariffs&context=3"
```

### Get Full Content Details

After finding a result, get full metadata by content ID:

```bash
curl "${BASE_URL}/content/{uuid}"
```

## Search Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `hybrid` | Combines vector + full-text search (default) | Best overall quality |
| `vector` | Semantic similarity using embeddings | Finding conceptually related content |
| `fts` | Keyword-based full-text search | Finding exact terms |
| `phrase` | Exact phrase matching | Finding specific quotes |

Example with mode:

```bash
curl "${BASE_URL}/search?q=tax%20reform&mode=phrase"
```

## Content Types

| Type | Description |
|------|-------------|
| `hearing` | Congressional committee hearings |
| `floor_speech` | Speeches on the House or Senate floor |
| `vote` | Voting records |
| `all` | Search all content types (default) |

Multiple types can be comma-separated:

```bash
curl "${BASE_URL}/search?q=defense&type=hearing,floor_speech"
```

## Response Format

Search results include:
- `content_id`: UUID of the hearing/speech
- `text`: The matching text segment
- `score`: Relevance score (0-1, higher is better)
- `content_type`: Type of content (hearing, floor_speech, vote)
- `speaker_name`: Who said it (if available)
- `title`: Title of the hearing/speech
- `date`: Date of the content
- `source_url`: Link to original document on GovInfo
- `committee`: Committee name (hearings only)
- `chamber`: House, Senate, or both
- `congress`: Congress number (hearings only)
- `context_before`/`context_after`: Surrounding segments (when context > 0)

## Pagination

Use `limit` and `offset` for pagination:

```bash
# First page (10 results)
curl "${BASE_URL}/search?q=education&limit=10"

# Second page
curl "${BASE_URL}/search?q=education&limit=10&offset=10"
```

The response includes `has_more` and `next_offset` to facilitate pagination.

## Full API Reference

See [references/api_reference.md](references/api_reference.md) for complete endpoint documentation, parameter details, and response schemas.
