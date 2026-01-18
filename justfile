# Enable positional arguments for proper quoting
set positional-arguments

# List available recipes
[default]
list:
    @just --list

# ------------------------------------------------------------------------------
# build
# ------------------------------------------------------------------------------

# Build Rust CLI
[group('build')]
build:
    cargo build -p polsearch-cli --manifest-path politics-search/Cargo.toml

# Build CLI release and install to ~/.local/bin
[group('build')]
release-cli:
    cargo build --release -p polsearch-cli --manifest-path politics-search/Cargo.toml
    mkdir -p ~/.local/bin
    cp politics-search/target/release/polsearch ~/.local/bin/polsearch
    @echo "✓ Installed polsearch to ~/.local/bin/polsearch"

# Build API release and install to ~/.local/bin
[group('build')]
release-api:
    cargo build --release -p polsearch-api --manifest-path politics-search/Cargo.toml
    mkdir -p ~/.local/bin
    cp politics-search/target/release/polsearch-api ~/.local/bin/polsearch-api
    @echo "✓ Installed polsearch-api to ~/.local/bin/polsearch-api"

# Build both CLI and API release
[group('build')]
release: release-cli release-api

# Build and push Docker image (tags both git sha and latest)
[group('build')]
docker:
    cd politics-search && nsc build . -t ghcr.io/praveenperera/polsearch-api:$(git cch) --push

# ------------------------------------------------------------------------------
# lint
# ------------------------------------------------------------------------------

# Format code
[group('lint')]
fmt:
    cargo fmt --manifest-path politics-search/Cargo.toml

# Run clippy
[group('lint')]
clippy:
    cargo clippy --all-targets --manifest-path politics-search/Cargo.toml

# ------------------------------------------------------------------------------
# run
# ------------------------------------------------------------------------------

# Run the CLI in release mode
[group('run')]
run *args:
    cargo run --release -p polsearch-cli --manifest-path politics-search/Cargo.toml -- "$@"

# Run the API server
[group('run')]
run-api:
    cargo run --release -p polsearch-api --manifest-path politics-search/Cargo.toml

# ------------------------------------------------------------------------------
# database
# ------------------------------------------------------------------------------

# Run database migrations
[group('db')]
migrate:
    sqlx migrate run --source politics-search/crates/polsearch-db/migrations

# Create FTS index on text embeddings
[group('db')]
index:
    cargo run -p polsearch-cli --manifest-path politics-search/Cargo.toml -- db index

# Backup both Postgres and LanceDB
[group('db')]
backup: backup-pg backup-lancedb

# Backup Postgres database
[group('db')]
backup-pg:
    mkdir -p ~/backups
    pg_dump -Fc polsearch > ~/backups/polsearch_$(date +%Y%m%d_%H%M).dump

# Backup LanceDB
[group('db')]
backup-lancedb:
    mkdir -p ~/backups
    tar -czf ~/backups/lancedb_$(date +%Y%m%d_%H%M).tar.gz -C ~/.polsearch lancedb

# ------------------------------------------------------------------------------
# ingest
# ------------------------------------------------------------------------------

# Ingest hearing transcripts (skips already processed)
[group('ingest')]
ingest-hearings *args:
    cargo run --release -p polsearch-cli --manifest-path politics-search/Cargo.toml -- ingest-hearings --path data/transcripts "$@"

# Benchmark: ingest 50 files to estimate total time
[group('ingest')]
ingest-benchmark:
    time cargo run --release -p polsearch-cli --manifest-path politics-search/Cargo.toml -- ingest-hearings --path data/transcripts --limit 50

# ------------------------------------------------------------------------------
# utils
# ------------------------------------------------------------------------------

# Run xtask commands
[group('utils')]
xtask *args:
    cargo xtask --manifest-path politics-search/Cargo.toml "$@"

# Bump version (major, minor, or patch)
[group('utils')]
bump type:
    just xtask bump-version {{type}}

# Clean all build artifacts
[group('utils')]
clean:
    cargo clean --manifest-path politics-search/Cargo.toml
