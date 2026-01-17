# Congressional Record Data Pipeline - Specification

## Overview

This pipeline fetches all U.S. Congressional Record entries from 2020-2026 and outputs them as a structured YAML file. The Congressional Record is the official daily record of debates, proceedings, and activities of the U.S. Congress.

## Data Sources

### Primary: Congress.gov API (Daily Congressional Record)
- **Endpoint**: `https://api.congress.gov/v3/daily-congressional-record`
- **Authentication**: Free API key from [api.data.gov](https://api.data.gov/signup/)
- **Rate Limit**: 5,000 requests/hour (with proper key), 40/hour (demo key)
- **Coverage**: Daily Congressional Record from 1995 forward

### Secondary: GovInfo (GPO)
- **Collection**: `CREC` (Congressional Record Daily)
- **Coverage**: Official published records
- **Note**: Bound version available as `CRECB`

## YAML Schema

```yaml
metadata:
  generated_at: "2026-01-17T12:00:00"  # ISO 8601 timestamp
  date_range:
    start: "2020-01-01"
    end: "2026-12-31"
  congresses: [116, 117, 118, 119]
  total_records: 15000  # approximate
  total_articles: 250000  # approximate
  mode: "full"  # or "fast"
  source: "Congress.gov API (api.congress.gov)"

records:
  - volume: 166
    issue: 1
    date: "2020-01-03"
    congress: 116
    session: 2
    sections:
      - name: "Senate"
        start_page: "S1"
        end_page: "S50"
        article_count: 25
      - name: "House of Representatives"
        start_page: "H1"
        end_page: "H100"
        article_count: 45
      - name: "Extensions of Remarks"
        start_page: "E1"
        end_page: "E20"
        article_count: 30
      - name: "Daily Digest"
        start_page: "D1"
        end_page: "D10"
        article_count: 5

    sources:
      - url: "https://www.congress.gov/congressional-record/volume-166/issue-1"
        type: "html"
        source: "congress.gov"
        description: "Full issue view"
      - url: "https://www.govinfo.gov/content/pkg/CREC-2020-01-03/pdf/CREC-2020-01-03.pdf"
        type: "pdf"
        source: "govinfo"
        description: "Full issue PDF"

    articles:
      - title: "Prayer"
        section: "Senate"
        start_page: "S1"
        end_page: "S1"
        type: "procedural"  # procedural, speech, legislation, tribute, other
        sources:
          - url: "https://www.congress.gov/congressional-record/..."
            type: "text"

      - title: "PROVIDING FOR CONSIDERATION OF H.R. 1234"
        section: "House of Representatives"
        start_page: "H15"
        end_page: "H25"
        type: "legislation"
        related_bills:
          - "HR1234"
        members_mentioned:
          - name: "Rep. John Smith"
            party: "D"
            state: "CA"
        sources:
          - url: "https://..."
            type: "pdf"
```

## Record Types/Classifications

Articles are classified into the following types based on title and content analysis:

| Type | Description | Examples |
|------|-------------|----------|
| `procedural` | Routine congressional procedures | Prayer, Pledge of Allegiance, Adjournment, Quorum calls |
| `legislation` | Discussion of bills and resolutions | Debate on H.R. 1234, Amendment consideration |
| `speech` | Floor speeches by members | Morning Business speeches, One-minute speeches |
| `tribute` | Honoring individuals or groups | Memorials, Recognitions, Commemorations |
| `extension` | Extended remarks (not spoken on floor) | Statements submitted for the record |
| `digest` | Daily Digest summaries | Chamber activity summaries |
| `other` | Uncategorized entries | Miscellaneous items |

## Sections in Congressional Record

| Section | Content |
|---------|---------|
| Senate | All Senate floor proceedings |
| House of Representatives | All House floor proceedings |
| Extensions of Remarks | Statements submitted but not spoken |
| Daily Digest | Summary of day's activities |

## Congresses Covered

| Congress | Session Dates | Years Covered |
|----------|--------------|---------------|
| 116th | Jan 3, 2019 - Jan 3, 2021 | 2020 |
| 117th | Jan 3, 2021 - Jan 3, 2023 | 2021-2022 |
| 118th | Jan 3, 2023 - Jan 3, 2025 | 2023-2024 |
| 119th | Jan 3, 2025 - Jan 3, 2027 | 2025-2026 |

## Estimated Data Volume

Based on API queries:
- **Daily Issues**: ~400-500 per year (Congress in session ~200 days/year x 2 chambers)
- **2020-2026**: ~2,500-3,000 daily issues
- **Articles per Issue**: ~50-150
- **Total Articles**: ~200,000-300,000

## Pipeline Components

### 1. `fetch_congressional_records.py`
Main fetcher script that:
- Queries Congress.gov Daily Congressional Record API
- Fetches issue-level and article-level data
- Classifies articles by type
- Filters by date range (2020-01-01 to 2026-12-31)
- Outputs structured YAML
- Supports checkpointing for resumable runs

**Usage:**
```bash
# Full fetch (requires API key)
export CONGRESS_API_KEY="your_key_here"
python fetch_congressional_records.py

# Fast mode (issue-level only, no articles)
python fetch_congressional_records.py --fast

# Single congress
python fetch_congressional_records.py --congress 118

# Resume interrupted fetch
python fetch_congressional_records.py --resume

# Test with sample
python fetch_congressional_records.py --sample 10
```

### 2. `enrich_records.py` (future)
Post-processing script that could add:
- GovInfo PDF links
- Full text extraction
- Member mention analysis

## Field Availability

| Field | Availability | Notes |
|-------|-------------|-------|
| volume | 100% | Always present |
| issue | 100% | Always present |
| date | 100% | Always present |
| congress | 100% | Always present |
| session | 100% | Always present |
| sections | ~95% | Most issues have sections |
| articles | ~80% | Available in full mode |
| article.type | ~90% | Classified from title |
| related_bills | ~30% | When legislation discussed |
| members_mentioned | ~20% | Requires text parsing |

## Known Limitations

1. **Text Content**: Full text of articles not always directly available via API
2. **Member Extraction**: Requires NLP/parsing of article text
3. **Bill References**: Must be extracted from titles/text
4. **Bound vs Daily**: Bound Congressional Record differs slightly in formatting
5. **Recess Periods**: No records during congressional recesses

## API Key Setup

1. Go to [api.data.gov/signup](https://api.data.gov/signup/)
2. Enter your email
3. Receive API key instantly via email
4. Set environment variable:
   ```bash
   export CONGRESS_API_KEY="your_key_here"
   ```

## Output Files

- `congressional_records_2020_2026.yaml` - Main output
- `records_checkpoint.json` - Resumable progress (deleted on completion)

## Dependencies

```
requests>=2.28.0
pyyaml>=6.0
```

Install with:
```bash
pip install -r requirements.txt
```

## API Response Examples

### Issue List Response
```json
{
  "dailyCongressionalRecord": [
    {
      "issueNumber": "1",
      "volumeNumber": "166",
      "issueDate": "2020-01-03",
      "congress": 116,
      "sessionNumber": "2",
      "url": "https://api.congress.gov/v3/daily-congressional-record/166/1"
    }
  ]
}
```

### Issue Detail Response
```json
{
  "issue": {
    "issueNumber": "1",
    "volumeNumber": "166",
    "issueDate": "2020-01-03",
    "congress": 116,
    "sessionNumber": "2",
    "entireIssue": {
      "formats": [
        {"type": "PDF", "url": "https://..."}
      ]
    },
    "sections": [
      {
        "name": "Senate",
        "startPage": "S1",
        "endPage": "S50"
      }
    ],
    "articles": {
      "count": 125,
      "url": "https://api.congress.gov/v3/daily-congressional-record/166/1/articles"
    }
  }
}
```

### Articles Response
```json
{
  "articles": [
    {
      "section": "Senate",
      "sectionArticles": [
        {
          "title": "PRAYER",
          "startPage": "S1",
          "endPage": "S1",
          "text": [
            {"type": "PDF", "url": "https://..."},
            {"type": "Formatted Text", "url": "https://..."}
          ]
        }
      ]
    }
  ]
}
```
