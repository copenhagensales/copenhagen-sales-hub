import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.84.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse Twilio's form data
    const formData = await req.formData();
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;
    const messageSid = formData.get('MessageSid') as string;

    console.log(`Received SMS from ${from}: ${body}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find candidate by phone number
    const { data: candidates, error: candidateError } = await supabase
      .from('candidates')
      .select('id')
      .eq('phone', from)
      .limit(1);

    if (candidateError) {
      console.error('Error finding candidate:', candidateError);
      throw candidateError;
    }

    if (!candidates || candidates.length === 0) {
      console.log(`No candidate found with phone ${from}`);
      // Return TwiML response anyway
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'text/xml' 
          } 
        }
      );
    }

    const candidateId = candidates[0].id;

    // Find most recent application for this candidate
    const { data: applications, error: appError } = await supabase
      .from('applications')
      .select('id')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (appError) {
      console.error('Error finding application:', appError);
      throw appError;
    }

    if (!applications || applications.length === 0) {
      console.log(`No application found for candidate ${candidateId}`);
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { 
          status: 200, 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'text/xml' 
          } 
        }
      );
    }

    const applicationId = applications[0].id;

    // Log the inbound SMS
    const { error: logError } = await supabase
      .from('communication_logs')
      .insert({
        application_id: applicationId,
        type: 'sms',
        direction: 'inbound',
        content: body,
        outcome: 'received',
      });

    if (logError) {
      console.error('Error logging SMS:', logError);
      throw logError;
    }

    console.log(`SMS logged for application ${applicationId}`);

    // Return empty TwiML response (no auto-reply)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/xml' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in receive-sms:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    
    // Still return valid TwiML to Twilio
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { 
        status: 200, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'text/xml' 
        } 
      }
    );
  }
});
