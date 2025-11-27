-- Replace application_status enum with 5 new statuses

-- Remove default value first
ALTER TABLE applications ALTER COLUMN status DROP DEFAULT;

-- Convert the column to text temporarily
ALTER TABLE applications ALTER COLUMN status TYPE text;

-- Update existing data to map to new statuses
UPDATE applications SET status = 'ansat' WHERE status = 'ansat';
UPDATE applications SET status = 'ikke_kvalificeret' WHERE status IN ('afslag', 'ghosted');
UPDATE applications SET status = 'startet' WHERE status IN ('ny', 'telefon_screening', 'case', 'interview', 'tilbud');

-- Drop old enum
DROP TYPE application_status;

-- Create new enum with 5 statuses
CREATE TYPE application_status AS ENUM (
  'ansat',
  'udskudt_samtale',
  'ikke_kvalificeret',
  'ikke_ansat',
  'startet'
);

-- Convert column back to enum type
ALTER TABLE applications 
  ALTER COLUMN status TYPE application_status 
  USING status::application_status;

-- Set default status to 'startet' for new applications
ALTER TABLE applications 
  ALTER COLUMN status SET DEFAULT 'startet'::application_status;