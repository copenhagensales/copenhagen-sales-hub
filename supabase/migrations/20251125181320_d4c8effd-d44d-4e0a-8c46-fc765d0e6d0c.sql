-- Update revenue_data table structure for 30/60/90 day periods
-- Add new period column for day-based tracking
ALTER TABLE revenue_data ADD COLUMN period INTEGER;

-- Drop old month/year columns
ALTER TABLE revenue_data DROP COLUMN period_month;
ALTER TABLE revenue_data DROP COLUMN period_year;

-- Drop commission and notes columns
ALTER TABLE revenue_data DROP COLUMN commission;
ALTER TABLE revenue_data DROP COLUMN notes;

-- Add constraint to ensure period is 30, 60, or 90
ALTER TABLE revenue_data ADD CONSTRAINT revenue_data_period_check 
  CHECK (period IN (30, 60, 90));