import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore - Import from esm.sh
import twilio from "https://esm.sh/twilio@5.3.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Twilio credentials from environment
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const apiKeySid = Deno.env.get("TWILIO_API_KEY_SID");
    const apiKeySecret = Deno.env.get("TWILIO_API_KEY_SECRET");
    const twimlAppSid = Deno.env.get("TWILIO_TWIML_APP_SID");

    console.log("[Twilio Token] Environment check:", {
      accountSid: accountSid ? `${accountSid.slice(0, 8)}...` : "MISSING",
      apiKeySid: apiKeySid ? `${apiKeySid.slice(0, 8)}...` : "MISSING",
      apiKeySecret: apiKeySecret ? "SET" : "MISSING",
      twimlAppSid: twimlAppSid ? `${twimlAppSid.slice(0, 8)}...` : "MISSING",
    });

    // Validate all required credentials are present
    if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
      throw new Error("Missing required Twilio credentials");
    }

    // Validate credential formats
    if (!accountSid.startsWith("AC")) {
      throw new Error("Invalid TWILIO_ACCOUNT_SID format (must start with AC)");
    }
    if (!apiKeySid.startsWith("SK")) {
      throw new Error("Invalid TWILIO_API_KEY_SID format (must start with SK)");
    }
    if (!twimlAppSid.startsWith("AP")) {
      throw new Error("Invalid TWILIO_TWIML_APP_SID format (must start with AP)");
    }

    // Use fixed identity "agent" for incoming calls to work
    const identity = "agent";
    console.log("[Twilio Token] Using identity:", identity);

    // Create Access Token using official Twilio library
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    // Create an access token
    const accessToken = new AccessToken(accountSid, apiKeySid, apiKeySecret, { identity });

    // Create a Voice grant
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: twimlAppSid,
      incomingAllow: true,
    });

    // Add the grant to the token
    accessToken.addGrant(voiceGrant);

    // Generate the JWT
    const token = accessToken.toJwt();

    console.log("[Twilio Token] Token generated successfully using Twilio library, length:", token.length);
    console.log("[Twilio Token] Token preview:", `${token.slice(0, 50)}...`);

    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    // Catch any errors and ensure CORS headers are always returned
    console.error("[Twilio Token] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
