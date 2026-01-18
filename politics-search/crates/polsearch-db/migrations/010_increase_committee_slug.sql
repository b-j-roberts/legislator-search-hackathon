-- Increase committee_slug size to handle long committee names
ALTER TABLE hearings ALTER COLUMN committee_slug TYPE VARCHAR(255);
ALTER TABLE committees ALTER COLUMN slug TYPE VARCHAR(255);
