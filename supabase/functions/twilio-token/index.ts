/**
 * Twilio Access Token Generator for Voice SDK
 *
 * This function generates JWT access tokens for Twilio Voice SDK.
 *
 * COMMON ISSUES AND SOLUTIONS:
 *
 * 1. JWT Invalid Error (31204/20101):
 *    - Ensure TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET are from the SAME API key
 *    - Verify the secret is the full string (not truncated)
 *    - Check for extra spaces/newlines in environment variables
 *    - Regenerate API key in Twilio Console if unsure
 *
 * 2. To verify credentials:
 *    - Go to Twilio Console > Account > API Keys & Tokens
 *    - Create a new Standard API Key
 *    - Copy the SID (SK...) → TWILIO_API_KEY_SID
 *    - Copy the Secret (shown once) → TWILIO_API_KEY_SECRET
 *
 * 3. To verify token:
 *    - Copy the token from the response
 *    - Paste into https://jwt.io
 *    - Enter your API key secret in the "Verify Signature" section
 *    - Should show "Signature Verified" in green
 */

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

    // Validate API key secret format (should be a long string, typically 32+ characters)
    if (apiKeySecret && apiKeySecret.length < 20) {
      console.warn("[Twilio Token] API key secret seems too short. Ensure you're using the SECRET, not the SID.");
    }

    // IMPORTANT: Verify that API Key SID and Secret belong to the same key pair
    // If you get JWT validation errors, check:
    // 1. TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET are from the SAME API key
    // 2. The secret is the full secret string (not truncated)
    // 3. No extra spaces or newlines in the secret
    console.log("[Twilio Token] Credential validation passed");

    // Use fixed identity "agent" for incoming calls to work
    const identity = "agent";
    console.log("[Twilio Token] Using identity:", identity);

    // Create JWT manually - ensure timestamps are correct
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600; // Token expires in 1 hour (max 24 hours)
    const iat = now; // Issued at time

    // Validate API key secret is not empty and doesn't have extra whitespace
    const trimmedSecret = apiKeySecret.trim();
    if (!trimmedSecret || trimmedSecret.length < 20) {
      throw new Error("TWILIO_API_KEY_SECRET appears to be invalid (too short or empty)");
    }

    // Create the grants object for Voice - MUST match Twilio's exact structure
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
    // Required: jti, iss, sub, exp
    // Recommended: iat, nbf
    const payload = {
      jti: `${apiKeySid}-${now}`,
      iss: apiKeySid, // API Key SID
      sub: accountSid, // Account SID
      exp: exp, // Expiration time
      iat: iat, // Issued at time
      nbf: now - 5, // Not before (allow 5 second clock skew)
      grants: grants,
    };

    // Log payload structure for debugging (without sensitive data)
    console.log("[Twilio Token] JWT Payload structure:", {
      jti: payload.jti,
      iss: `${apiKeySid.slice(0, 8)}...${apiKeySid.slice(-4)}`,
      sub: `${accountSid.slice(0, 8)}...${accountSid.slice(-4)}`,
      exp: exp,
      iat: iat,
      nbf: payload.nbf,
      identity: identity,
      application_sid: `${twimlAppSid.slice(0, 8)}...${twimlAppSid.slice(-4)}`,
      incoming_allow: true,
    });

    // Create CryptoKey from the API secret
    // IMPORTANT: Use the raw secret string, NOT base64 decoded
    // The secret should be used directly as UTF-8 bytes
    let key: CryptoKey;
    try {
      const secretBytes = new TextEncoder().encode(trimmedSecret);
      key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
      console.log("[Twilio Token] CryptoKey imported successfully");
    } catch (keyError) {
      console.error("[Twilio Token] Error importing key:", keyError);
      throw new Error(
        `Failed to import signing key: ${keyError instanceof Error ? keyError.message : "Unknown error"}`,
      );
    }

    // Generate the JWT
    let token: string;
    try {
      const tokenResult = await create({ alg: "HS256", typ: "JWT" }, payload, key);

      // Ensure token is a string
      if (typeof tokenResult !== "string") {
        throw new Error("JWT creation returned non-string value");
      }
      token = tokenResult;

      // Validate token format (should have 3 parts: header.payload.signature)
      const parts = token.split(".");
      if (parts.length !== 3) {
        throw new Error(`Invalid JWT format: expected 3 parts, got ${parts.length}`);
      }

      console.log("[Twilio Token] Token generated successfully");
      console.log("[Twilio Token] Token length:", token.length);
      console.log("[Twilio Token] Token parts:", {
        header: parts[0].slice(0, 20) + "...",
        payload: parts[1].slice(0, 20) + "...",
        signature: parts[2].slice(0, 20) + "...",
      });

      // Decode and verify payload structure
      try {
        const decodedPayload = JSON.parse(atob(parts[1]));
        console.log("[Twilio Token] Decoded payload verification:", {
          has_jti: !!decodedPayload.jti,
          has_iss: !!decodedPayload.iss,
          has_sub: !!decodedPayload.sub,
          has_exp: !!decodedPayload.exp,
          has_iat: !!decodedPayload.iat,
          has_grants: !!decodedPayload.grants,
          has_identity: !!decodedPayload.grants?.identity,
          has_voice: !!decodedPayload.grants?.voice,
          has_outgoing: !!decodedPayload.grants?.voice?.outgoing,
          has_application_sid: !!decodedPayload.grants?.voice?.outgoing?.application_sid,
          has_incoming: !!decodedPayload.grants?.voice?.incoming,
          incoming_allow: decodedPayload.grants?.voice?.incoming?.allow,
        });
      } catch (decodeError) {
        console.warn("[Twilio Token] Could not decode payload for verification:", decodeError);
      }
    } catch (jwtError) {
      console.error("[Twilio Token] Error creating JWT:", jwtError);
      throw new Error(`Failed to create JWT: ${jwtError instanceof Error ? jwtError.message : "Unknown error"}`);
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
