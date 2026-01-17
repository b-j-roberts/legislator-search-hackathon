# PolSearch

A unified search system for political content across audio, video, and documents.

## Development Setup

```bash
# Install dependencies
brew install postgresql

# Create database
createdb polsearch

# Run migrations
just migrate

# Build Swift library (required for transcription)
just swift

# Build CLI
just build
```

## Usage

```bash
# Run the CLI
./target/debug/polsearch --help

# Or via just
just run --help
```

## Project Structure

```
polsearch/
├── crates/
│   ├── polsearch-cli        # CLI application
│   ├── polsearch-core       # Domain models
│   ├── polsearch-db         # PostgreSQL repositories
│   ├── polsearch-pipeline   # Content processing pipeline
│   ├── polsearch-fluidaudio # Swift FFI for transcription
│   ├── polsearch-archive    # Raw data archival
│   └── polsearch-util       # Generic utilities
├── config/                  # Configuration files
├── swift/                   # Swift FluidAudio bridge
└── justfile                 # Task runner
```
