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
    const { candidatePhone, candidateId } = await req.json();

    if (!candidatePhone) {
      return new Response(JSON.stringify({ error: "candidatePhone is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const callerNumber = Deno.env.get("TWILIO_CALLER_NUMBER");
    const appBaseUrl = Deno.env.get("SUPABASE_URL")?.replace("/rest/v1", "");

    if (!accountSid || !authToken || !callerNumber) {
      console.error("Missing Twilio credentials");
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate TwiML URL that will dial the candidate directly
    // This TwiML will be executed when the browser softphone makes the outbound call
    const twimlUrl = `${appBaseUrl}/functions/v1/bridge-candidate?candidate=${encodeURIComponent(candidatePhone)}&candidateId=${candidateId || ""}`;

    console.log(`Preparing direct browser call to candidate: ${candidatePhone}`);
    console.log(`TwiML URL: ${twimlUrl}`);

    // For browser-based softphone using Twilio Voice SDK:
    // The browser should initiate the call directly using:
    // device.connect({ To: candidatePhone })
    //
    // IMPORTANT: Configure your Twilio access token (in twilio-token function) to use
    // this TwiML URL as the outbound application URL, OR ensure your Twilio Voice SDK
    // is configured to route outbound calls through this TwiML URL.
    //
    // When the browser calls device.connect({ To: candidatePhone }), Twilio will:
    // 1. Route the call through the TwiML app/URL configured in the access token
    // 2. Execute the bridge-candidate TwiML which dials the candidate
    // 3. The candidate will see the Twilio number (TWILIO_CALLER_NUMBER) as caller ID
    // 4. Audio flows directly between browser and candidate (no agent mobile phone)

    return new Response(
      JSON.stringify({
        success: true,
        twimlUrl: twimlUrl,
        candidatePhone: candidatePhone,
        callerNumber: callerNumber,
        message: "Ready for direct browser-to-candidate call",
        // Browser should now use: device.connect({ To: candidatePhone })
        // The call will route through bridge-candidate TwiML automatically
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in call-candidate:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
