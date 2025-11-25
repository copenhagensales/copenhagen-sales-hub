import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { create } from "https://deno.land/x/djwt@v2.8/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get Twilio credentials from environment
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const apiKeySid = Deno.env.get('TWILIO_API_KEY_SID');
    const apiKeySecret = Deno.env.get('TWILIO_API_KEY_SECRET');
    const twimlAppSid = Deno.env.get('TWILIO_TWIML_APP_SID');

    console.log('[Twilio Token] Environment check:', {
      accountSid: accountSid ? `${accountSid.slice(0, 8)}...` : 'MISSING',
      apiKeySid: apiKeySid ? `${apiKeySid.slice(0, 8)}...` : 'MISSING',
      apiKeySecret: apiKeySecret ? 'SET' : 'MISSING',
      twimlAppSid: twimlAppSid ? `${twimlAppSid.slice(0, 8)}...` : 'MISSING',
    });

    // Validate all required credentials are present
    if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
      throw new Error('Missing required Twilio credentials');
    }

    // Validate credential formats
    if (!accountSid.startsWith('AC')) {
      throw new Error('Invalid TWILIO_ACCOUNT_SID format (must start with AC)');
    }
    if (!apiKeySid.startsWith('SK')) {
      throw new Error('Invalid TWILIO_API_KEY_SID format (must start with SK)');
    }
    if (!twimlAppSid.startsWith('AP')) {
      throw new Error('Invalid TWILIO_TWIML_APP_SID format (must start with AP)');
    }

    // Generate identity for this agent session
    const identity = `agent-${Date.now()}`;
    console.log('[Twilio Token] Generated identity:', identity);

    // Create JWT payload for Twilio Voice
    const now = Math.floor(Date.now() / 1000);
    const exp = now + 3600; // Token valid for 1 hour

    const payload = {
      jti: `${apiKeySid}-${now}`,
      iss: apiKeySid,
      sub: accountSid,
      exp: exp,
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

    console.log('[Twilio Token] JWT payload:', {
      ...payload,
      grants: {
        identity: payload.grants.identity,
        voice: 'configured',
      },
    });

    // Create JWT token using API Key Secret
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(apiKeySecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const token = await create({ alg: 'HS256', typ: 'JWT' }, payload, key);

    console.log('[Twilio Token] Token generated successfully, length:', token.length);
    console.log('[Twilio Token] Token preview:', `${token.slice(0, 50)}...`);

    return new Response(
      JSON.stringify({ token }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('[Twilio Token] Error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
