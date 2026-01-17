# Congressional Hearings Data Pipeline - Specification

## Overview

This pipeline fetches all U.S. congressional hearings from 2020-2026 and outputs them as a structured YAML file. The data includes hearing metadata, source links (transcripts, videos, audio), and information about participants (Congress members and witnesses).

## Data Sources

### Primary: Congress.gov API
- **Endpoint**: `https://api.congress.gov/v3/committee-meeting/{congress}/{chamber}`
- **Authentication**: Free API key from [api.data.gov](https://api.data.gov/signup/)
- **Rate Limit**: 5,000 requests/hour (with proper key), 40/hour (demo key)
- **Coverage**: Committee meetings/hearings from 104th Congress (1995) forward

### Secondary: GovInfo (GPO)
- **Endpoint**: `https://api.govinfo.gov/`
- **Collection**: `CHRG` (Congressional Hearings)
- **Coverage**: Official published transcripts (104th Congress forward)
- **Note**: Not all hearings are published; 2 months to 2+ years publication delay

### Supplementary Sources (for enrichment)
- **C-SPAN Video Library**: Video archives from 1986-present
- **Committee Websites**: Live webcasts and archived video
- **YouTube**: Individual committee channels

## YAML Schema

```yaml
metadata:
  generated_at: "2026-01-17T12:00:00"  # ISO 8601 timestamp
  date_range:
    start: "2020-01-01"
    end: "2026-12-31"
  congresses: [116, 117, 118, 119]
  total_hearings: 12500  # approximate
  mode: "full"  # or "fast"
  source: "Congress.gov API (api.congress.gov)"

hearings:
  - title: "Hearing title from Congress.gov"
    date: "2024-06-12"  # ISO 8601 date, null if unknown
    end_date: null  # For multi-day hearings
    congress: 118
    chamber: "House"  # "House", "Senate", or "Joint"
    type: "Hearing"  # "Hearing", "Markup", or "Meeting"
    committee: "House Committee on Natural Resources"
    subcommittee: "Subcommittee on Energy and Mineral Resources"  # null if N/A
    status: "Scheduled"  # "Scheduled", "Completed", "Canceled", "Postponed"
    location: "2154 Rayburn House Office Building"  # null if unknown

    sources:
      - url: "https://www.congress.gov/118/meeting/house/..."
        type: "video"  # "text", "video", "audio", "pdf", "html"
        source: "congress.gov"  # "congress.gov", "govinfo", "c-span", etc.
        description: "Committee hearing video"
      - url: "https://www.govinfo.gov/content/pkg/CHRG-118shrg..."
        type: "pdf"
        source: "govinfo"
        description: "Official GPO transcript (PDF)"

    members: null  # List of Congress members (when available)
    # Example if populated:
    # members:
    #   - name: "Rep. John Smith"
    #     role: "chair"
    #     party: "D"
    #     state: "CA"

    witnesses:
      - name: "Jane Doe"
        title: "CEO"
        organization: "Example Corporation"
      - name: "Dr. John Public"
        title: "Professor of Economics"
        organization: "State University"

    related_bills:
      - "HR226"
      - "HR7543"
```

## Congresses Covered

| Congress | Session Dates | Years Covered |
|----------|--------------|---------------|
| 116th | Jan 3, 2019 – Jan 3, 2021 | 2020 |
| 117th | Jan 3, 2021 – Jan 3, 2023 | 2021-2022 |
| 118th | Jan 3, 2023 – Jan 3, 2025 | 2023-2024 |
| 119th | Jan 3, 2025 – Jan 3, 2027 | 2025-2026 |

## Estimated Data Volume

Based on API queries:
- **116th Congress**: ~3,000 meetings (2019-2021)
- **117th Congress**: ~3,500 meetings (2021-2023)
- **118th Congress**: ~4,000 meetings (2023-2025)
- **119th Congress**: ~1,000+ meetings (2025-present, ongoing)

**Total (2020-2026 only)**: ~10,000-12,000 hearings

## Pipeline Components

### 1. `fetch_congressional_hearings.py`
Main fetcher script that:
- Queries Congress.gov Committee Meeting API
- Fetches detailed meeting information (witnesses, documents, videos)
- Filters by date range (2020-01-01 to 2026-12-31)
- Outputs structured YAML
- Supports checkpointing for resumable runs

**Usage:**
```bash
# Full fetch (requires API key, ~2-3 hours)
export CONGRESS_API_KEY="your_key_here"
python fetch_congressional_hearings.py

# Fast mode (basic info only, ~30 minutes)
python fetch_congressional_hearings.py --fast

# Single congress
python fetch_congressional_hearings.py --congress 118

# Resume interrupted fetch
python fetch_congressional_hearings.py --resume

# Test with sample
python fetch_congressional_hearings.py --sample 10 --congress 118
```

### 2. `enrich_hearings.py`
Post-processing script that adds:
- GovInfo transcript links (searches for matching published transcripts)
- C-SPAN video search links

**Usage:**
```bash
python enrich_hearings.py congressional_hearings_2020_2026.yaml
# Outputs: congressional_hearings_2020_2026_enriched.yaml
```

## Field Availability

| Field | Availability | Notes |
|-------|-------------|-------|
| title | ~100% | Always present |
| date | ~99% | May be null for unscheduled |
| congress | 100% | Always present |
| chamber | 100% | Always present |
| type | ~95% | Hearing, Markup, or Meeting |
| committee | ~98% | Usually present |
| status | ~90% | From meeting data |
| location | ~70% | Not always provided |
| sources | ~60% | Videos more common than transcripts |
| witnesses | ~40% | Only in detailed fetch mode |
| members | ~5% | Rarely directly available |
| related_bills | ~20% | When relevant legislation discussed |

## Known Limitations

1. **Publication Lag**: Official transcripts take 2 months to 2+ years to appear on GovInfo
2. **Not All Published**: Committees decide which hearings to publish; some never are
3. **Witness Data**: Only available when fetching detailed meeting info (slower)
4. **Member Participation**: Not directly available in API; would require parsing transcripts
5. **Audio-Only**: Some hearings are audio-only; not distinguished in metadata
6. **Historical Gaps**: Executive sessions and classified hearings remain sealed 20-50 years

## API Key Setup

1. Go to [api.data.gov/signup](https://api.data.gov/signup/)
2. Enter your email
3. Receive API key instantly via email
4. Set environment variable:
   ```bash
   export CONGRESS_API_KEY="your_key_here"
   ```

## Output Files

- `congressional_hearings_2020_2026.yaml` - Main output
- `congressional_hearings_2020_2026_enriched.yaml` - With additional sources
- `hearings_checkpoint.json` - Resumable progress (deleted on completion)

## Dependencies

```
requests>=2.28.0
pyyaml>=6.0
```

Install with:
```bash
pip install -r requirements.txt
```
