-- Allow authenticated users to update the read status of communication logs
CREATE POLICY "Authenticated users can update communication logs read status"
ON public.communication_logs
FOR UPDATE
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);