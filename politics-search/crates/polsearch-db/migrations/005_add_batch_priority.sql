ALTER TABLE transcription_batches ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_transcription_batches_priority ON transcription_batches(priority);
