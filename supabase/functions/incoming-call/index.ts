import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse incoming call data from Twilio webhook
    const formData = await req.formData();
    const from = formData.get('From');
    const to = formData.get('To');
    
    console.log(`Incoming call from ${from} to ${to}`);

    // Generate TwiML to connect the incoming call to the agent's softphone
    // This uses Twilio Client to route to the web-based softphone
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="da-DK">Forbinder dig til en agent</Say>
  <Dial>
    <Client>agent</Client>
  </Dial>
</Response>`;

    return new Response(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    });

  } catch (error) {
    console.error('Error in incoming-call:', error);
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="da-DK">Der opstod en fejl. Prøv venligst igen senere.</Say>
</Response>`;
    return new Response(errorTwiml, {
      status: 500,
      headers: { 'Content-Type': 'text/xml' }
    });
  }
});
