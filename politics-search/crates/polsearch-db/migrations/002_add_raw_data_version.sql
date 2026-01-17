-- Add raw_data_version column to track which episodes have raw transcript/diarization data
-- NULL = no raw data (legacy episodes)
-- 1 = token confidence + diarization quality + word timings

ALTER TABLE episodes ADD COLUMN raw_data_version INTEGER DEFAULT NULL;
