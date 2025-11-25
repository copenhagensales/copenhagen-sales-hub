-- Create enum for application roles
CREATE TYPE public.application_role AS ENUM ('fieldmarketing', 'salgskonsulent');

-- Create enum for application status
CREATE TYPE public.application_status AS ENUM (
  'ny',
  'telefon_screening',
  'case_rollespil',
  'interview',
  'tilbud',
  'ansat',
  'afslag',
  'ghosted_cold'
);

-- Create enum for user roles
CREATE TYPE public.user_role AS ENUM ('admin', 'hiring_manager', 'interviewer');

-- Create candidates table (person-level)
CREATE TABLE public.candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_candidate_email UNIQUE (email),
  CONSTRAINT unique_candidate_phone UNIQUE (phone)
);

-- Create applications table (multiple per candidate)
CREATE TABLE public.applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES public.candidates(id) ON DELETE CASCADE,
  role public.application_role NOT NULL,
  source TEXT,
  application_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  status public.application_status NOT NULL DEFAULT 'ny',
  responsible_user_id UUID REFERENCES auth.users(id),
  next_step TEXT,
  deadline DATE,
  rejection_reason TEXT,
  rejection_details TEXT,
  cv_url TEXT,
  cover_letter_url TEXT,
  test_results_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create communication logs
CREATE TABLE public.communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'email', 'sms', 'phone'
  direction TEXT NOT NULL, -- 'inbound', 'outbound'
  content TEXT,
  outcome TEXT, -- for phone: 'answered', 'no_answer', 'callback'
  duration INTEGER, -- for phone calls in seconds
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create performance tracking table
CREATE TABLE public.performance_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  review_period INTEGER NOT NULL, -- 30, 60, or 90 days
  rating TEXT NOT NULL, -- 'green', 'yellow', 'red' or '1-5'
  comments TEXT,
  review_date DATE NOT NULL,
  reviewed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create revenue/commission tracking
CREATE TABLE public.revenue_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.applications(id) ON DELETE CASCADE,
  period_month INTEGER NOT NULL,
  period_year INTEGER NOT NULL,
  revenue DECIMAL(10,2),
  commission DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table for permissions
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.user_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_role UNIQUE (user_id, role)
);

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create function to check user role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Enable RLS
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for candidates (all authenticated users can read/write)
CREATE POLICY "Authenticated users can view candidates"
  ON public.candidates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert candidates"
  ON public.candidates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update candidates"
  ON public.candidates FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for applications
CREATE POLICY "Authenticated users can view applications"
  ON public.applications FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert applications"
  ON public.applications FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update applications"
  ON public.applications FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for communication_logs
CREATE POLICY "Authenticated users can view communication logs"
  ON public.communication_logs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert communication logs"
  ON public.communication_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies for performance_reviews
CREATE POLICY "Authenticated users can view performance reviews"
  ON public.performance_reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert performance reviews"
  ON public.performance_reviews FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update performance reviews"
  ON public.performance_reviews FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for revenue_data
CREATE POLICY "Admins and hiring managers can view revenue"
  ON public.revenue_data FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'hiring_manager')
  );

CREATE POLICY "Admins and hiring managers can insert revenue"
  ON public.revenue_data FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'hiring_manager')
  );

CREATE POLICY "Admins and hiring managers can update revenue"
  ON public.revenue_data FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR 
    public.has_role(auth.uid(), 'hiring_manager')
  );

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Trigger for profiles on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', '')
  );
  RETURN new;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update timestamp triggers
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_candidates_updated_at
  BEFORE UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_applications_updated_at
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_revenue_data_updated_at
  BEFORE UPDATE ON public.revenue_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();