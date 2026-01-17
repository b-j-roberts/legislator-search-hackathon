-- Initial schema for PodSearch
-- Postgres stores metadata only; transcripts and search indexes live in LanceDB

-- Podcasts (55+ Bitcoin shows)
CREATE TABLE podcasts (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    rss_url VARCHAR(2048) NOT NULL UNIQUE,
    artwork_url VARCHAR(2048),
    known_hosts JSONB DEFAULT '[]',
    tier SMALLINT NOT NULL DEFAULT 3,
    total_episodes INTEGER DEFAULT 0,
    transcribed_episodes INTEGER DEFAULT 0,
    last_fetched_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Episodes
CREATE TABLE episodes (
    id UUID PRIMARY KEY,
    podcast_id UUID NOT NULL REFERENCES podcasts(id) ON DELETE CASCADE,
    guid VARCHAR(2048) NOT NULL,
    title VARCHAR(1024) NOT NULL,
    description TEXT,
    published_at TIMESTAMPTZ NOT NULL,
    year_month VARCHAR(7) NOT NULL,
    audio_url VARCHAR(2048) NOT NULL,
    thumbnail_url VARCHAR(2048),
    audio_duration_seconds INTEGER,
    is_transcribed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(podcast_id, guid)
);

-- Speakers (global cross-podcast entities)
CREATE TABLE speakers (
    id UUID PRIMARY KEY,
    merged_into_id UUID REFERENCES speakers(id),
    name VARCHAR(255),
    slug VARCHAR(100) UNIQUE,
    total_appearances INTEGER DEFAULT 0,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Episode speakers (per-episode speaker instances)
CREATE TABLE episode_speakers (
    id UUID PRIMARY KEY,
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    local_speaker_label VARCHAR(50) NOT NULL,
    speaker_id UUID REFERENCES speakers(id),
    match_confidence REAL,
    speaking_time_seconds INTEGER DEFAULT 0,
    UNIQUE(episode_id, local_speaker_label)
);

-- Transcription batches (created by transcribe-plan command)
CREATE TABLE transcription_batches (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    total_episodes INTEGER DEFAULT 0,
    completed_episodes INTEGER DEFAULT 0,
    failed_episodes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ
);

-- Transcription tasks (individual episodes in a batch)
CREATE TABLE transcription_tasks (
    id UUID PRIMARY KEY,
    batch_id UUID NOT NULL REFERENCES transcription_batches(id) ON DELETE CASCADE,
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'queued',
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    UNIQUE(batch_id, episode_id)
);

-- Segments (minimal metadata - text and embeddings in LanceDB)
CREATE TABLE segments (
    id UUID PRIMARY KEY,
    episode_id UUID NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
    episode_speaker_id UUID REFERENCES episode_speakers(id),
    start_time_ms INTEGER NOT NULL,
    end_time_ms INTEGER NOT NULL,
    segment_index INTEGER NOT NULL
);

-- Indexes for foreign keys
CREATE INDEX idx_episodes_podcast_id ON episodes(podcast_id);
CREATE INDEX idx_episode_speakers_episode_id ON episode_speakers(episode_id);
CREATE INDEX idx_episode_speakers_speaker_id ON episode_speakers(speaker_id);
CREATE INDEX idx_segments_episode_id ON segments(episode_id);
CREATE INDEX idx_segments_episode_speaker_id ON segments(episode_speaker_id);
CREATE INDEX idx_transcription_tasks_batch_id ON transcription_tasks(batch_id);
CREATE INDEX idx_transcription_tasks_episode_id ON transcription_tasks(episode_id);

-- Indexes for common query patterns
CREATE INDEX idx_episodes_published_at ON episodes(published_at DESC);
CREATE INDEX idx_episodes_year_month ON episodes(year_month);
CREATE INDEX idx_episodes_is_transcribed ON episodes(is_transcribed) WHERE NOT is_transcribed;
CREATE INDEX idx_speakers_merged_into_id ON speakers(merged_into_id) WHERE merged_into_id IS NOT NULL;
CREATE INDEX idx_transcription_batches_status ON transcription_batches(status);
CREATE INDEX idx_transcription_tasks_status ON transcription_tasks(status);
