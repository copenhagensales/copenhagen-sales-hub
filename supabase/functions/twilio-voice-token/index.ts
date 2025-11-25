import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { encodeBase64Url } from "https://deno.land/std@0.224.0/encoding/base64url.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_API_KEY_SID = Deno.env.get('TWILIO_API_KEY_SID');
    const TWILIO_API_KEY_SECRET = Deno.env.get('TWILIO_API_KEY_SECRET');
    const TWILIO_TWIML_APP_SID = Deno.env.get('TWILIO_TWIML_APP_SID');

    if (!TWILIO_ACCOUNT_SID || !TWILIO_API_KEY_SID || !TWILIO_API_KEY_SECRET || !TWILIO_TWIML_APP_SID) {
      throw new Error('Missing Twilio configuration');
    }

    // Get user identity from request
    const { identity } = await req.json();
    if (!identity) {
      throw new Error('Identity is required');
    }

    console.log('Generating access token for identity:', identity);

    // Create JWT token manually for Twilio Voice
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600; // 1 hour expiration

    const header = {
      cty: "twilio-fpa;v=1",
      typ: "JWT",
      alg: "HS256"
    };

    const payload = {
      jti: `${TWILIO_API_KEY_SID}-${now}`,
      iss: TWILIO_API_KEY_SID,
      sub: TWILIO_ACCOUNT_SID,
      exp: exp,
      grants: {
        identity: identity,
        voice: {
          incoming: {
            allow: true
          },
          outgoing: {
            application_sid: TWILIO_TWIML_APP_SID
          }
        }
      }
    };

    // Base64URL encode using Deno standard library
    const encoder = new TextEncoder();
    const encodedHeader = encodeBase64Url(encoder.encode(JSON.stringify(header)));
    const encodedPayload = encodeBase64Url(encoder.encode(JSON.stringify(payload)));
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    // Create HMAC signature
    const keyData = encoder.encode(TWILIO_API_KEY_SECRET);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureData = encoder.encode(signatureInput);
    const signature = await crypto.subtle.sign('HMAC', key, signatureData);
    const encodedSignature = encodeBase64Url(new Uint8Array(signature));

    const token = `${signatureInput}.${encodedSignature}`;

    console.log('Access token generated successfully');

    return new Response(
      JSON.stringify({ token }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error generating access token:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
