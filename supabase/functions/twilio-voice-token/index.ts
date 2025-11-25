import { create } from "https://deno.land/x/djwt@v2.9/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get Twilio environment variables
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const apiKeySid = Deno.env.get('TWILIO_API_KEY_SID');
    const apiKeySecret = Deno.env.get('TWILIO_API_KEY_SECRET');
    const twimlAppSid = Deno.env.get('TWILIO_TWIML_APP_SID');

    console.log('=== Twilio Token Generation ===');
    console.log('TWILIO_ACCOUNT_SID:', accountSid ? 'SET' : 'MISSING');
    console.log('TWILIO_API_KEY_SID:', apiKeySid ? 'SET' : 'MISSING');
    console.log('TWILIO_API_KEY_SECRET:', apiKeySecret ? 'SET' : 'MISSING');
    console.log('TWILIO_TWIML_APP_SID:', twimlAppSid ? 'SET' : 'MISSING');

    if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
      console.error('Missing Twilio environment variables');
      return new Response(
        JSON.stringify({ error: 'Missing Twilio environment variables' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Create JWT header
    const header = {
      alg: "HS256" as const,
      typ: "JWT",
    };

    // Create JWT payload with Twilio grants
    const payload = {
      jti: `${apiKeySid}-${now}`,
      iss: apiKeySid,        // SK...
      sub: accountSid,       // AC...
      iat: now,
      nbf: now,
      exp: now + 60 * 60,    // 1 hour
      grants: {
        identity: "agent-" + crypto.randomUUID(),
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

    console.log('Generating JWT token with identity:', payload.grants.identity);

    // Convert secret to CryptoKey for djwt
    const encoder = new TextEncoder();
    const keyData = encoder.encode(apiKeySecret);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    // Create JWT using djwt
    const token = await create(header, payload, cryptoKey);

    console.log('✅ Token generated successfully');
    console.log('Token length:', token.length);
    console.log('Token (first 40 chars):', token.slice(0, 40), '...');

    return new Response(
      JSON.stringify({ token }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Error generating token:');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');

    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Unknown error',
        type: error?.constructor?.name || 'UnknownError',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
