-- Congressional hearing tables for transcript search

-- Hearings (document-level metadata)
CREATE TABLE hearings (
    id UUID PRIMARY KEY,
    package_id VARCHAR(100) UNIQUE NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    title VARCHAR(1024) NOT NULL,
    committee_raw VARCHAR(512),
    committee_slug VARCHAR(100),
    chambers VARCHAR(50)[] NOT NULL,
    congress SMALLINT NOT NULL,
    hearing_date DATE NOT NULL,
    year_month VARCHAR(7) NOT NULL,
    source_url VARCHAR(2048) NOT NULL,
    total_statements INTEGER DEFAULT 0,
    total_segments INTEGER DEFAULT 0,
    is_processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Committees lookup table for fuzzy matching
CREATE TABLE committees (
    id UUID PRIMARY KEY,
    name VARCHAR(512) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    chamber VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Statements (speaker turns from JSON)
CREATE TABLE hearing_statements (
    id UUID PRIMARY KEY,
    hearing_id UUID NOT NULL REFERENCES hearings(id) ON DELETE CASCADE,
    statement_index INTEGER NOT NULL,
    speaker_label VARCHAR(255) NOT NULL,
    speaker_id UUID REFERENCES speakers(id),
    text TEXT NOT NULL,
    word_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(hearing_id, statement_index)
);

-- Segments (chunks for embedding)
CREATE TABLE hearing_segments (
    id UUID PRIMARY KEY,
    hearing_id UUID NOT NULL REFERENCES hearings(id) ON DELETE CASCADE,
    statement_id UUID NOT NULL REFERENCES hearing_statements(id) ON DELETE CASCADE,
    segment_index INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    text_preview VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(hearing_id, segment_index)
);

-- Indexes for hearings
CREATE INDEX idx_hearings_package_id ON hearings(package_id);
CREATE INDEX idx_hearings_chambers ON hearings USING GIN(chambers);
CREATE INDEX idx_hearings_committee_slug ON hearings(committee_slug);
CREATE INDEX idx_hearings_congress ON hearings(congress);
CREATE INDEX idx_hearings_year_month ON hearings(year_month);
CREATE INDEX idx_hearings_hearing_date ON hearings(hearing_date DESC);
CREATE INDEX idx_hearings_is_processed ON hearings(is_processed) WHERE NOT is_processed;

-- Indexes for statements
CREATE INDEX idx_hearing_statements_hearing_id ON hearing_statements(hearing_id);
CREATE INDEX idx_hearing_statements_speaker_id ON hearing_statements(speaker_id);

-- Indexes for segments
CREATE INDEX idx_hearing_segments_hearing_id ON hearing_segments(hearing_id);
CREATE INDEX idx_hearing_segments_statement_id ON hearing_segments(statement_id);

-- Indexes for committees
CREATE INDEX idx_committees_slug ON committees(slug);
CREATE INDEX idx_committees_chamber ON committees(chamber);
