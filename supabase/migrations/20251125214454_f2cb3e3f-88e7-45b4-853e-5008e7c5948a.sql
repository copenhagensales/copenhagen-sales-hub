-- Add interview_date column to applications table
ALTER TABLE public.applications ADD COLUMN interview_date timestamp with time zone;