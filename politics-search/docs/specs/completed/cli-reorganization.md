# CLI Reorganization Spec

## Overview

Reorganize the `polsearch` CLI from flat commands into logical subcommand groups for better discoverability and organization.

## Current Structure

```
polsearch <command>

Commands:
  version                Print version information
  db                     Inspect LanceDB tables (has subcommands)
  ingest-hearings        Ingest congressional hearing transcripts
  fetch-floor-speeches   Fetch floor speech transcripts from GovInfo
  ingest-floor-speeches  Ingest Congressional Record floor speech transcripts
  committees             List and manage committees (has subcommands)
  ingest-votes           Ingest congressional vote data
  embed-votes            Embed vote data for semantic search
  missing-hearings       Find hearings missing transcripts
  search                 Search congressional content
```

## Proposed Structure

```
polsearch <command>

Commands:
  version      Print version information
  search       Search congressional content
  db           Inspect LanceDB tables
  hearings     Manage congressional hearing data
  speeches     Manage floor speech data
  votes        Manage vote data
  committees   List and manage committees
```

### Subcommand Details

#### `polsearch hearings <subcommand>`
```
hearings ingest   Ingest congressional hearing transcripts
hearings missing  Find hearings missing transcripts
```

#### `polsearch speeches <subcommand>`
```
speeches fetch    Fetch floor speech transcripts from GovInfo
speeches ingest   Ingest Congressional Record floor speech transcripts
```

#### `polsearch votes <subcommand>`
```
votes ingest   Ingest congressional vote data
votes embed    Embed vote data for semantic search
```

#### `polsearch db <subcommand>` (unchanged)
```
db tables   List all tables with row counts
db show     Show rows from a table
db search   Search text embeddings
db index    Create FTS index on text column
```

#### `polsearch committees <subcommand>` (unchanged)
```
committees list    List all committees
committees search  Search committees by name
```

## Implementation

### File Structure (no changes needed)
The command implementation files remain the same:
- `commands/ingest_hearings.rs`
- `commands/missing_hearings.rs`
- `commands/fetch_floor_speeches.rs`
- `commands/ingest_floor_speeches.rs`
- `commands/ingest_votes.rs`
- `commands/embed_votes.rs`
- `commands/db.rs`
- `commands/committees.rs`
- `commands/search.rs`

### Changes to `main.rs`

1. Add new subcommand enums:

```rust
#[derive(Subcommand)]
enum HearingsCommands {
    /// Ingest congressional hearing transcripts
    Ingest {
        #[arg(long, default_value = "data/transcripts")]
        path: String,
        #[arg(long)]
        limit: Option<usize>,
        #[arg(long)]
        force: bool,
        #[arg(long)]
        dry_run: bool,
        #[arg(long)]
        validate: bool,
        #[arg(long, default_value = "~/.polsearch/lancedb")]
        lancedb_path: String,
    },
    /// Find hearings missing transcripts
    Missing {
        #[arg(long)]
        yaml: String,
        #[arg(long, default_value = "data/transcripts")]
        transcripts: String,
        #[arg(long)]
        output: Option<String>,
        #[arg(long)]
        congress: Option<i16>,
        #[arg(long)]
        chamber: Option<String>,
    },
}

#[derive(Subcommand)]
enum SpeechesCommands {
    /// Fetch floor speech transcripts from GovInfo
    Fetch {
        #[arg(long)]
        year: i32,
        #[arg(long, default_value = "data/floor_speech_transcripts")]
        output: String,
        #[arg(long)]
        limit: Option<usize>,
        #[arg(long)]
        force: bool,
        #[arg(long)]
        dry_run: bool,
    },
    /// Ingest Congressional Record floor speech transcripts
    Ingest {
        #[arg(long, default_value = "data/floor_speech_transcripts")]
        path: String,
        #[arg(long)]
        limit: Option<usize>,
        #[arg(long)]
        force: bool,
        #[arg(long)]
        dry_run: bool,
        #[arg(long)]
        validate: bool,
        #[arg(long, default_value = "~/.polsearch/lancedb")]
        lancedb_path: String,
    },
}

#[derive(Subcommand)]
enum VotesCommands {
    /// Ingest congressional vote data
    Ingest {
        #[arg(long, default_value = "data/votes")]
        path: String,
        #[arg(long)]
        limit: Option<usize>,
        #[arg(long)]
        force: bool,
        #[arg(long)]
        dry_run: bool,
    },
    /// Embed vote data for semantic search
    Embed {
        #[arg(long)]
        limit: Option<usize>,
        #[arg(long)]
        force: bool,
        #[arg(long)]
        dry_run: bool,
        #[arg(long, default_value = "~/.polsearch/lancedb")]
        lancedb_path: String,
    },
}
```

