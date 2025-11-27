-- Add 'Ny ansøgning' to the application_status enum
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'ny_ansoegning';