-- Add DELETE policy for candidates table
-- Allow authenticated users to delete candidates
CREATE POLICY "Authenticated users can delete candidates" 
ON candidates 
FOR DELETE 
TO authenticated
USING (true);