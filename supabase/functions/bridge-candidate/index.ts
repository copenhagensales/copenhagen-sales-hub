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
    const url = new URL(req.url);
    const agentPhone = url.searchParams.get('agent');

    if (!agentPhone) {
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say language="da-DK">Fejl: Intet agent nummer</Say></Response>',
        { status: 400, headers: { 'Content-Type': 'text/xml' } }
      );
    }

    console.log(`Bridging to agent: ${agentPhone}`);

    // Generate TwiML to dial the agent
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="da-DK">Et øjeblik, du bliver forbundet</Say>
  <Dial>
    <Number>${agentPhone}</Number>
  </Dial>
</Response>`;

    return new Response(twiml, {
      status: 200,
      headers: { 'Content-Type': 'text/xml' }
    });

  } catch (error) {
    console.error('Error in bridge-candidate:', error);
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="da-DK">Der opstod en fejl</Say>
</Response>`;
    return new Response(errorTwiml, {
      status: 500,
      headers: { 'Content-Type': 'text/xml' }
    });
  }
});
