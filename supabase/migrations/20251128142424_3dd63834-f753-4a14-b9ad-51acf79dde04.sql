-- Add sub_team column to applications table for United team sub-teams
ALTER TABLE applications ADD COLUMN sub_team text;

-- Add comment explaining the field
COMMENT ON COLUMN applications.sub_team IS 'Sub-team for United team: Tryg, ASE, Finansforbundet, Business Danmark, Codan, AKA';