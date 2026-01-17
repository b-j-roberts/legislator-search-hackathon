-- Add updated_at column to all tables that are missing it

-- Episodes: add updated_at
ALTER TABLE episodes ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
UPDATE episodes SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE episodes ALTER COLUMN updated_at SET NOT NULL;

-- Speakers: add updated_at
ALTER TABLE speakers ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
UPDATE speakers SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE speakers ALTER COLUMN updated_at SET NOT NULL;

-- Episode speakers: add both created_at and updated_at
ALTER TABLE episode_speakers ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE episode_speakers ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
UPDATE episode_speakers SET created_at = NOW(), updated_at = NOW() WHERE created_at IS NULL;
ALTER TABLE episode_speakers ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE episode_speakers ALTER COLUMN updated_at SET NOT NULL;

-- Transcription batches: add updated_at
ALTER TABLE transcription_batches ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
UPDATE transcription_batches SET updated_at = COALESCE(completed_at, started_at, created_at) WHERE updated_at IS NULL;
ALTER TABLE transcription_batches ALTER COLUMN updated_at SET NOT NULL;

-- Transcription tasks: add both created_at and updated_at
ALTER TABLE transcription_tasks ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE transcription_tasks ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
UPDATE transcription_tasks SET created_at = NOW(), updated_at = COALESCE(completed_at, started_at, NOW()) WHERE created_at IS NULL;
ALTER TABLE transcription_tasks ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE transcription_tasks ALTER COLUMN updated_at SET NOT NULL;

-- Segments: add both created_at and updated_at
ALTER TABLE segments ADD COLUMN created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE segments ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
UPDATE segments SET created_at = NOW(), updated_at = NOW() WHERE created_at IS NULL;
ALTER TABLE segments ALTER COLUMN created_at SET NOT NULL;
ALTER TABLE segments ALTER COLUMN updated_at SET NOT NULL;
