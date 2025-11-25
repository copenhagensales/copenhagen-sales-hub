-- Update RLS policy for revenue_data to allow authenticated users to insert
-- This allows all authenticated users (not just admins/hiring managers) to add revenue data
DROP POLICY IF EXISTS "Admins and hiring managers can insert revenue" ON revenue_data;

CREATE POLICY "Authenticated users can insert revenue" 
ON revenue_data 
FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Also update the update policy
DROP POLICY IF EXISTS "Admins and hiring managers can update revenue" ON revenue_data;

CREATE POLICY "Authenticated users can update revenue" 
ON revenue_data 
FOR UPDATE 
TO authenticated
USING (true);

-- Update view policy
DROP POLICY IF EXISTS "Admins and hiring managers can view revenue" ON revenue_data;

CREATE POLICY "Authenticated users can view revenue" 
ON revenue_data 
FOR SELECT 
TO authenticated
USING (true);