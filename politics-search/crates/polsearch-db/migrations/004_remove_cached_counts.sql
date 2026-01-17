-- Remove cached episode counts from podcasts table
-- These are now computed on-the-fly from the episodes table
ALTER TABLE podcasts DROP COLUMN IF EXISTS total_episodes;
ALTER TABLE podcasts DROP COLUMN IF EXISTS transcribed_episodes;
