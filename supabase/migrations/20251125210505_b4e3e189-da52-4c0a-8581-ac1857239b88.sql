-- Enable realtime for communication_logs table
ALTER TABLE public.communication_logs REPLICA IDENTITY FULL;

-- Add communication_logs to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.communication_logs;