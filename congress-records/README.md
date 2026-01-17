# Congressional Record Fetcher

Fetches all Congressional Record entries (2020-2026) from the Congress.gov API and outputs structured YAML.

## Quick Start

```bash
# Get API key from https://api.data.gov/signup/
export CONGRESS_API_KEY="your_key_here"

# Full fetch (with article details)
python fetch_congressional_records.py

# Fast mode (issue-level only)
python fetch_congressional_records.py --fast

# Test with sample
python fetch_congressional_records.py --sample 10 --congress 118
```

## What This Does

The Congressional Record is the official daily record of the debates and proceedings of the U.S. Congress. This script:

1. Fetches all daily issues from 2020-2026 (116th-119th Congress)
2. Extracts sections (Senate, House, Extensions of Remarks, Daily Digest)
3. Classifies articles by type:
   - `procedural` - Prayer, Pledge, Adjournment, etc.
   - `legislation` - Bill debates, amendments, votes
   - `speech` - Floor speeches, special orders
   - `tribute` - Recognitions, memorials
   - `extension` - Extended remarks (not spoken on floor)
   - `digest` - Daily summaries
4. Extracts bill references from article titles
5. Outputs to `congressional_records_2020_2026.yaml`

## Options

| Flag | Description |
|------|-------------|
| `--fast` | Skip article details (faster, less data) |
| `--resume` | Resume from checkpoint if interrupted |
| `--congress N` | Only fetch specific congress (116, 117, 118, 119) |
| `--sample N` | Only fetch N issues (for testing) |
| `--output FILE` | Custom output file path |

## Output Format

```yaml
metadata:
  generated_at: "2026-01-17T12:00:00"
  total_records: 2500
  total_articles: 250000
  article_types:
    procedural: 50000
    legislation: 80000
    speech: 40000
    tribute: 30000
    extension: 45000
    digest: 5000

records:
  - volume: 170
    issue: 1
    date: "2024-01-03"
    congress: 118
    session: 2
    sections:
      - name: "Senate"
        article_count: 45
    articles:
      - title: "PROVIDING FOR CONSIDERATION OF H.R. 1234"
        section: "House of Representatives"
        type: "legislation"
        related_bills: ["HR1234"]
```

## See Also

- [SPEC.md](./SPEC.md) - Full technical specification
- [Congress.gov API Docs](https://github.com/LibraryOfCongress/api.congress.gov)
