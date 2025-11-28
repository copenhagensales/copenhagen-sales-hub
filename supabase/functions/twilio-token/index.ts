import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Helper function to base64 URL encode
function base64UrlEncode(str: string): string {
  const base64 = btoa(unescape(encodeURIComponent(str)));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

// Helper function to create HMAC SHA256 signature
async function createSignature(header: string, payload: string, secret: string): Promise<string> {
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

// Generate Twilio Access Token JWT manually
async function generateTwilioToken(
  accountSid: string,
  apiKeySid: string,
  apiKeySecret: string,
  twimlAppSid: string,
  identity: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const expiration = now + 3600; // 1 hour expiration

  // Create header
  const header = {
    cty: "twilio-fpa;v=1",
    typ: "JWT",
    alg: "HS256",
  };

  // Create payload
  const payload = {
    jti: `${apiKeySid}-${now}`,
    iss: apiKeySid,
    sub: accountSid,
    exp: expiration,
    grants: {
      identity: identity,
      voice: {
        outgoing: {
          application_sid: twimlAppSid,
        },
        incoming: {
          allow: true,
        },
      },
    },
  };

  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  // Create signature
  const signature = await createSignature(encodedHeader, encodedPayload, apiKeySecret);

  // Combine to create JWT
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

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

    // Generate the JWT token manually
    const token = await generateTwilioToken(accountSid, apiKeySid, apiKeySecret, twimlAppSid, identity);

    console.log("[Twilio Token] Token generated successfully, length:", token.length);
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
