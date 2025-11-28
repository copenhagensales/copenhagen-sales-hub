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
    // Handle GET request - TwiML for outbound calls from browser
    if (req.method === "GET") {
      const url = new URL(req.url);
      const to = url.searchParams.get("To"); // Phone number from Twilio Voice SDK

      if (!to) {
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Say language="da-DK">Fejl: Intet telefonnummer</Say></Response>',
          { status: 400, headers: { "Content-Type": "text/xml" } },
        );
      }

      const callerNumber = Deno.env.get("TWILIO_CALLER_NUMBER");

      console.log(`Outbound call from browser to: ${to}`);

      // Return TwiML to dial the candidate directly
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerNumber || ""}">
    <Number>${to}</Number>
  </Dial>
</Response>`;

      return new Response(twiml, {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Handle POST request - Legacy API call (kept for backward compatibility)
    const { candidatePhone, agentPhone } = await req.json();

    if (!candidatePhone) {
      return new Response(JSON.stringify({ error: "candidatePhone is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const callerNumber = Deno.env.get("TWILIO_CALLER_NUMBER");
    const defaultAgentNumber = Deno.env.get("AGENT_DEFAULT_NUMBER");

    if (!accountSid || !authToken || !callerNumber) {
      console.error("Missing Twilio credentials");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const agentNumber = agentPhone || defaultAgentNumber;
    if (!agentNumber) {
      return new Response(JSON.stringify({ error: "No agent phone number provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appBaseUrl = Deno.env.get("SUPABASE_URL")?.replace("/rest/v1", "");
    const bridgeUrl = `${appBaseUrl}/functions/v1/bridge-candidate?candidate=${encodeURIComponent(candidatePhone)}`;

    console.log(`Starting call: Agent ${agentNumber} -> Candidate ${candidatePhone}`);
    console.log(`Bridge URL: ${bridgeUrl}`);

    // Call Twilio API to create call
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
    const auth = btoa(`${accountSid}:${authToken}`);

    const formData = new URLSearchParams({
      To: agentNumber,
      From: callerNumber,
      Url: bridgeUrl,
    });

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Twilio API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: `Twilio error: ${response.status}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callData = await response.json();
    console.log("Call created:", callData.sid);

    return new Response(JSON.stringify({ sid: callData.sid, status: "initiated" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in call-candidate:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
