-- Add first_viewed_at column to track when candidate was first viewed
ALTER TABLE public.candidates 
ADD COLUMN first_viewed_at timestamp with time zone DEFAULT NULL;