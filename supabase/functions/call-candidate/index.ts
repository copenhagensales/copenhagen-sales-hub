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

    // For browser softphone: Handle GET requests (TwiML for Voice SDK)
    // When browser uses Voice SDK: device.connect({ To: candidatePhone })
    // Twilio will call this URL - configure TwiML App Voice URL to point here
    if (req.method === "GET") {
      // Get candidate phone from query parameter or Twilio's 'To' parameter
      // The browser should construct URL like: /call-candidate?candidate=PHONE_NUMBER
      // Or Twilio may send 'To' parameter when Voice SDK initiates call
      const candidatePhone = url.searchParams.get("To") || url.searchParams.get("candidate");

      if (!candidatePhone) {
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Say language="en-US">Error: No candidate phone number provided</Say></Response>',
          { status: 400, headers: { "Content-Type": "text/xml" } },
        );
      }

      const callerNumber = Deno.env.get("TWILIO_CALLER_NUMBER");

      if (!callerNumber) {
        console.error("Missing Twilio caller number");
        return new Response(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Say language="en-US">Server configuration error</Say></Response>',
          { status: 500, headers: { "Content-Type": "text/xml" } },
        );
      }

      console.log(`Browser softphone calling candidate: ${candidatePhone}`);

      // Return TwiML that dials the candidate directly from the browser
      // The browser Voice SDK initiated the call, and this TwiML connects to the candidate
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerNumber}" record="false">
    <Number>${candidatePhone}</Number>
  </Dial>
</Response>`;

      return new Response(twiml, {
        status: 200,
        headers: { "Content-Type": "text/xml" },
      });
    }

    // Handle POST requests - check if it's Twilio form data (TwiML request) or JSON (API request)
    if (req.method === "POST") {
      const contentType = req.headers.get("content-type") || "";

      // Check if it's Twilio form data (for TwiML requests)
      if (contentType.includes("application/x-www-form-urlencoded")) {
        const formData = await req.formData();
        const candidatePhone = formData.get("To") || formData.get("candidate");

        if (!candidatePhone) {
          return new Response(
            '<?xml version="1.0" encoding="UTF-8"?><Response><Say language="en-US">Error: No candidate phone number provided</Say></Response>',
            { status: 400, headers: { "Content-Type": "text/xml" } },
          );
        }

        const callerNumber = Deno.env.get("TWILIO_CALLER_NUMBER");

        if (!callerNumber) {
          console.error("Missing Twilio caller number");
          return new Response(
            '<?xml version="1.0" encoding="UTF-8"?><Response><Say language="en-US">Server configuration error</Say></Response>',
            { status: 500, headers: { "Content-Type": "text/xml" } },
          );
        }

        console.log(`Browser softphone calling candidate (POST): ${candidatePhone}`);

        const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerNumber}" record="false">
    <Number>${candidatePhone}</Number>
  </Dial>
</Response>`;

        return new Response(twiml, {
          status: 200,
          headers: { "Content-Type": "text/xml" },
        });
      }

      // For JSON POST requests (API calls - backward compatibility)
      if (contentType.includes("application/json")) {
        const { candidatePhone } = await req.json();

        if (!candidatePhone) {
          return new Response(JSON.stringify({ error: "candidatePhone is required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
        const authToken = Deno.env.get("TWILIO_AUTH_TOKEN");
        const callerNumber = Deno.env.get("TWILIO_CALLER_NUMBER");

        if (!accountSid || !authToken || !callerNumber) {
          console.error("Missing Twilio credentials");
          return new Response(JSON.stringify({ error: "Server configuration error" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const appBaseUrl = Deno.env.get("SUPABASE_URL")?.replace("/rest/v1", "");
        const twimlUrl = `${appBaseUrl}/functions/v1/call-candidate?candidate=${encodeURIComponent(candidatePhone)}`;

        console.log(`API initiating call to candidate: ${candidatePhone}`);
        console.log(`TwiML URL: ${twimlUrl}`);

        // This POST method is for server-side call initiation (not typically used for browser softphone)
        // Browser should use GET method with TwiML URL directly
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`;
        const auth = btoa(`${accountSid}:${authToken}`);

        const formData = new URLSearchParams({
          To: callerNumber, // This would need to be adjusted based on your use case
          From: callerNumber,
          Url: twimlUrl,
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
      }
    }

    // If we reach here, it's an unsupported request
    return new Response(JSON.stringify({ error: "Method not supported or missing candidate phone" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in call-candidate:", error);
    const message = error instanceof Error ? error.message : "Unknown error";

    if (req.method === "GET") {
      const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="en-US">An error occurred: ${message}</Say>
</Response>`;
      return new Response(errorTwiml, {
        status: 500,
        headers: { "Content-Type": "text/xml" },
      });
    }

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
