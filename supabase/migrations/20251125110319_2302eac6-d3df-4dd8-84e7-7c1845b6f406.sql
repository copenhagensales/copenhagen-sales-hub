-- Create teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add team_id to applications (for hired candidates)
ALTER TABLE public.applications
ADD COLUMN team_id UUID REFERENCES public.teams(id);

-- Add employment tracking fields
ALTER TABLE public.applications
ADD COLUMN hired_date DATE,
ADD COLUMN employment_ended_date DATE,
ADD COLUMN employment_end_reason TEXT;

-- Enable RLS on teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- RLS policies for teams
CREATE POLICY "Authenticated users can view teams"
  ON public.teams FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage teams"
  ON public.teams FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add update trigger for teams
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default teams
INSERT INTO public.teams (id, name, description) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000001', 'Team Nord', 'Dækker København og Nordsjælland'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000002', 'Team Syd', 'Dækker Sjælland og øerne'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000003', 'Team Vest', 'Dækker Jylland'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-000000000004', 'Team Øst', 'Dækker Fyn og Østjylland');