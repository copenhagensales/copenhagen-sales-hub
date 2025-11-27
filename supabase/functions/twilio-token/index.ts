import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { create } from "https://deno.land/x/djwt@v3.0.1/mod.ts";

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

    // Create JWT manually
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600; // Token expires in 1 hour

    // Create the grants object for Voice
    const grants = {
      identity: identity,
      voice: {
        outgoing: {
          application_sid: twimlAppSid,
        },
        incoming: {
          allow: true,
        },
      },
    };

    // Create JWT payload according to Twilio spec
    const payload = {
      jti: `${apiKeySid}-${now}`,
      iss: apiKeySid,
      sub: accountSid,
      exp: exp,
      nbf: now,
      grants: grants,
    };

    console.log("[Twilio Token] Creating JWT with payload:", {
      jti: payload.jti,
      iss: apiKeySid!.slice(0, 8) + "...",
      sub: accountSid!.slice(0, 8) + "...",
      identity: identity,
      grants: "voice with outgoing and incoming",
    });

    // Create CryptoKey from the API secret
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(apiKeySecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );

    // Generate the JWT
    const token = await create(
      { alg: "HS256", typ: "JWT" },
      payload,
      key
    );

    console.log("[Twilio Token] Token generated successfully, length:", token.length);
    console.log("[Twilio Token] Token preview:", `${token.slice(0, 50)}...`);

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
      }
    );
  }
});
