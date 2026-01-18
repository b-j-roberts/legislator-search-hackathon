# Data Roadmap

Roadmap for scraping, normalizing, and integrating congressional data into the app.

## Phase 0: Inventory and Contracts

- [ ] Confirm canonical IDs (bioguide, lis, thomas, govtrack) and crosswalk strategy
- [ ] Define unified schemas for Legislator, Hearing, Vote, Record, Document, Transcript
- [ ] Document source-of-truth per field and citation requirements
- [ ] Create data freshness SLAs by source (daily, weekly, monthly)

## Phase 1: Data Ingestion (Raw)

### Legislators and Committees
- [ ] Import `congress-legislators` datasets (current, historical, social, committees, membership, offices)
- [ ] Snapshot raw files into a versioned store
- [ ] Normalize party, chamber, state, district fields

### Hearings
- [ ] Load `congress-hearings` output (meetings, witnesses, sources, related bills)
- [ ] Enrich with GovInfo CHRG transcript links where available
- [ ] Store source URLs for audit

### Votes
- [ ] Load `congress-votes` output (roll call votes, outcomes, member positions)
- [ ] Normalize bill IDs and chamber/session fields
- [ ] Keep raw XML/source links

### Congressional Record
- [ ] Load `congress-records` output (issues, sections, articles)
- [ ] Extract bill references into structured links
- [ ] Store article source links (text/PDF)

### Video and Transcripts
- [ ] Import `video-processing` outputs (IA, YouTube appearances, transcripts)
- [ ] Attach transcripts to legislators by bioguide ID
- [ ] Keep time-coded segments for citations

## Phase 2: Normalization and Linking

- [ ] Build a cross-source entity linker (legislator, committee, bill, hearing)
- [ ] Normalize bill IDs (e.g., HR1234, S. 5) across sources
- [ ] Link votes and record articles to bills and hearings
- [ ] Link hearings to committees and members
- [ ] Generate stance evidence bundles per legislator and topic

## Phase 3: Indexing and Retrieval

- [ ] Create search index for documents, hearings, votes, and transcripts
- [ ] Add semantic embeddings for text-heavy sources (record articles, transcripts)
- [ ] Implement citations and provenance tracking in retrieval results
- [ ] Add filters by chamber, committee, date, party, state, stance

## Phase 4: App Integration

- [ ] Expose unified API endpoints for search and chat context retrieval
- [ ] Return structured context for LLM prompts (with citations)
- [ ] Add results tabs for hearings, documents, votes, statements
- [ ] Enable report generation to include linked sources

## Phase 5: Quality, Trust, and Safety

- [ ] Build validation checks (missing fields, broken links, stale data)
- [ ] Add regression tests for key queries and summaries
- [ ] Implement confidence scoring and explainability
- [ ] Human review workflows for high-impact outputs

## Phase 6: Operations and Maintenance

- [ ] Schedule incremental updates by source (cron or pipeline)
- [ ] Track data versions and change logs
- [ ] Monitor ingestion failures and API quotas
- [ ] Backfill historical data and handle corrections

