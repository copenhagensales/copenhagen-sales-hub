import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore - Import from esm.sh
import twilio from "https://esm.sh/twilio@5.3.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Allow both GET and POST requests
  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed. Use GET or POST." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    console.log("[Twilio Token] Request received:", req.method);

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
    const missingVars = [];
    if (!accountSid) missingVars.push("TWILIO_ACCOUNT_SID");
    if (!apiKeySid) missingVars.push("TWILIO_API_KEY_SID");
    if (!apiKeySecret) missingVars.push("TWILIO_API_KEY_SECRET");
    if (!twimlAppSid) missingVars.push("TWILIO_TWIML_APP_SID");

    if (missingVars.length > 0) {
      const errorMsg = `Missing required Twilio credentials: ${missingVars.join(", ")}`;
      console.error("[Twilio Token]", errorMsg);
      throw new Error(errorMsg);
    }

    // Validate credential formats
    if (accountSid && !accountSid.startsWith("AC")) {
      throw new Error("Invalid TWILIO_ACCOUNT_SID format (must start with AC)");
    }
    if (apiKeySid && !apiKeySid.startsWith("SK")) {
      throw new Error("Invalid TWILIO_API_KEY_SID format (must start with SK)");
    }
    if (twimlAppSid && !twimlAppSid.startsWith("AP")) {
      throw new Error("Invalid TWILIO_TWIML_APP_SID format (must start with AP)");
    }

    // Use fixed identity "agent" for incoming calls to work
    const identity = "agent";
    console.log("[Twilio Token] Using identity:", identity);

    // Create Access Token using official Twilio library
    console.log("[Twilio Token] Creating access token...");

    let AccessToken, VoiceGrant, accessToken, voiceGrant, token;

    try {
      AccessToken = twilio.jwt.AccessToken;
      VoiceGrant = AccessToken.VoiceGrant;
      console.log("[Twilio Token] Twilio library loaded successfully");
    } catch (libError) {
      console.error("[Twilio Token] Error loading Twilio library:", libError);
      throw new Error(
        `Failed to load Twilio library: ${libError instanceof Error ? libError.message : "Unknown error"}`,
      );
    }

    try {
      // Create an access token (assertions safe because we validated above)
      accessToken = new AccessToken(accountSid!, apiKeySid!, apiKeySecret!, { identity });
      console.log("[Twilio Token] Access token object created");
    } catch (tokenError) {
      console.error("[Twilio Token] Error creating access token:", tokenError);
      throw new Error(
        `Failed to create access token: ${tokenError instanceof Error ? tokenError.message : "Unknown error"}`,
      );
    }

    try {
      // Create a Voice grant
      voiceGrant = new VoiceGrant({
        outgoingApplicationSid: twimlAppSid,
        incomingAllow: true,
      });
      console.log("[Twilio Token] Voice grant created");
    } catch (grantError) {
      console.error("[Twilio Token] Error creating voice grant:", grantError);
      throw new Error(
        `Failed to create voice grant: ${grantError instanceof Error ? grantError.message : "Unknown error"}`,
      );
    }

    try {
      // Add the grant to the token
      accessToken.addGrant(voiceGrant);
      console.log("[Twilio Token] Grant added to token");
    } catch (addGrantError) {
      console.error("[Twilio Token] Error adding grant:", addGrantError);
      throw new Error(
        `Failed to add grant: ${addGrantError instanceof Error ? addGrantError.message : "Unknown error"}`,
      );
    }

    try {
      // Generate the JWT
      token = accessToken.toJwt();
      console.log("[Twilio Token] Token generated successfully, length:", token.length);
      console.log("[Twilio Token] Token preview:", `${token.slice(0, 50)}...`);
    } catch (jwtError) {
      console.error("[Twilio Token] Error generating JWT:", jwtError);
      throw new Error(`Failed to generate JWT: ${jwtError instanceof Error ? jwtError.message : "Unknown error"}`);
    }

    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;

    console.error("[Twilio Token] Error details:", {
      message: errorMessage,
      stack: errorStack,
      type: error?.constructor?.name,
    });

    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: errorStack,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
