# Congressional Vote Fetcher - Technical Specification

## Overview

This tool fetches US Congressional voting records (House and Senate) from 2020-2026 and compiles them into a structured YAML file. It uses two data sources since the Congress.gov API currently only provides House votes.

## Data Sources

### House of Representatives
- **Source**: Congress.gov API v3
- **Endpoint**: `https://api.congress.gov/v3/house-vote`
- **Authentication**: API key required (free)
- **Rate Limit**: 0.5s delay between requests (self-imposed)
- **Coverage**: 118th-119th Congress (2023-2026) with legislation-related votes

### Senate
- **Source**: Senate.gov XML files
- **Endpoint**: `https://www.senate.gov/legislative/LIS/roll_call_votes/vote{congress}{session}/vote_{congress}_{session}_{vote_number:05d}.xml`
- **Authentication**: None required
- **Rate Limit**: 0.5s delay between requests (self-imposed)
- **Coverage**: All roll call votes from 116th Congress onwards (2019+)

## Output Schema

```yaml
metadata:
  generated_at: string (ISO 8601 datetime)
  total_votes: integer
  house_votes: integer
  senate_votes: integer
  date_range:
    start: string (YYYY-MM-DD)
    end: string (YYYY-MM-DD)
  sources:
    - string

votes:
  - vote_id: string           # Format: {congress}-{chamber}-{session}-{roll_number}
    title: string             # Vote question or description
    chamber: string           # "House" or "Senate"
    congress: integer         # e.g., 118
    session: integer          # 1 or 2
    roll_call_number: integer # Roll call vote number
    date: string              # YYYY-MM-DD
    question: string          # The specific question being voted on
    vote_type: string         # e.g., "Recorded Vote", "Yea-And-Nay"
    result: string            # e.g., "Passed", "Failed", "Agreed to"
    bill_number: string|null  # e.g., "H.R. 1234", "S. 5"
    bill_title: string|null   # Full title of the bill

    sources:
      - url: string           # Direct URL to source
        source_type: string   # "xml", "text", "video"
        label: string         # Human-readable description

    key_members:
      - string                # Format: "Name (Party - voted X)"

    outcome:
      result: string
      yea_total: integer
      nay_total: integer
      present: integer
      not_voting: integer
      democrat_yea: integer
      democrat_nay: integer
      republican_yea: integer
      republican_nay: integer
      independent_yea: integer
      independent_nay: integer

    party_flippers:
      - name: string          # Member name
        party: string         # "D", "R", or "I"
        vote: string          # "Yea" or "Nay"
        party_majority_vote: string  # What majority of their party voted
```

## Field Definitions

### vote_id
Unique identifier combining congress number, chamber, session, and roll call number.
- Format: `{congress}-{chamber}-{session}-{roll_number}`
- Example: `118-house-1-296`

### party_flippers
Members who voted against their party's majority position on a given vote. A member is considered a "flipper" when:
1. Their party's majority voted one way (>50% Yea or >50% Nay)
2. They voted the opposite way
3. Does not include members who voted "Present" or did not vote

### key_members
Notable members for each vote, currently populated with party flippers. Future versions could include:
- Bill sponsors
- Committee chairs
- Floor managers

### sources
Each vote includes links to:
1. **XML source data** - Raw data from House Clerk or Senate.gov
2. **Congress.gov / Senate.gov page** - Human-readable vote record
3. **Legislation page** (if applicable) - Link to the bill being voted on

## Congress/Session Mapping

| Year | Congress | Session |
|------|----------|---------|
| 2019 | 116th | 1 |
| 2020 | 116th | 2 |
| 2021 | 117th | 1 |
| 2022 | 117th | 2 |
| 2023 | 118th | 1 |
| 2024 | 118th | 2 |
| 2025 | 119th | 1 |
| 2026 | 119th | 2 |

## Limitations

1. **House votes via Congress.gov API** are limited to legislation-related votes from 118th Congress (2023+). Non-legislation votes (e.g., Speaker election) may not be included.

2. **Voice votes** and **unanimous consent** agreements are not tracked - only roll call votes where individual member votes are recorded.

3. **Transcripts/Audio/Video** are not directly available via these APIs. The script provides links to C-SPAN search or official pages where media may be available.

4. **Real-time data**: House data updates within ~30 minutes of votes; Senate XML updates vary.

## API Response Examples

### Congress.gov House Vote List
```json
{
  "houseRollCallVotes": [
    {
      "congress": 118,
      "rollCallNumber": 296,
      "sessionNumber": 1,
      "result": "Passed",
      "startDate": "2023-07-13T14:05:00-04:00",
      "legislationType": "HRES",
      "legislationNumber": "583",
      "sourceDataURL": "https://clerk.house.gov/evs/2023/roll296.xml"
    }
  ]
}
```

### Senate.gov XML Structure
```xml
<roll_call_vote>
  <congress>119</congress>
  <session>1</session>
  <vote_number>1</vote_number>
  <vote_date>January 9, 2025, 02:54 PM</vote_date>
  <vote_question_text>On Cloture on the Motion to Proceed S. 5</vote_question_text>
  <vote_result>Cloture on the Motion to Proceed Agreed to</vote_result>
  <count>
    <yeas>84</yeas>
    <nays>9</nays>
  </count>
  <members>
    <member>
      <member_full>Smith (D-CA)</member_full>
      <party>D</party>
      <state>CA</state>
      <vote_cast>Yea</vote_cast>
    </member>
  </members>
</roll_call_vote>
```

## Error Handling

- **API failures**: Logged to stderr, processing continues with next vote
- **Missing data**: Fields set to `null` or empty arrays
- **Interruption (Ctrl+C)**: Partial results saved to `congressional_votes_partial.yaml`
- **Senate vote gaps**: Up to 10 consecutive 404s allowed before moving to next session

## Performance Characteristics

- **Rate limiting**: 0.5s between requests (2 requests/second max)
- **House votes**: ~3 requests per vote (list + detail + members)
- **Senate votes**: 1 request per vote
- **Estimated runtime**: Several hours for full 2020-2026 dataset
- **Expected vote count**: ~3,000-5,000 total votes
