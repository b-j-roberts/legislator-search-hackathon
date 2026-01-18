# Demo Tuning Notes

Things to potentially tweak to improve demo results.

## Hybrid Search (RRF)

- **k constant**: Currently `k = 60` for both embedded and FTS-only results
  - If embedded results should rank higher: try `k = 60` for embedded, `k = 65` for FTS-only
  - If FTS-only results are being buried: lower the FTS k value
  - Standard range: 50-70

## Content Coverage

- **Embeddings**: 2025 only
- **FTS**: 2020-2026
- Pick demo queries that have relevant results in both time ranges to showcase hybrid

## Curated Queries

Queries known to work well:
- [ ] (add tested queries here)

Queries to avoid:
- [ ] (add problematic queries here)

## Score Observations

Notes from testing:
- (record observations about ranking quality here)
