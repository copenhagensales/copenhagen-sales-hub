-- Add read status column to communication_logs
ALTER TABLE public.communication_logs 
ADD COLUMN read BOOLEAN DEFAULT FALSE;

-- Add index for faster filtering of unread messages
CREATE INDEX idx_communication_logs_unread 
ON public.communication_logs(read, direction, created_at DESC) 
WHERE direction = 'inbound';