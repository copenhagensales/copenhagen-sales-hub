-- Create sub_teams table
CREATE TABLE public.sub_teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(team_id, name)
);

-- Enable RLS
ALTER TABLE public.sub_teams ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Authenticated users can view sub_teams"
ON public.sub_teams
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage sub_teams"
ON public.sub_teams
FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_sub_teams_updated_at
BEFORE UPDATE ON public.sub_teams
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert existing United sub-teams
INSERT INTO public.sub_teams (team_id, name)
SELECT t.id, sub.name
FROM public.teams t
CROSS JOIN (
  VALUES ('Tryg'), ('ASE'), ('Finansforbundet'), ('Business Danmark'), ('Codan'), ('AKA')
) AS sub(name)
WHERE t.name = 'United';