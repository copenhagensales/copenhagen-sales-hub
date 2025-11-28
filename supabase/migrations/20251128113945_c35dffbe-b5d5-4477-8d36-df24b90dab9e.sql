-- Create sms_templates table
CREATE TABLE public.sms_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  template_key text NOT NULL UNIQUE,
  content text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_templates ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view templates
CREATE POLICY "Authenticated users can view templates" 
ON public.sms_templates 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Only admins can manage templates
CREATE POLICY "Admins can manage templates" 
ON public.sms_templates 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::user_role))
WITH CHECK (has_role(auth.uid(), 'admin'::user_role));

-- Create trigger for updated_at
CREATE TRIGGER update_sms_templates_updated_at
BEFORE UPDATE ON public.sms_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default templates
INSERT INTO public.sms_templates (name, template_key, content) VALUES
('Tak for ansøgning', 'tak_for_ansoegning', 'Hej {{fornavn}}! Tak for din ansøgning til {{rolle}} hos Copenhagen Sales. Vi vender tilbage hurtigst muligt. Mvh. Copenhagen Sales'),
('Invitation til telefonsamtale', 'opkald_invitation', 'Hej {{fornavn}}! Vi vil gerne tale med dig om stillingen som {{rolle}}. Hvornår passer det dig at få et opkald? Mvh. Copenhagen Sales'),
('Invitation til samtale', 'interview_invitation', 'Hej {{fornavn}}! Vi vil gerne invitere dig til en jobsamtale om {{rolle}} stillingen. Hvornår passer det dig? Mvh. Copenhagen Sales'),
('Afventer dit svar', 'afventer_svar', 'Hej {{fornavn}}! Vi har sendt dig en besked omkring {{rolle}} stillingen. Lad os høre fra dig. Mvh. Copenhagen Sales'),
('Tom besked', 'blank', '');