2. Update top-level Commands enum:

```rust
#[derive(Subcommand)]
enum Commands {
    /// Print version information
    Version,

    /// Search congressional content
    Search { /* ... existing args ... */ },

    /// Inspect LanceDB tables
    Db {
        #[command(subcommand)]
        command: DbCommands,
        #[arg(long, default_value = "~/.polsearch/lancedb", global = true)]
        lancedb_path: String,
    },

    /// Manage congressional hearing data
    Hearings {
        #[command(subcommand)]
        command: HearingsCommands,
    },

    /// Manage floor speech data
    Speeches {
        #[command(subcommand)]
        command: SpeechesCommands,
    },

    /// Manage vote data
    Votes {
        #[command(subcommand)]
        command: VotesCommands,
    },

    /// List and manage committees
    Committees {
        #[command(subcommand)]
        command: CommitteesCommands,
    },
}
```

3. Update match statement in main():

```rust
match cli.command {
    Commands::Version => { /* ... */ }
    Commands::Search { /* ... */ } => { /* ... */ }
    Commands::Db { command, lancedb_path } => { /* ... existing ... */ }
    Commands::Hearings { command } => match command {
        HearingsCommands::Ingest { path, limit, force, dry_run, validate, lancedb_path } => {
            let expanded = shellexpand::tilde(&lancedb_path).to_string();
            commands::ingest_hearings::run(&path, limit, force, dry_run, validate, &expanded).await?;
        }
        HearingsCommands::Missing { yaml, transcripts, output, congress, chamber } => {
            commands::missing_hearings::run(&yaml, &transcripts, output, congress, chamber).await?;
        }
    },
    Commands::Speeches { command } => match command {
        SpeechesCommands::Fetch { year, output, limit, force, dry_run } => {
            commands::fetch_floor_speeches::run(year, &output, limit, force, dry_run).await?;
        }
        SpeechesCommands::Ingest { path, limit, force, dry_run, validate, lancedb_path } => {
            let expanded = shellexpand::tilde(&lancedb_path).to_string();
            commands::ingest_floor_speeches::run(&path, limit, force, dry_run, validate, &expanded).await?;
        }
    },
    Commands::Votes { command } => match command {
        VotesCommands::Ingest { path, limit, force, dry_run } => {
            commands::ingest_votes::run(&path, limit, force, dry_run).await?;
        }
        VotesCommands::Embed { limit, force, dry_run, lancedb_path } => {
            let expanded = shellexpand::tilde(&lancedb_path).to_string();
            commands::embed_votes::run(limit, force, dry_run, &expanded).await?;
        }
    },
    Commands::Committees { command } => { /* ... existing ... */ }
}
```

## Example Usage

```bash
# Search (most common operation - stays at top level)
polsearch search "climate change"
polsearch search "immigration" --type hearing --congress 118

# Hearings
polsearch hearings ingest --path data/transcripts --limit 10
polsearch hearings missing --yaml hearings.yaml --congress 118

# Floor Speeches
polsearch speeches fetch --year 2024 --limit 100
polsearch speeches ingest --path data/floor_speech_transcripts

# Votes
polsearch votes ingest --path data/votes
polsearch votes embed --force

# Committees
polsearch committees list --chamber senate
polsearch committees search "judiciary"

# Database inspection
polsearch db tables
polsearch db show text_embeddings --limit 5
```

## Migration Notes

- No breaking changes to underlying command implementations
- Only the CLI interface changes
- Users will need to update any scripts using the old command names
- Help text will guide users to new command structure

## Testing

After implementation:
1. `cargo build -p polsearch-cli`
2. `polsearch --help` - verify new structure
3. `polsearch hearings --help` - verify subcommands
4. `polsearch speeches --help` - verify subcommands
5. `polsearch votes --help` - verify subcommands
