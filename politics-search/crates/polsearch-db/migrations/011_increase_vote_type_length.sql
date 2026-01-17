-- Increase vote_type from VARCHAR(100) to TEXT for long vote type descriptions
ALTER TABLE roll_call_votes ALTER COLUMN vote_type TYPE TEXT;
