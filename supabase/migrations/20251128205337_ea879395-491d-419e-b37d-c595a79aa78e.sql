-- Add new statuses to application_status enum
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'ghostet';
ALTER TYPE application_status ADD VALUE IF NOT EXISTS 'takket_nej';