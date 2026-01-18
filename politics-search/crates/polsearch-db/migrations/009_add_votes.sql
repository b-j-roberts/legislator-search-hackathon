-- Congressional vote data schema

-- Legislators table - central entity linking votes, speeches, and content
CREATE TABLE legislators (
    id UUID PRIMARY KEY,
    bioguide_id VARCHAR(20) UNIQUE NOT NULL,
    lis_id VARCHAR(20) UNIQUE,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    display_name VARCHAR(200) NOT NULL,
    current_party VARCHAR(10) NOT NULL,
    current_state VARCHAR(5) NOT NULL,
    current_chamber VARCHAR(10) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_legislators_bioguide ON legislators(bioguide_id);
CREATE INDEX idx_legislators_lis ON legislators(lis_id) WHERE lis_id IS NOT NULL;
CREATE INDEX idx_legislators_party ON legislators(current_party);
CREATE INDEX idx_legislators_state ON legislators(current_state);
CREATE INDEX idx_legislators_chamber ON legislators(current_chamber);
CREATE INDEX idx_legislators_active ON legislators(is_active);

-- Bills table - referenced by votes
CREATE TABLE bills (
    id UUID PRIMARY KEY,
    congress SMALLINT NOT NULL,
    bill_type VARCHAR(10) NOT NULL,
    bill_number INTEGER NOT NULL,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(congress, bill_type, bill_number)
);

CREATE INDEX idx_bills_congress ON bills(congress);
CREATE INDEX idx_bills_type ON bills(bill_type);

-- Amendments table - referenced by votes
CREATE TABLE amendments (
    id UUID PRIMARY KEY,
    congress SMALLINT NOT NULL,
    chamber VARCHAR(10) NOT NULL,
    amendment_number INTEGER NOT NULL,
    purpose TEXT,
    bill_id UUID REFERENCES bills(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(congress, chamber, amendment_number)
);

CREATE INDEX idx_amendments_congress ON amendments(congress);
CREATE INDEX idx_amendments_bill ON amendments(bill_id) WHERE bill_id IS NOT NULL;

-- Nominations table - referenced by confirmation votes
CREATE TABLE nominations (
    id UUID PRIMARY KEY,
    congress SMALLINT NOT NULL,
    nomination_number VARCHAR(50) NOT NULL,
    name TEXT NOT NULL,
    position TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(congress, nomination_number)
);

CREATE INDEX idx_nominations_congress ON nominations(congress);

-- Roll call votes - vote metadata
CREATE TABLE roll_call_votes (
    id UUID PRIMARY KEY,
    vote_id VARCHAR(50) UNIQUE NOT NULL,
    congress SMALLINT NOT NULL,
    chamber VARCHAR(10) NOT NULL,
    session VARCHAR(10) NOT NULL,
    vote_number INTEGER NOT NULL,
    vote_date TIMESTAMPTZ NOT NULL,
    year_month VARCHAR(7) NOT NULL,
    question TEXT NOT NULL,
    vote_type VARCHAR(100),
    category VARCHAR(50),
    subject TEXT,
    result VARCHAR(50) NOT NULL,
    result_text TEXT,
    requires VARCHAR(20),
    yea_count INTEGER DEFAULT 0,
    nay_count INTEGER DEFAULT 0,
    present_count INTEGER DEFAULT 0,
    not_voting_count INTEGER DEFAULT 0,
    bill_id UUID REFERENCES bills(id),
    amendment_id UUID REFERENCES amendments(id),
    nomination_id UUID REFERENCES nominations(id),
    source_url VARCHAR(512),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_roll_call_votes_vote_id ON roll_call_votes(vote_id);
CREATE INDEX idx_roll_call_votes_congress ON roll_call_votes(congress);
CREATE INDEX idx_roll_call_votes_chamber ON roll_call_votes(chamber);
CREATE INDEX idx_roll_call_votes_date ON roll_call_votes(vote_date);
CREATE INDEX idx_roll_call_votes_year_month ON roll_call_votes(year_month);
CREATE INDEX idx_roll_call_votes_category ON roll_call_votes(category) WHERE category IS NOT NULL;
CREATE INDEX idx_roll_call_votes_bill ON roll_call_votes(bill_id) WHERE bill_id IS NOT NULL;
CREATE INDEX idx_roll_call_votes_nomination ON roll_call_votes(nomination_id) WHERE nomination_id IS NOT NULL;

-- Individual votes - each legislator's position on a roll call
CREATE TABLE individual_votes (
    id UUID PRIMARY KEY,
    roll_call_vote_id UUID NOT NULL REFERENCES roll_call_votes(id) ON DELETE CASCADE,
    legislator_id UUID NOT NULL REFERENCES legislators(id),
    position VARCHAR(20) NOT NULL,
    raw_position VARCHAR(50),
    party_at_vote VARCHAR(10) NOT NULL,
    state_at_vote VARCHAR(5) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(roll_call_vote_id, legislator_id)
);

CREATE INDEX idx_individual_votes_roll_call ON individual_votes(roll_call_vote_id);
CREATE INDEX idx_individual_votes_legislator ON individual_votes(legislator_id);
CREATE INDEX idx_individual_votes_position ON individual_votes(position);
CREATE INDEX idx_individual_votes_party ON individual_votes(party_at_vote);

-- Add legislator_id to speakers table for linking hearing speakers to legislators
ALTER TABLE speakers ADD COLUMN legislator_id UUID REFERENCES legislators(id);
CREATE INDEX idx_speakers_legislator ON speakers(legislator_id) WHERE legislator_id IS NOT NULL;
