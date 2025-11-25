import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import twilio from "npm:twilio@4.19.0";

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

    // Use Twilio's official library to generate the token
    const AccessToken = twilio.jwt.AccessToken;
    const VoiceGrant = AccessToken.VoiceGrant;

    // Create Voice Grant
    const voiceGrant = new VoiceGrant({
      outgoingApplicationSid: TWILIO_TWIML_APP_SID,
      incomingAllow: true,
    });

    // Create Access Token
    const token = new AccessToken(
      TWILIO_ACCOUNT_SID,
      TWILIO_API_KEY_SID,
      TWILIO_API_KEY_SECRET,
      { identity: identity }
    );

    token.addGrant(voiceGrant);

    // Generate JWT
    const jwt = token.toJwt();

    console.log('Access token generated successfully');
    console.log('Token length:', jwt.length);
    console.log('Token first 50 chars:', jwt.substring(0, 50));

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
