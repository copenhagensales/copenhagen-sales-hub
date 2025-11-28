import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    let candidatePhone: string | null = null;

    // Handle POST requests (from Twilio Voice SDK webhook)
    if (req.method === "POST") {
      const formData = await req.formData();
      candidatePhone = formData.get("To") as string | null;
    }

    // Handle GET requests (for backward compatibility)
    if (!candidatePhone) {
      const url = new URL(req.url);
      candidatePhone = url.searchParams.get("candidate") || url.searchParams.get("To");
    }

    if (!candidatePhone) {
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say language="da-DK">Fejl: Intet kandidat nummer</Say></Response>',
        { status: 400, headers: { "Content-Type": "text/xml" } },
      );
    }

    const callerNumber = Deno.env.get("TWILIO_CALLER_NUMBER");

    if (!callerNumber) {
      console.error("Missing TWILIO_CALLER_NUMBER");
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say language="da-DK">Server konfigurationsfejl</Say></Response>',
        { status: 500, headers: { "Content-Type": "text/xml" } },
      );
    }

    console.log(`Bridging to candidate: ${candidatePhone} from ${callerNumber}`);

    // Generate TwiML to dial the candidate with proper caller ID
    // This ensures candidates see the Twilio number and can call back
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerNumber}">
    <Number>${candidatePhone}</Number>
  </Dial>
</Response>`;

    return new Response(twiml, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });
  } catch (error) {
    console.error("Error in bridge-candidate:", error);
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="da-DK">Der opstod en fejl</Say>
</Response>`;
    return new Response(errorTwiml, {
      status: 500,
      headers: { "Content-Type": "text/xml" },
    });
  }
});
