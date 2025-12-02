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
    const callSid = formData.get('CallSid');
    const callStatus = formData.get('CallStatus');
    
    console.log(`=== Incoming Call ===`);
    console.log(`From: ${from}`);
    console.log(`To: ${to}`);
    console.log(`CallSid: ${callSid}`);
    console.log(`CallStatus: ${callStatus}`);

    // Generate TwiML to connect the incoming call to the agent's softphone
    // IMPORTANT: The identity "agent" must match the identity used when generating
    // the Twilio access token in twilio-voice-token function
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial>
    <Client>agent</Client>
  </Dial>
</Response>`;

    console.log(`Routing call to Client: agent`);
    console.log(`TwiML Response:`, twiml);

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
