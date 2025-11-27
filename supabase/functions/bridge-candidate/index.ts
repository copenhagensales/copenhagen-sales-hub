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
    const url = new URL(req.url);
    const candidatePhone = url.searchParams.get("candidate");
    const candidateId = url.searchParams.get("candidateId");
    const callerNumber = Deno.env.get("TWILIO_CALLER_NUMBER");

    if (!candidatePhone) {
      return new Response(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say language="da-DK">Fejl: Intet kandidat nummer</Say></Response>',
        { status: 400, headers: { "Content-Type": "text/xml" } },
      );
    }

    console.log(`Connecting browser softphone directly to candidate: ${candidatePhone}`);

    // Generate TwiML to dial the candidate directly
    // The caller ID will be the Twilio number, so candidate can call back
    // This connects the browser softphone directly to the candidate
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerNumber || ""}">
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
