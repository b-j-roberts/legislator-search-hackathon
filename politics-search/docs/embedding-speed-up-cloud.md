# DigitalOcean Deployment for Embedding Generation

Run the politics-search CLI on a DigitalOcean Droplet to generate embeddings faster. The embeddings use **fastembed** (local, CPU-based) with BGE-small-en-v1.5 model - no external API keys needed.

## Prerequisites

- DigitalOcean account
- Existing cloud PostgreSQL database
- SSH key configured for Droplet access

## Step 1: Create Droplet

Create via web console or doctl:

- **Size**: 60 vCPUs, 120 GB RAM, 750 GB NVMe (~$2.44/hr)
- **OS**: Ubuntu 24.04 LTS
- **Region**: Same as your Postgres for low latency
- **Firewall**: Allow SSH (22) from your IP

**Important**: Destroy when done to stop billing!

## Step 2: Transfer Data to Droplet

### Using polsearch util commands

```bash
# Archive data + fastembed cache (on Mac)
polsearch util archive --paths data/ ~/.fastembed_cache/ -o polsearch-data.tar.gz

# Push to Droplet
polsearch util push polsearch-data.tar.gz -r root@<droplet-ip>:~/

# On Droplet - extract
polsearch util unarchive polsearch-data.tar.gz -d ~/
```

### Or using rsync directly

```bash
rsync -avz --progress data/ root@<droplet-ip>:~/data/
rsync -avz ~/.fastembed_cache/ root@<droplet-ip>:~/.fastembed_cache/
```

## Step 3: Setup VM Environment

SSH into the Droplet:

```bash
ssh root@<droplet-ip>
```

Install dependencies:

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source ~/.cargo/env

# Install build deps (Ubuntu)
sudo apt update && sudo apt install -y build-essential libssl-dev pkg-config

# Clone project
git clone <repo> politics-search
cd politics-search

# Build release binary
cargo build --release -p polsearch-cli
```

## Step 4: Configure Database Connection

Create `.env` in project root:

```bash
DATABASE_URL=postgres://user:password@<your-cloud-postgres>:5432/polsearch
RUST_LOG=info,polsearch_pipeline=debug
```

If this is a fresh database, run migrations:

```bash
# Export local schema (on Mac)
pg_dump -s polsearch > schema.sql
scp schema.sql root@<droplet-ip>:~/

# Import on cloud Postgres (on Droplet)
psql $DATABASE_URL < schema.sql
```

## Step 5: Run Embedding Pipeline

Use screen/tmux for long-running processes:

```bash
screen -S ingestion

export DATABASE_URL="postgres://user:pass@your-cloud-postgres:5432/polsearch"
mkdir -p ~/lancedb

# 1. Ingest hearings (includes embeddings)
./target/release/polsearch hearings ingest \
  --path ~/data/transcripts \
  --lancedb-path ~/lancedb

# 2. Ingest votes to PostgreSQL
./target/release/polsearch votes ingest \
  --path ~/data/votes

# 3. Generate vote embeddings
./target/release/polsearch votes embed \
  --lancedb-path ~/lancedb

# 4. Create FTS index
./target/release/polsearch db index --lancedb-path ~/lancedb
```

## Step 6: Floor Speeches (When Ready)

Once you have the floor speech JSON transcripts:

```bash
# Transfer transcripts to Droplet
rsync -avz floor_speeches_transcripts/ root@<droplet-ip>:~/data/floor_speeches/

# On Droplet - ingest floor speeches
./target/release/polsearch speeches ingest \
  --path ~/data/floor_speeches \
  --lancedb-path ~/lancedb
```

## Step 7: Persist LanceDB (Before Destroying Droplet)

**Critical**: Back up LanceDB before destroying the Droplet!

### Using polsearch util (from Mac)

```bash
polsearch util pull root@<droplet-ip>:~/lancedb/ -o ~/.polsearch/lancedb/
```

### Or backup to DO Spaces (from Droplet)

```bash
apt install s3cmd && s3cmd --configure
s3cmd sync ~/lancedb/ s3://your-space/polsearch-lancedb/
```

## Verification

```bash
# Check table counts
./target/release/polsearch db tables --lancedb-path ~/lancedb

# Test search
./target/release/polsearch search "immigration policy" --lancedb-path ~/lancedb
```

## Cost Estimate

| Resource | Cost |
|----------|------|
| 60 vCPU Droplet (1 hour) | ~$2.44 |
| DO Spaces (LanceDB ~2GB) | ~$0.02/month |
| **Total for embedding run** | **~$2.50** |

## Util Command Reference

```bash
# Create archive
polsearch util archive --paths <path1> <path2> ... -o <output.tar.gz>

# Push to remote
polsearch util push <archive> -r <user@host:path>

# Pull from remote
polsearch util pull <user@host:path> -o <local-path>

# Extract archive
polsearch util unarchive <archive> -d <destination>
```
