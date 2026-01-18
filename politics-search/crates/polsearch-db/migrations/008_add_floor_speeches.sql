-- Congressional Record floor speech tables for transcript search

-- Floor speeches (document-level metadata)
CREATE TABLE floor_speeches (
    id UUID PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE NOT NULL,
    granule_id VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(1024) NOT NULL,
    chamber VARCHAR(50) NOT NULL,
    page_type VARCHAR(10) NOT NULL,
    speech_date DATE NOT NULL,
    year_month VARCHAR(7) NOT NULL,
    source_url VARCHAR(2048) NOT NULL,
    total_statements INTEGER DEFAULT 0,
    total_segments INTEGER DEFAULT 0,
    is_processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Floor speech statements (speaker turns from parsed CREC)
CREATE TABLE floor_speech_statements (
    id UUID PRIMARY KEY,
    floor_speech_id UUID NOT NULL REFERENCES floor_speeches(id) ON DELETE CASCADE,
    statement_index INTEGER NOT NULL,
    speaker_label VARCHAR(255) NOT NULL,
    speaker_id UUID REFERENCES speakers(id),
    text TEXT NOT NULL,
    word_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(floor_speech_id, statement_index)
);

-- Floor speech segments (chunks for embedding)
CREATE TABLE floor_speech_segments (
    id UUID PRIMARY KEY,
    floor_speech_id UUID NOT NULL REFERENCES floor_speeches(id) ON DELETE CASCADE,
    statement_id UUID NOT NULL REFERENCES floor_speech_statements(id) ON DELETE CASCADE,
    segment_index INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    text_preview VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(floor_speech_id, segment_index)
);

-- Indexes for floor_speeches
CREATE INDEX idx_floor_speeches_event_id ON floor_speeches(event_id);
CREATE INDEX idx_floor_speeches_granule_id ON floor_speeches(granule_id);
CREATE INDEX idx_floor_speeches_chamber ON floor_speeches(chamber);
CREATE INDEX idx_floor_speeches_page_type ON floor_speeches(page_type);
CREATE INDEX idx_floor_speeches_year_month ON floor_speeches(year_month);
CREATE INDEX idx_floor_speeches_speech_date ON floor_speeches(speech_date DESC);
CREATE INDEX idx_floor_speeches_is_processed ON floor_speeches(is_processed) WHERE NOT is_processed;

-- Indexes for floor_speech_statements
CREATE INDEX idx_floor_speech_statements_floor_speech_id ON floor_speech_statements(floor_speech_id);
CREATE INDEX idx_floor_speech_statements_speaker_id ON floor_speech_statements(speaker_id);

-- Indexes for floor_speech_segments
CREATE INDEX idx_floor_speech_segments_floor_speech_id ON floor_speech_segments(floor_speech_id);
CREATE INDEX idx_floor_speech_segments_statement_id ON floor_speech_segments(statement_id);
