# Congressional Vote Fetcher

Fetches US Congressional vote data (House and Senate) from 2020-2026 and compiles it into a YAML file.

## Setup

1. **Get an API Key**
   - Go to https://api.congress.gov/sign-up/
   - Fill out the form (requires JavaScript enabled in browser)
   - You'll receive the API key via email

2. **Install Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set Environment Variable**
   ```bash
   export CONGRESS_API_KEY='your-api-key-here'
   ```

## Usage

```bash
python fetch_votes.py
```

The script will output progress to stderr and save the results to `congressional_votes_2020_2026.yaml`.

**Note**: Due to API rate limits (0.5s delay between requests) and the volume of votes (~3000-5000 total), this script may take several hours to complete.

## Output Format

```yaml
metadata:
  generated_at: "2024-01-15T10:30:00"
  total_votes: 4523
  date_range:
    start: "2020-01-03"
    end: "2026-01-15"
  source: "Congress.gov API"

votes:
  - vote_id: "118-house-2-123"
    title: "On Passage - H.R. 1234"
    chamber: "House"
    congress: 118
    session: 2
    date: "2024-03-15"
    question: "On Passage"
    vote_type: "YEA-AND-NAY"
    result: "Passed"
    bill_number: "H.R. 1234"
    bill_title: "Example Bill Title"
    sources:
      - url: "https://www.congress.gov/roll-call-vote/..."
        source_type: "text"
        label: "Congress.gov Vote Record"
      - url: "https://www.c-span.org/search/..."
        source_type: "video"
        label: "C-SPAN Search"
    key_members:
      - "Rep. Smith (Sponsor)"
      - "Rep. Jones (R - voted Yea)"
    outcome:
      result: "Passed"
      yea_total: 250
      nay_total: 180
      present: 0
      not_voting: 5
      democrat_yea: 200
      democrat_nay: 10
      republican_yea: 50
      republican_nay: 170
      independent_yea: 0
      independent_nay: 0
    party_flippers:
      - name: "Rep. Johnson"
        party: "Republican"
        vote: "Yea"
        party_majority_vote: "Nay"
```

## Data Sources

- **Primary**: [Congress.gov API](https://api.congress.gov/)
- **Video Links**: [C-SPAN](https://www.c-span.org/) (search links, actual video availability varies)

## Limitations

- Only roll-call votes are tracked (not voice votes or unanimous consent)
- Transcript/hearing links are not directly available via the API - the script provides search links
- API has rate limits; be patient with large fetches
