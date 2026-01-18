# Architecture

## Module Organization

**Preferred style:** `module_name.rs` over `mod.rs`

When creating new modules, use a single file named after the module rather than a directory with `mod.rs`. This convention provides clearer file names in editors and search results.

Note: Some existing code uses `mod.rs` - this documents the preferred convention going forward.

## Crate Overview

The project is organized as a Cargo workspace with 7 crates:

| Crate | Purpose |
|-------|---------|
| `polsearch-core` | Domain models and error types |
| `polsearch-db` | Database layer using the repository pattern |
| `polsearch-util` | Shared utilities across crates |
| `polsearch-pipeline` | Content processing stages |
| `polsearch-archive` | Local archive storage |
| `polsearch-cli` | Command-line interface |
| `xtask` | Development automation tasks |

## Dependency Flow

```
polsearch-cli
    └── polsearch-db
            └── polsearch-core

polsearch-pipeline
    ├── polsearch-core
    ├── polsearch-db
    └── polsearch-archive

polsearch-util ← (used by multiple crates)
```

## Key Patterns

### Repository Pattern
Database access is organized through repository structs in `polsearch-db`. Each repository encapsulates queries for a specific domain entity.

### One File Per Concept
- One file per model in `polsearch-core`
- One file per repository in `polsearch-db`
- One file per pipeline stage in `polsearch-pipeline`
- One file per command in `polsearch-cli`

### Type Aliases
Type aliases are used to maintain backward compatibility when refactoring.

## Technology Stack

| Component | Technology |
|-----------|------------|
| Async runtime | Tokio |
| Database | PostgreSQL via sqlx |
| Vector store | LanceDB |
| Embeddings | fastembed (384-dimensional vectors) |
| CLI | Clap |
| Error handling | color-eyre |
| Logging | tracing |
