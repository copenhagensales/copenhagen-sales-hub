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
    console.log('Incoming Twilio voice webhook');
    
    // Get the To parameter from Twilio
    const formData = await req.formData();
    const to = formData.get('To') as string;
    
    console.log('Call to:', to);

    // Generate TwiML response to dial the number
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="+4531604931">
    <Number>${to}</Number>
  </Dial>
</Response>`;

    return new Response(twiml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/xml',
      },
    });
  } catch (error) {
    console.error('Error in Twilio voice webhook:', error);
    
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>An error occurred. Please try again later.</Say>
</Response>`;

    return new Response(errorTwiml, {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/xml',
      },
    });
  }
});
