-- Remove text columns from hearing tables
-- Full text content is stored in LanceDB (source of truth for search)
-- PostgreSQL only stores metadata and relations

ALTER TABLE hearing_statements DROP COLUMN text;
ALTER TABLE hearing_segments DROP COLUMN text_preview;
