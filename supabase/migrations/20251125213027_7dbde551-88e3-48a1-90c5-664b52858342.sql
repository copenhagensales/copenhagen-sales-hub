-- Create notes table for detailed candidate notes
CREATE TABLE public.candidate_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  note_type TEXT NOT NULL CHECK (note_type IN ('call', 'email', 'general', 'important', 'action_item')),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.candidate_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view notes"
ON public.candidate_notes
FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert notes"
ON public.candidate_notes
FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update notes"
ON public.candidate_notes
FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete notes"
ON public.candidate_notes
FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Create index for faster queries
CREATE INDEX idx_candidate_notes_candidate_id ON public.candidate_notes(candidate_id);
CREATE INDEX idx_candidate_notes_created_at ON public.candidate_notes(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_candidate_notes_updated_at
BEFORE UPDATE ON public.candidate_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();