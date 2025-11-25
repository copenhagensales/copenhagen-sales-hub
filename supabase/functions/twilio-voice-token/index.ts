import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
      return new Response(
        JSON.stringify({ error: 'Identity is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Generating access token for identity:', identity);

    // Create JWT token manually with exact Twilio format
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600; // 1 hour

    // JWT Header
    const header = {
      cty: 'twilio-fpa;v=1',
      typ: 'JWT',
      alg: 'HS256'
    };

    // JWT Payload with exact Twilio structure
    const payload = {
      jti: `${TWILIO_API_KEY_SID!}-${now}`,
      iss: TWILIO_API_KEY_SID!,
      sub: TWILIO_ACCOUNT_SID!,
      exp: exp,
      grants: {
        identity: identity,
        voice: {
          incoming: {
            allow: true
          },
          outgoing: {
            application_sid: TWILIO_TWIML_APP_SID!
          }
        }
      }
    };

    // Encode header and payload
    const encoder = new TextEncoder();
    const headerB64 = encodeBase64Url(encoder.encode(JSON.stringify(header)));
    const payloadB64 = encodeBase64Url(encoder.encode(JSON.stringify(payload)));
    const signatureInput = `${headerB64}.${payloadB64}`;

    // Create HMAC signature
    const keyData = encoder.encode(TWILIO_API_KEY_SECRET!);
    const key = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureData = encoder.encode(signatureInput);
    const signature = await crypto.subtle.sign('HMAC', key, signatureData);
    const signatureB64 = encodeBase64Url(new Uint8Array(signature));

    const jwt = `${signatureInput}.${signatureB64}`;

    console.log('Access token generated successfully');
    console.log('Token length:', jwt.length);
    console.log('Token first 50 chars:', jwt.substring(0, 50));
    
    // Decode token to verify structure (for debugging)
    try {
      const parts = jwt.split('.');
      if (parts.length === 3) {
        const decodedHeader = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));
        const decodedPayload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0))));
        console.log('🔍 JWT Header:', JSON.stringify(decodedHeader));
        console.log('🔍 JWT Payload iss (should start with SK):', decodedPayload.iss);
        console.log('🔍 JWT Payload sub (should start with AC):', decodedPayload.sub);
        console.log('🔍 JWT Payload grants:', JSON.stringify(decodedPayload.grants));
        console.log('🔍 JWT Payload exp:', decodedPayload.exp, '(expires in', Math.floor((decodedPayload.exp * 1000 - Date.now()) / 1000 / 60), 'minutes)');
      }
    } catch (e) {
      console.error('❌ Error decoding token for debug:', e);
    }

    return new Response(
      JSON.stringify({ token: jwt }),
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
