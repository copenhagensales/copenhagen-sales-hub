-- Create email_templates table
CREATE TABLE public.email_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  template_key TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

-- Create policies for email templates
CREATE POLICY "Authenticated users can view email templates"
ON public.email_templates
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage email templates"
ON public.email_templates
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add trigger for automatic timestamp updates
CREATE TRIGGER update_email_templates_updated_at
BEFORE UPDATE ON public.email_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default email templates
INSERT INTO public.email_templates (name, template_key, subject, content) VALUES
('Tak for ansøgning', 'application_received', 'Tak for din ansøgning hos Copenhagen Sales', 'Hej {{fornavn}},

Tak for din interesse i stillingen som {{rolle}} hos Copenhagen Sales.

Vi har modtaget din ansøgning og vil vende tilbage til dig snarest muligt.

Med venlig hilsen
Copenhagen Sales'),

('Invitation til samtale', 'interview_invitation', 'Invitation til jobsamtale - {{rolle}}', 'Hej {{fornavn}},

Vi vil gerne invitere dig til en samtale om stillingen som {{rolle}}.

Vi glæder os til at møde dig!

Med venlig hilsen
Copenhagen Sales'),

('Afslag på ansøgning', 'application_rejected', 'Vedr. din ansøgning hos Copenhagen Sales', 'Hej {{fornavn}},

Tak for din ansøgning til stillingen som {{rolle}}.

Desværre må vi meddele, at vi har valgt at gå videre med andre kandidater denne gang.

Vi ønsker dig held og lykke fremadrettet.

Med venlig hilsen
Copenhagen Sales'),

('Tilbud om ansættelse', 'job_offer', 'Tilbud om ansættelse - {{rolle}}', 'Hej {{fornavn}},

Vi er glade for at kunne tilbyde dig stillingen som {{rolle}} hos Copenhagen Sales.

Kontakt os venligst for at drøfte de nærmere detaljer.

Tillykke!

Med venlig hilsen
Copenhagen Sales');