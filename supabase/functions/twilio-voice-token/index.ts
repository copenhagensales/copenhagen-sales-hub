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

    // Validate Twilio credentials format
    console.log('🔍 === Validating Twilio Credentials Format ===');
    const validationErrors: string[] = [];

    if (!accountSid.startsWith('AC')) {
      validationErrors.push('TWILIO_ACCOUNT_SID must start with "AC"');
      console.error('❌ TWILIO_ACCOUNT_SID does not start with AC:', accountSid.substring(0, 4));
    } else {
      console.log('✅ TWILIO_ACCOUNT_SID format valid (starts with AC)');
    }

    if (!apiKeySid.startsWith('SK')) {
      validationErrors.push('TWILIO_API_KEY_SID must start with "SK"');
      console.error('❌ TWILIO_API_KEY_SID does not start with SK:', apiKeySid.substring(0, 4));
    } else {
      console.log('✅ TWILIO_API_KEY_SID format valid (starts with SK)');
    }

    if (!twimlAppSid.startsWith('AP')) {
      validationErrors.push('TWILIO_TWIML_APP_SID must start with "AP"');
      console.error('❌ TWILIO_TWIML_APP_SID does not start with AP:', twimlAppSid.substring(0, 4));
    } else {
      console.log('✅ TWILIO_TWIML_APP_SID format valid (starts with AP)');
    }

    if (apiKeySecret.length !== 32) {
      validationErrors.push(`TWILIO_API_KEY_SECRET must be exactly 32 characters (currently ${apiKeySecret.length})`);
      console.error('❌ TWILIO_API_KEY_SECRET invalid length:', apiKeySecret.length, '(should be 32)');
    } else {
      console.log('✅ TWILIO_API_KEY_SECRET length valid (32 characters)');
    }

    // Check if all credentials are from same account
    // Account SID and API Key SID should share similar account pattern
    const accountPrefix = accountSid.substring(0, 10); // First 10 chars often indicate account
    console.log('Account prefix from ACCOUNT_SID:', accountPrefix);
    console.log('This should match across all credentials from the same Twilio account');

    if (validationErrors.length > 0) {
      console.error('❌ Credential validation failed:');
      validationErrors.forEach(err => console.error('  -', err));
      return new Response(
        JSON.stringify({ 
          error: 'Invalid Twilio credentials format',
          details: validationErrors
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ All Twilio credentials format validation passed');

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

    // Decode and verify token structure (for debugging)
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        console.error('❌ Token does not have 3 parts!', parts.length);
      } else {
        console.log('✅ Token has 3 parts (header.payload.signature)');
        
        // Decode header and payload (not signature)
        const decodedHeader = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
        const decodedPayload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        
        console.log('🔍 === Decoded JWT Header ===');
        console.log(JSON.stringify(decodedHeader, null, 2));
        
        console.log('🔍 === Decoded JWT Payload ===');
        console.log(JSON.stringify(decodedPayload, null, 2));
        
        // Verify critical fields
        console.log('🔍 === Verification ===');
        console.log('iss (should be SK...):', decodedPayload.iss, '- Matches API Key?', decodedPayload.iss === apiKeySid);
        console.log('sub (should be AC...):', decodedPayload.sub, '- Matches Account?', decodedPayload.sub === accountSid);
        console.log('grants.identity:', decodedPayload.grants?.identity);
        console.log('grants.voice.outgoing.application_sid:', decodedPayload.grants?.voice?.outgoing?.application_sid);
        console.log('grants.voice.incoming.allow:', decodedPayload.grants?.voice?.incoming?.allow);
        console.log('iat:', decodedPayload.iat, new Date(decodedPayload.iat * 1000).toISOString());
        console.log('exp:', decodedPayload.exp, new Date(decodedPayload.exp * 1000).toISOString());
        console.log('Token valid for (seconds):', decodedPayload.exp - decodedPayload.iat);
        console.log('Token expires in (minutes):', Math.floor((decodedPayload.exp * 1000 - Date.now()) / 1000 / 60));
        
        // Check if token is already expired
        if (decodedPayload.exp * 1000 < Date.now()) {
          console.error('❌ TOKEN IS ALREADY EXPIRED!');
        } else {
          console.log('✅ Token is not expired');
        }
        
        // Verify all environment variables are from same account
        console.log('🔍 === Environment Variable Validation ===');
        console.log('TWILIO_ACCOUNT_SID starts with AC?', accountSid?.startsWith('AC'));
        console.log('TWILIO_API_KEY_SID starts with SK?', apiKeySid?.startsWith('SK'));
        console.log('TWILIO_TWIML_APP_SID starts with AP?', twimlAppSid?.startsWith('AP'));
        console.log('TWILIO_API_KEY_SECRET length:', apiKeySecret?.length, '(should be 32)');
      }
    } catch (decodeError) {
      console.error('❌ Error decoding token for verification:', decodeError);
    }

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
