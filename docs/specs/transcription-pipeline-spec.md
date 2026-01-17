# Audio/Video Transcription Pipeline Spec

## Table of Contents

1. [Overview](#overview)
2. [System Components](#system-components)
3. [NATS JetStream Streams](#nats-jetstream-streams)
4. [Existing Infrastructure](#existing-infrastructure)
5. [Pipeline Stages](#pipeline-stages)
6. [Crate Structure](#crate-structure)
7. [GPU Workers (Python)](#gpu-workers-python)
8. [Kubernetes Structure (Helm)](#kubernetes-structure-helm)
9. [CLI Commands](#cli-commands)
10. [Decisions](#decisions)
11. [Environment Variables](#environment-variables)
12. [Error Handling](#error-handling)
13. [Observability](#observability)
14. [Database Schema Updates](#database-schema-updates)
15. [Security](#security)
16. [Dependencies](#dependencies)
17. [Data Flow Diagram](#data-flow-diagram)
18. [Local Development](#local-development)
19. [NATS Message Schemas](#nats-message-schemas)
20. [Implementation Order](#implementation-order)
21. [Files to Create/Modify](#files-to-createmodify)

---

## Overview

Build a distributed, multi-stage pipeline for transcribing audio/video content and ingesting into the existing LanceDB-based congressional hearing search system.

**Architecture:**
- **All workloads run in DigitalOcean Kubernetes**
- **NATS JetStream** for job queue coordination between stages
- **Postgres** for batch/task metadata and final state
- **DigitalOcean Spaces** for audio file transfer between stages

## System Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DigitalOcean Kubernetes                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐              │
│  │   NATS       │    │   Postgres   │    │   Spaces     │              │
│  │  JetStream   │    │  (metadata)  │    │  (audio)     │              │
│  └──────┬───────┘    └──────────────┘    └──────────────┘              │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        Job Streams                               │   │
│  │  download.pending → vad.pending → diarize.pending →             │   │
│  │  transcribe.pending → align.pending → ingest.pending            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│         │                                                               │
│         ▼                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │
│  │  Download   │  │    VAD      │  │  Diarize    │  │ Transcribe  │   │
│  │   Worker    │  │   Worker    │  │   Worker    │  │   Worker    │   │
│  │   (CPU)     │  │   (CPU)     │  │   (GPU)     │  │   (GPU)     │   │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘   │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐                                      │
│  │   Align     │  │   Ingest    │                                      │
│  │   Worker    │  │   Worker    │                                      │
│  │   (CPU)     │  │   (CPU)     │                                      │
│  └─────────────┘  └─────────────┘                                      │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## NATS JetStream Streams

| Stream | Consumer | Purpose |
|--------|----------|---------|
| `jobs.download` | download-worker | Download audio from URL/YouTube |
| `jobs.vad` | vad-worker | VAD chunking (earshot) |
| `jobs.diarize` | diarize-worker | Speaker diarization (Sortformer) |
| `jobs.transcribe` | transcribe-worker | ASR (Parakeet v2) |
| `jobs.align` | align-worker | Speaker-ASR alignment |
| `jobs.ingest` | ingest-worker | LanceDB + Postgres ingestion |

**Message flow:**
1. API/CLI publishes to `jobs.download`
2. Each worker consumes, processes, publishes to next stream
3. Final worker updates Postgres batch status

## Existing Infrastructure

| Component | Purpose |
|-----------|---------|
| `polsearch-pipeline` | Download stage, embed stage (FastEmbed) |
| `polsearch-archive` | SQLite archive for raw transcript/diarization data |
| `polsearch-core` | Models: Segment, Content, Speaker, TranscriptionBatch/Task |
| `polsearch-db` | Postgres repos for orchestration state |
| LanceDB | Vector store with schema: `content_id`, `segment_index`, `text`, `start_time_ms`, `end_time_ms`, embeddings |

## Pipeline Stages

### Stage 1: Download (Local - Rust/Python)
**Location**: `polsearch-pipeline/src/stages/download.rs` + `yt-dlp` subprocess

**For YouTube:**
- Use `yt-dlp` to extract audio: `yt-dlp -x --audio-format wav -o output.wav <url>`
- Extract metadata (title, channel, upload date)

**For direct URLs:**
- Use existing download.rs with retry logic
- Support: `.mp3`, `.m4a`, `.wav`, `.mp4`, `.webm`, `.mkv`

**Then:**
- Upload to DigitalOcean Spaces
- Create `TranscriptionTask` record in Postgres with status `queued`
- Store Spaces URL in task metadata

### Stage 2: VAD Chunking (Local or GPU Server - Rust)
**Location**: `polsearch-pipeline/src/stages/vad.rs` - reuse pattern from `/Users/praveen/code/whisper`

Uses `earshot` crate (Rust VAD library):

```rust
use earshot::{VoiceActivityDetector, VoiceActivityProfile};

pub struct VadChunker {
    min_chunk_sec: u32,  // 25s default
    max_chunk_sec: u32,  // 60s default
}

impl VadChunker {
    pub fn compute_chunks(&self, audio: &DecodedAudio) -> Result<Vec<(u64, u64)>>
}
```

**Pipeline:**
1. Decode audio with `symphonia` (existing dependency)
2. Resample to 16kHz mono (required by earshot)
3. Process in 30ms frames (480 samples)
4. Track silence periods ≥100ms as split points
5. Find optimal splits within min/max window (prefer longer silences, closer to middle)
6. Export chunks as WAV files with `hound`

**Config constants:**
- `VAD_TARGET_SAMPLE_RATE: 16000`
- `VAD_FRAME_SIZE: 480` (30ms at 16kHz)
- `VAD_MIN_SILENCE_MS: 100`
- `VoiceActivityProfile::VERY_AGGRESSIVE`

Output: `vad_segments.json` with `[{start_ms, end_ms, chunk_path}]`

### Stage 3: Diarization (GPU Server)
**Location**: New Python service using NeMo

**Run BEFORE ASR (diarize-first approach)**

Using NeMo Sortformer:
```python
from nemo.collections.asr.models import SortformerEncLabelModel

# Load pretrained model
model = SortformerEncLabelModel.from_pretrained("nvidia/sortformer_diar_4spk_v1")

# Run diarization on VAD segments
diar_output = model.diarize(audio_paths, num_speakers=None)  # auto-detect
```

**Pipeline:**
1. **Speaker embeddings** (GPU) - TitaNet or ECAPA-TDNN via Sortformer
2. **Neural clustering** (GPU) - Sortformer handles clustering end-to-end
3. Output: `diarization.json` with speaker turns on global timeline

```json
{
  "speakers": ["SPEAKER_0", "SPEAKER_1"],
  "turns": [
    {"speaker": "SPEAKER_0", "start_ms": 0, "end_ms": 15000},
    {"speaker": "SPEAKER_1", "start_ms": 15200, "end_ms": 28000}
  ]
}
```

**Settings for 2-4 speakers:**
- Window size: 1.5s with 0.75s shift
- Batch size: 8-16 depending on GPU VRAM

### Stage 4: Transcribe (GPU Server)
**Location**: New Python service using NeMo

Using Parakeet v2 (CTC-based, fast):
```python
from nemo.collections.asr.models import ASRModel

# Load Parakeet v2 (1.1B params, best accuracy)
model = ASRModel.from_pretrained("nvidia/parakeet-tdt-1.1b")

# Batch transcribe VAD segments
transcripts = model.transcribe(
    audio_paths,
    batch_size=16,
    return_hypotheses=True  # includes word timestamps + confidence
)
```

**Batching strategy:**
- Group VAD segments by similar duration for efficient GPU utilization
- Batch size: 16-32 for 10-30s segments on 24GB VRAM

Output: `transcription.json` with word-level timestamps

```json
{
  "segments": [
    {
      "segment_index": 0,
      "start_ms": 0,
      "end_ms": 15000,
      "text": "The committee will come to order...",
      "words": [
        {"word": "The", "start_ms": 0, "end_ms": 150, "confidence": 0.98},
        ...
      ]
    }
  ]
}
```

### Stage 5: Combine & Align (GPU Server - CPU)
**Location**: Python or Rust

- Align speakers to ASR words by max time overlap
- Merge speaker labels with transcription segments
- Output: `combined.json`

```json
{
  "segments": [
    {
      "segment_index": 0,
      "start_ms": 0,
      "end_ms": 15000,
      "speaker": "SPEAKER_0",
      "text": "The committee will come to order...",
      "words": [...]
    }
  ]
}
```

### Stage 6: Ingest to LanceDB (Local - Rust)
**Location**: `polsearch-pipeline/src/stages/ingest.rs` (new)

1. Download `combined.json` from storage
2. Create/update `Segment` records in Postgres
3. Generate embeddings with FastEmbed
4. Insert into LanceDB with schema:
   ```
   content_id: String (UUID)
   segment_index: i32
   text: String
   start_time_ms: i32
   end_time_ms: i32
   speaker_name: Option<String>
   vector: FixedSizeList<Float32>
   ```
5. Store raw word-level data in archive SQLite
6. Update `TranscriptionTask` status to `completed`

## Crate Structure

```
politics-search/
├── Cargo.toml                    # workspace
├── crates/
│   ├── polsearch-core/src/
│   │   ├── lib.rs
│   │   ├── models.rs             # existing
│   │   ├── jobs.rs               # NEW: job message types
│   │   └── nats.rs               # NEW: NATS client wrapper
│   │
│   ├── polsearch-pipeline/src/
│   │   ├── lib.rs
│   │   ├── stages.rs             # module file
│   │   └── stages/
│   │       ├── download.rs       # existing
│   │       ├── embed.rs          # existing
│   │       ├── upload.rs         # NEW: Spaces upload
│   │       ├── youtube.rs        # NEW: yt-dlp wrapper
│   │       ├── vad.rs            # NEW: VAD chunking (earshot)
│   │       └── ingest.rs         # NEW: LanceDB writer
│   │
│   ├── download-worker/          # NEW: binary crate
│   │   ├── Cargo.toml
│   │   └── src/main.rs
│   │
│   ├── vad-worker/               # NEW: binary crate
│   │   ├── Cargo.toml
│   │   └── src/main.rs
│   │
│   ├── align-worker/             # NEW: binary crate
│   │   ├── Cargo.toml
│   │   └── src/main.rs
│   │
│   └── ingest-worker/            # NEW: binary crate
│       ├── Cargo.toml
│       └── src/main.rs
│
├── Dockerfile                    # multi-stage for all Rust workers
└── docker-compose.yaml           # local dev
```

## GPU Workers (Python)

```
gpu-transcription/
├── pyproject.toml
├── src/
│   ├── diarize_worker.py         # Sortformer + NATS consumer
│   ├── transcribe_worker.py      # Parakeet v2 + NATS consumer
│   └── models.py                 # Pydantic schemas
├── Dockerfile.diarize
└── Dockerfile.transcribe
```

## Kubernetes Structure (Helm)

```
helm/
├── Chart.yaml
├── values.yaml                   # default values
├── values-prod.yaml              # production overrides
├── templates/
│   ├── _helpers.tpl
│   ├── configmap.yaml
│   ├── secret.yaml
│   ├── nats-statefulset.yaml     # NATS JetStream
│   ├── download-worker.yaml      # CPU Deployment
│   ├── vad-worker.yaml           # CPU Deployment
│   ├── align-worker.yaml         # CPU Deployment
│   ├── ingest-worker.yaml        # CPU Deployment
│   ├── diarize-worker.yaml       # GPU Deployment + tolerations
│   ├── transcribe-worker.yaml    # GPU Deployment + tolerations
│   └── hpa.yaml                  # HorizontalPodAutoscaler
└── charts/
    └── nats/                     # NATS subchart (optional)
```

**Helm values.yaml structure:**
```yaml
global:
  imageRegistry: registry.digitalocean.com/polsearch

nats:
  enabled: true
  jetstream:
    enabled: true
    storage: 10Gi

spaces:
  endpoint: nyc3.digitaloceanspaces.com
  bucket: polsearch-audio

postgres:
  host: your-db.us-east-1.psdb.cloud  # PlanetScale Postgres
  database: polsearch

workers:
  download:
    replicas: 2
    resources:
      requests: { cpu: 100m, memory: 256Mi }
  vad:
    replicas: 2
    resources:
      requests: { cpu: 500m, memory: 1Gi }
  align:
    replicas: 1
    resources:
      requests: { cpu: 100m, memory: 256Mi }
  ingest:
    replicas: 1
    resources:
      requests: { cpu: 200m, memory: 512Mi }
  diarize:
    replicas: 1
    nodeSelector:
      doks.digitalocean.com/gpu: "true"
    tolerations:
      - key: nvidia.com/gpu
        operator: Exists
    resources:
      limits: { nvidia.com/gpu: 1 }
  transcribe:
    replicas: 1
    nodeSelector:
      doks.digitalocean.com/gpu: "true"
    tolerations:
      - key: nvidia.com/gpu
        operator: Exists
    resources:
      limits: { nvidia.com/gpu: 1 }
```

## CLI Commands

```bash
# Create transcription batch
polsearch transcribe-plan --source youtube --from 2024-01 --to 2024-12

# Submit to GPU queue
polsearch transcribe-submit --batch <batch_id>

# Check status
polsearch status --batch <batch_id>

# Manually ingest completed job
polsearch ingest --task <task_id>
```

## Decisions

| Decision | Choice |
|----------|--------|
| Diarization model | NeMo Sortformer (NVIDIA, integrates well with Parakeet) |
| Object storage | DigitalOcean Spaces (S3-compatible) |
| Expected speakers | 2-4 typical (may vary) |
| Video sources | YouTube (yt-dlp) + direct audio/video URLs |
| Job queue | NATS JetStream (multi-stage coordination) |
| Batch metadata | PlanetScale Postgres (TranscriptionBatch/Task tables) |
| Deployment | DigitalOcean Kubernetes (CPU + GPU node pools) |
| VAD | Rust with earshot crate (runs on CPU workers) |
| K8s packaging | Helm charts |

---

## Environment Variables

### All Workers
| Variable | Description | Example |
|----------|-------------|---------|
| `NATS_URL` | NATS server URL | `nats://nats:4222` |
| `DATABASE_URL` | PlanetScale Postgres connection | `postgres://user:pass@host/db?sslmode=require` |
| `SPACES_ENDPOINT` | DO Spaces endpoint | `nyc3.digitaloceanspaces.com` |
| `SPACES_BUCKET` | Bucket name | `polsearch-audio` |
| `SPACES_ACCESS_KEY` | Access key ID | - |
| `SPACES_SECRET_KEY` | Secret access key | - |
| `RUST_LOG` | Log level | `info,polsearch=debug` |

### Ingest Worker
| Variable | Description | Example |
|----------|-------------|---------|
| `LANCEDB_PATH` | LanceDB storage path | `s3://bucket/lancedb` or `/data/lancedb` |
| `ARCHIVE_PATH` | Archive SQLite base path | `/data/archive` |

### GPU Workers
| Variable | Description | Example |
|----------|-------------|---------|
| `CUDA_VISIBLE_DEVICES` | GPU device(s) | `0` |
| `MODEL_CACHE_DIR` | NeMo model cache | `/models` |

---

## Error Handling

### Retry Strategy
- **NATS redelivery**: Messages not ACK'd within 30s are redelivered
- **Max redeliveries**: 3 attempts before moving to dead-letter queue
- **Backoff**: Exponential backoff with jitter (1s, 2s, 4s)

### Dead Letter Queue
- Failed jobs published to `jobs.failed` stream
- Includes: job_id, stage, error message, attempt count
- Manual retry via CLI: `polsearch retry --job <job_id>`

### Stage-specific errors

| Stage | Error | Action |
|-------|-------|--------|
| Download | 404 | Mark task failed, no retry |
| Download | 5xx/timeout | Retry with backoff |
| VAD | Audio decode failure | Mark failed, log error |
| Diarize | OOM | Retry with smaller batch |
| Transcribe | OOM | Retry with smaller batch |
| Ingest | LanceDB write failure | Retry, alert if persistent |

### Graceful Shutdown
- Workers handle SIGTERM, finish current job before exit
- In-flight jobs are redelivered on pod termination
- Kubernetes `terminationGracePeriodSeconds: 300` for GPU workers

---

## Observability

### Logging
- Structured JSON logs via `tracing` (Rust) / `structlog` (Python)
- Log levels: ERROR, WARN, INFO, DEBUG
- Key fields: `job_id`, `batch_id`, `stage`, `duration_ms`

### Metrics (Prometheus)
| Metric | Type | Labels |
|--------|------|--------|
| `jobs_processed_total` | Counter | stage, status |
| `job_duration_seconds` | Histogram | stage |
| `queue_depth` | Gauge | stream |
| `gpu_utilization` | Gauge | worker |

### Tracing (optional)
- OpenTelemetry spans for job lifecycle
- Trace ID propagated through NATS message headers

### Alerting
- Queue depth > 100 for > 5 min
- Job failure rate > 10% over 15 min
- GPU worker pod restarts > 3 in 1 hour

---

## Database Schema Updates

### New table: `transcription_jobs`
```sql
CREATE TABLE transcription_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID REFERENCES transcription_batches(id),
    content_id UUID REFERENCES content(id),
    source_url TEXT NOT NULL,
    current_stage TEXT NOT NULL DEFAULT 'pending',
    spaces_path TEXT,
    error_message TEXT,
    attempts INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_jobs_batch ON transcription_jobs(batch_id);
CREATE INDEX idx_jobs_stage ON transcription_jobs(current_stage);
```

### Stage values
- `pending`, `downloading`, `vad`, `diarizing`, `transcribing`, `aligning`, `ingesting`, `completed`, `failed`

---

## Security

### Secrets Management
- Kubernetes Secrets for credentials (Spaces, Postgres)
- Optional: DigitalOcean Secrets Manager or external-secrets-operator
- Never log credentials or include in NATS messages

### Network Policies
- Workers only connect to: NATS, Postgres, Spaces
- GPU workers isolated in dedicated node pool
- No public ingress to workers

### Image Security
- Pin base images to specific digests
- Scan images with Trivy in CI
- Use distroless/minimal base images for Rust workers

---

## Dependencies

### Rust Crates
| Crate | Version | Purpose |
|-------|---------|---------|
| `async-nats` | 0.38 | NATS JetStream client |
| `aws-sdk-s3` | 1.x | S3/Spaces client |
| `earshot` | 0.1 | Voice Activity Detection |
| `hound` | 4.0 | WAV file I/O |
| `symphonia` | 0.5 | Audio decoding |
| `lancedb` | 0.23 | Vector database |
| `fastembed` | 5.0 | Text embeddings |
| `sqlx` | 0.8 | Postgres client |
| `tokio` | 1.x | Async runtime |
| `tracing` | 0.1 | Structured logging |

### Python Packages
| Package | Version | Purpose |
|---------|---------|---------|
| `nemo_toolkit[asr]` | 2.x | Parakeet, Sortformer |
| `nats-py` | 2.x | NATS client |
| `boto3` | 1.x | S3/Spaces client |
| `pydantic` | 2.x | Data validation |
| `structlog` | 24.x | Structured logging |
| `prometheus-client` | 0.x | Metrics |

---

## Data Flow Diagram

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                 User/CLI                                      │
│                                    │                                          │
│                           Submit batch job                                    │
│                                    ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                            jobs.download                                 │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                          │
│                                    ▼                                          │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────────┐   │
│  │ download-worker │ ───▶ │      Spaces     │ ───▶ │    raw.wav (16kHz)  │   │
│  └─────────────────┘      └─────────────────┘      └─────────────────────┘   │
│                                    │                                          │
│                           publish to jobs.vad                                 │
│                                    ▼                                          │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────────┐   │
│  │   vad-worker    │ ───▶ │      Spaces     │ ───▶ │ chunk_XXX.wav files │   │
│  └─────────────────┘      └─────────────────┘      └─────────────────────┘   │
│                                    │                                          │
│                         publish to jobs.diarize                               │
│                                    ▼                                          │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────────┐   │
│  │ diarize-worker  │ ───▶ │      Spaces     │ ───▶ │   diarization.json  │   │
│  │      (GPU)      │      └─────────────────┘      └─────────────────────┘   │
│  └─────────────────┘               │                                          │
│                        publish to jobs.transcribe                             │
│                                    ▼                                          │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────────┐   │
│  │transcribe-worker│ ───▶ │      Spaces     │ ───▶ │  transcription.json │   │
│  │      (GPU)      │      └─────────────────┘      └─────────────────────┘   │
│  └─────────────────┘               │                                          │
│                          publish to jobs.align                                │
│                                    ▼                                          │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────────┐   │
│  │  align-worker   │ ───▶ │      Spaces     │ ───▶ │    combined.json    │   │
│  └─────────────────┘      └─────────────────┘      └─────────────────────┘   │
│                                    │                                          │
│                         publish to jobs.ingest                                │
│                                    ▼                                          │
│  ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────────┐   │
│  │  ingest-worker  │ ───▶ │    LanceDB +    │ ───▶ │  Searchable content │   │
│  │                 │      │    Postgres     │      │                     │   │
│  └─────────────────┘      └─────────────────┘      └─────────────────────┘   │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Local Development

### Prerequisites
- Docker & Docker Compose
- Rust 1.85+
- Python 3.11+
- yt-dlp installed

### Infrastructure (already deployed)
- **NATS JetStream**: Already deployed in K8s
- **Postgres**: PlanetScale Postgres
- **Object Storage**: DigitalOcean Spaces

### Running locally
```bash
# Set environment variables (or use .env file)
export NATS_URL=nats://your-nats-server:4222
export DATABASE_URL=postgres://user:pass@your-planetscale-host/db?sslmode=require
export SPACES_ENDPOINT=nyc3.digitaloceanspaces.com
export SPACES_BUCKET=polsearch-audio
export SPACES_ACCESS_KEY=your-key
export SPACES_SECRET_KEY=your-secret

# Run Rust workers (in separate terminals)
cargo run -p download-worker
cargo run -p vad-worker
cargo run -p align-worker
cargo run -p ingest-worker

# Run Python workers (requires GPU or CPU fallback)
cd gpu-transcription
python -m src.diarize_worker
python -m src.transcribe_worker

# Submit a test job
polsearch submit --url "https://youtube.com/watch?v=..." --batch test-batch
```

## NATS Message Schemas

### Job Message (all streams)
```json
{
  "job_id": "uuid",
  "batch_id": "uuid",
  "content_id": "uuid",
  "source_url": "https://...",
  "spaces_path": "audio/job_id/",
  "metadata": {},
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Stage-specific payloads

**jobs.download → jobs.vad:**
```json
{
  "audio_path": "s3://bucket/audio/job_id/raw.wav",
  "duration_ms": 3600000,
  "sample_rate": 44100
}
```

**jobs.vad → jobs.diarize:**
```json
{
  "chunks": [
    {"index": 0, "path": "s3://bucket/audio/job_id/chunk_000.wav", "start_ms": 0, "end_ms": 30000},
    {"index": 1, "path": "s3://bucket/audio/job_id/chunk_001.wav", "start_ms": 30000, "end_ms": 58000}
  ]
}
```

**jobs.diarize → jobs.transcribe:**
```json
{
  "chunks": [...],
  "diarization": {
    "speakers": ["SPEAKER_0", "SPEAKER_1"],
    "turns": [{"speaker": "SPEAKER_0", "start_ms": 0, "end_ms": 15000}, ...]
  }
}
```

**jobs.transcribe → jobs.align:**
```json
{
  "diarization": {...},
  "transcription": {
    "segments": [
      {"index": 0, "start_ms": 0, "end_ms": 15000, "text": "...", "words": [...]}
    ]
  }
}
```

**jobs.align → jobs.ingest:**
```json
{
  "segments": [
    {"index": 0, "start_ms": 0, "end_ms": 15000, "speaker": "SPEAKER_0", "text": "...", "words": [...]}
  ]
}
```

## Implementation Order

### Phase 1: Core Libraries (Rust)
1. Add NATS client to workspace (`async-nats`)
2. Add S3/Spaces client (`aws-sdk-s3`)
3. Create shared job message types in `polsearch-core`
4. Port VAD from whisper project (`earshot` + `hound`)

### Phase 2: CPU Workers (Rust)
1. **download-worker**: yt-dlp + direct URL download → upload to Spaces → publish to `jobs.vad`
2. **vad-worker**: consume from `jobs.vad` → chunk audio → upload chunks → publish to `jobs.diarize`
3. **align-worker**: consume from `jobs.align` → merge speaker + transcript → publish to `jobs.ingest`
4. **ingest-worker**: consume from `jobs.ingest` → write to LanceDB + Postgres + archive

### Phase 3: GPU Workers (Python)
1. Set up Python project with NeMo, async-nats
2. **diarize-worker**: consume from `jobs.diarize` → Sortformer → publish to `jobs.transcribe`
3. **transcribe-worker**: consume from `jobs.transcribe` → Parakeet v2 → publish to `jobs.align`

### Phase 4: Kubernetes Deployment
1. NATS JetStream Helm chart (or DO managed NATS if available)
2. CPU worker Deployments (download, vad, align, ingest)
3. GPU worker Deployments with node selectors
4. ConfigMaps/Secrets for env vars
5. HPA for scaling workers based on queue depth

### Phase 5: CLI & API
1. CLI command to submit batch jobs
2. CLI command to check job/batch status
3. Optional: REST API for external integrations

### Phase 6: Testing & Verification
1. Local docker-compose with NATS + workers
2. Submit test job, verify full pipeline
3. Verify segments in LanceDB with speaker labels
4. Run search query, confirm filtering works
5. Check archive SQLite for raw word data

## Files to Create/Modify

**Rust - Core (politics-search/crates/):**
- `polsearch-core/src/jobs.rs` - NEW (job message types)
- `polsearch-core/src/nats.rs` - NEW (NATS client wrapper)
- `polsearch-pipeline/src/stages/upload.rs` - NEW (Spaces upload)
- `polsearch-pipeline/src/stages/youtube.rs` - NEW (yt-dlp wrapper)
- `polsearch-pipeline/src/stages/vad.rs` - NEW (port from whisper)
- `polsearch-pipeline/src/stages/ingest.rs` - NEW (LanceDB writer)
- `polsearch-pipeline/src/stages.rs` - MODIFY (add exports)
- `polsearch-pipeline/Cargo.toml` - MODIFY (add async-nats, aws-sdk-s3, earshot, hound)

**Rust - Workers (politics-search/crates/):**
- `download-worker/` - NEW crate (binary)
- `vad-worker/` - NEW crate (binary)
- `align-worker/` - NEW crate (binary)
- `ingest-worker/` - NEW crate (binary)

**Rust - CLI:**
- `polsearch-cli/src/commands/submit.rs` - NEW (submit batch)
- `polsearch-cli/src/commands/job_status.rs` - NEW (check status)

**Python (gpu-transcription/):**
- `pyproject.toml` - NEW
- `src/diarize_worker.py` - NEW (Sortformer + NATS consumer)
- `src/transcribe_worker.py` - NEW (Parakeet + NATS consumer)
- `src/models.py` - NEW (Pydantic schemas)
- `Dockerfile.diarize` - NEW
- `Dockerfile.transcribe` - NEW

**Helm Chart (helm/):**
- `Chart.yaml` - chart metadata
- `values.yaml` - default values
- `values-prod.yaml` - production overrides
- `templates/_helpers.tpl` - template helpers
- `templates/configmap.yaml` - shared env vars
- `templates/secret.yaml` - credentials
- `templates/nats-statefulset.yaml` - NATS JetStream
- `templates/download-worker.yaml` - CPU Deployment
- `templates/vad-worker.yaml` - CPU Deployment
- `templates/align-worker.yaml` - CPU Deployment
- `templates/ingest-worker.yaml` - CPU Deployment
- `templates/diarize-worker.yaml` - GPU Deployment
- `templates/transcribe-worker.yaml` - GPU Deployment
- `templates/hpa.yaml` - HorizontalPodAutoscaler

**Docker:**
- `politics-search/Dockerfile` - multi-stage build for Rust workers
- `docker-compose.yaml` - local dev with NATS + workers

**Database Migrations:**
- `migrations/XXXXXX_add_transcription_jobs.sql` - NEW table
