-- Phase 2: Rename models for political content
-- podcasts -> sources, episodes -> content

-- Rename podcasts to sources
ALTER TABLE podcasts RENAME TO sources;
ALTER TABLE sources RENAME COLUMN rss_url TO url;
ALTER TABLE sources ADD COLUMN source_type VARCHAR(50) NOT NULL DEFAULT 'audio';
ALTER TABLE sources ADD COLUMN is_available BOOLEAN NOT NULL DEFAULT TRUE;

-- Rename episodes to content
ALTER TABLE episodes RENAME TO content;
ALTER TABLE content RENAME COLUMN podcast_id TO source_id;
ALTER TABLE content RENAME COLUMN is_transcribed TO is_processed;
ALTER TABLE content RENAME COLUMN audio_url TO content_url;
ALTER TABLE content RENAME COLUMN audio_duration_seconds TO duration_seconds;

-- Rename episode_speakers to content_speakers
ALTER TABLE episode_speakers RENAME TO content_speakers;
ALTER TABLE content_speakers RENAME COLUMN episode_id TO content_id;

-- Update segments
ALTER TABLE segments RENAME COLUMN episode_id TO content_id;
ALTER TABLE segments RENAME COLUMN episode_speaker_id TO content_speaker_id;
ALTER TABLE segments ALTER COLUMN start_time_ms DROP NOT NULL;
ALTER TABLE segments ALTER COLUMN end_time_ms DROP NOT NULL;

-- Update transcription_tasks
ALTER TABLE transcription_tasks RENAME COLUMN episode_id TO content_id;

-- Add content_variants table for multi-format support
CREATE TABLE content_variants (
    id UUID PRIMARY KEY,
    content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    variant_type VARCHAR(50) NOT NULL,
    variant_url VARCHAR(2048) NOT NULL,
    duration_seconds INTEGER,
    is_canonical BOOLEAN NOT NULL DEFAULT FALSE,
    -- Provenance fields
    source_url VARCHAR(2048) NOT NULL,
    access_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    checksum VARCHAR(64),
    original_format VARCHAR(50) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add speaker_aliases table for speaker resolution tracking
CREATE TABLE speaker_aliases (
    id UUID PRIMARY KEY,
    alias_text VARCHAR(255) NOT NULL,
    resolved_speaker_id UUID REFERENCES speakers(id),
    confidence REAL NOT NULL DEFAULT 0.0,
    needs_review BOOLEAN NOT NULL DEFAULT TRUE,
    context TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rename indexes
ALTER INDEX idx_episodes_podcast_id RENAME TO idx_content_source_id;
ALTER INDEX idx_episode_speakers_episode_id RENAME TO idx_content_speakers_content_id;
ALTER INDEX idx_episode_speakers_speaker_id RENAME TO idx_content_speakers_speaker_id;
ALTER INDEX idx_segments_episode_id RENAME TO idx_segments_content_id;
ALTER INDEX idx_segments_episode_speaker_id RENAME TO idx_segments_content_speaker_id;
ALTER INDEX idx_transcription_tasks_episode_id RENAME TO idx_transcription_tasks_content_id;
ALTER INDEX idx_episodes_published_at RENAME TO idx_content_published_at;
ALTER INDEX idx_episodes_year_month RENAME TO idx_content_year_month;
ALTER INDEX idx_episodes_is_transcribed RENAME TO idx_content_is_processed;

-- Rename constraints
ALTER TABLE content RENAME CONSTRAINT episodes_podcast_id_fkey TO content_source_id_fkey;
ALTER TABLE content RENAME CONSTRAINT episodes_podcast_id_guid_key TO content_source_id_guid_key;
ALTER TABLE content_speakers RENAME CONSTRAINT episode_speakers_episode_id_fkey TO content_speakers_content_id_fkey;
ALTER TABLE content_speakers RENAME CONSTRAINT episode_speakers_speaker_id_fkey TO content_speakers_speaker_id_fkey;
ALTER TABLE content_speakers RENAME CONSTRAINT episode_speakers_episode_id_local_speaker_label_key TO content_speakers_content_id_local_speaker_label_key;
ALTER TABLE segments RENAME CONSTRAINT segments_episode_id_fkey TO segments_content_id_fkey;
ALTER TABLE segments RENAME CONSTRAINT segments_episode_speaker_id_fkey TO segments_content_speaker_id_fkey;
ALTER TABLE transcription_tasks RENAME CONSTRAINT transcription_tasks_episode_id_fkey TO transcription_tasks_content_id_fkey;

-- New indexes
CREATE INDEX idx_content_variants_content_id ON content_variants(content_id);
CREATE INDEX idx_speaker_aliases_resolved_speaker_id ON speaker_aliases(resolved_speaker_id);
CREATE INDEX idx_speaker_aliases_needs_review ON speaker_aliases(needs_review) WHERE needs_review = TRUE;
