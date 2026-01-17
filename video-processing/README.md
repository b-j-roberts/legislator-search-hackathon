# Video Processing Pipeline

Extract media appearances and transcripts for US legislators from Internet Archive TV News and YouTube.

## Data Sources

| Source | Content | Transcripts |
|--------|---------|-------------|
| **Internet Archive TV News** | CNN, Fox, MSNBC, C-SPAN, PBS, etc. | Closed captions indexed |
| **YouTube** | Official news channels, hearing recordings | Auto-captions via yt-dlp |

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run for a single legislator (test)
cd scripts
python pipeline.py --names "Bernie Sanders" --max-ia 10 --max-youtube 10

# Run for all senators
python pipeline.py --chamber senate

# Run for all legislators (takes a while)
python pipeline.py --all
```

## Scripts

### `fetch_legislators.py`
Fetches current legislators from [congress-legislators](https://github.com/unitedstates/congress-legislators).

```bash
python scripts/fetch_legislators.py -o data/legislators.json
```

### `search_internet_archive.py`
Searches the Internet Archive TV News Archive.

```bash
python scripts/search_internet_archive.py --name "Bernie Sanders" --start-date 2024-01-01
```

### `search_youtube.py`
Searches YouTube for legislator appearances.

```bash
# Without API key (uses yt-dlp)
python scripts/search_youtube.py --name "Bernie Sanders"

# With API key (more reliable)
python scripts/search_youtube.py --name "Bernie Sanders" --api-key YOUR_KEY
```

### `extract_transcripts.py`
Extracts transcripts from found videos.

```bash
# Internet Archive clip
python scripts/extract_transcripts.py --source ia --id CSPAN_20240403_...

# YouTube video
python scripts/extract_transcripts.py --source youtube --id VIDEO_ID

# Local file with Whisper
python scripts/extract_transcripts.py --source whisper --file audio.mp3
```

### `pipeline.py`
Main orchestration script.

```bash
# Full options
python scripts/pipeline.py \
    --names "Bernie Sanders" "Mitch McConnell" \
    --start-date 2020-01-01 \
    --end-date 2026-12-31 \
    --max-ia 100 \
    --max-youtube 50 \
    --extract-transcripts \
    -o data/output
```

## Output Structure

```
data/
├── legislators.json           # Cached legislator list
└── pipeline_output/
    ├── internet_archive/
    │   ├── S000033_ia.json    # Per-legislator IA results
    │   └── all_results.json   # Combined results
    ├── youtube/
    │   ├── S000033_youtube.json
    │   └── all_results.json
    ├── transcripts/
    │   ├── internet_archive/
    │   │   └── CSPAN_20240403_....json
    │   └── youtube/
    │       └── VIDEO_ID.json
    └── pipeline_summary.json
```

## Output Format

### Appearance (Internet Archive)
```json
{
  "identifier": "MSNBC_20240403_230000_The_Beat_With_Ari",
  "title": "The Beat With Ari Melber",
  "date": "2024-04-03",
  "network": "MSNBC",
  "archive_url": "https://archive.org/details/...",
  "embed_url": "https://archive.org/embed/..."
}
```

### Video (YouTube)
```json
{
  "video_id": "abc123xyz",
  "title": "Sen. Sanders on State of the Union",
  "url": "https://youtube.com/watch?v=abc123xyz",
  "channel": "CNN",
  "upload_date": "20240811"
}
```

### Transcript
```json
{
  "format": "vtt",
  "text": "Full transcript text...",
  "segments": [
    {"start": "00:00:01", "end": "00:00:05", "text": "Segment text..."}
  ],
  "source_url": "https://..."
}
```

## API Keys (Optional)

### YouTube Data API
For more reliable YouTube searches, get an API key from [Google Cloud Console](https://console.cloud.google.com/):
1. Create a project
2. Enable YouTube Data API v3
3. Create credentials (API key)
4. Set `YOUTUBE_API_KEY` environment variable or use `--youtube-api-key`

Without an API key, the script uses yt-dlp search which works but is slower.

## Whisper Transcription

For videos without available captions, install Whisper:

```bash
pip install openai-whisper
```

Then use `--extract-transcripts` with the pipeline or run directly:

```bash
python scripts/extract_transcripts.py --source whisper --file audio.mp3 --whisper-model base
```

Models: `tiny`, `base`, `small`, `medium`, `large` (larger = more accurate but slower)

## Rate Limiting

The scripts include built-in rate limiting:
- Internet Archive: ~30 requests/minute
- YouTube: ~20 requests/minute

For large batches, expect processing times:
- 100 legislators × IA search: ~1 hour
- 100 legislators × YouTube search: ~2 hours
- Transcript extraction: varies by volume

## Integration

The output JSON files can be integrated with your existing congressional data:

```python
import json

# Load pipeline results
with open("data/pipeline_output/internet_archive/all_results.json") as f:
    ia_results = json.load(f)

# Link to your existing legislator data by bioguide_id
for result in ia_results:
    bioguide_id = result["bioguide_id"]
    appearances = result.get("appearances", [])
    # Merge with your data...
```
