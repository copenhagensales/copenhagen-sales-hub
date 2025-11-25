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

    console.log('=== Environment Variables Check ===');
    console.log('TWILIO_ACCOUNT_SID:', TWILIO_ACCOUNT_SID ? 'SET' : 'MISSING');
    console.log('TWILIO_API_KEY_SID:', TWILIO_API_KEY_SID ? 'SET' : 'MISSING');
    console.log('TWILIO_API_KEY_SECRET:', TWILIO_API_KEY_SECRET ? 'SET (length: ' + (TWILIO_API_KEY_SECRET?.length || 0) + ')' : 'MISSING');
    console.log('TWILIO_TWIML_APP_SID:', TWILIO_TWIML_APP_SID ? 'SET' : 'MISSING');

    const missingVars = [];
    if (!TWILIO_ACCOUNT_SID) missingVars.push('TWILIO_ACCOUNT_SID');
    if (!TWILIO_API_KEY_SID) missingVars.push('TWILIO_API_KEY_SID');
    if (!TWILIO_API_KEY_SECRET) missingVars.push('TWILIO_API_KEY_SECRET');
    if (!TWILIO_TWIML_APP_SID) missingVars.push('TWILIO_TWIML_APP_SID');

    if (missingVars.length > 0) {
      const errorMsg = `Missing environment variables: ${missingVars.join(', ')}`;
      console.error(errorMsg);
      return new Response(
        JSON.stringify({ 
          error: errorMsg,
          missingVariables: missingVars,
          details: 'Please configure all required Twilio environment variables'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get user identity from request
    const { identity } = await req.json();
    if (!identity) {
      throw new Error('Identity is required');
    }

    console.log('Generating access token for identity:', identity);
    console.log('Using API Key SID:', TWILIO_API_KEY_SID);
    console.log('Using Account SID:', TWILIO_ACCOUNT_SID);
    console.log('Using TwiML App SID:', TWILIO_TWIML_APP_SID);

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

    console.log('JWT Payload:', JSON.stringify(payload, null, 2));

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

    console.log('Generated token (first 50 chars):', token.substring(0, 50));
    console.log('Access token generated successfully');

    return new Response(
      JSON.stringify({ token }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('=== ERROR generating access token ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = {
      error: errorMessage,
      type: error?.constructor?.name || 'UnknownError',
      timestamp: new Date().toISOString()
    };

    return new Response(
      JSON.stringify(errorDetails),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
