import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.9/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // 1. Preflight check
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // 2. Obtener credenciales
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const apiKeySid = Deno.env.get("TWILIO_API_KEY_SID");
    const apiKeySecret = Deno.env.get("TWILIO_API_KEY_SECRET");
    const twimlAppSid = Deno.env.get("TWILIO_TWIML_APP_SID");

    if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
      throw new Error("Faltan variables de entorno");
    }

    // 3. Generar Token MANUALMENTE (Esto evita el error de esm.sh/jws)
    const payload = {
      jti: apiKeySid + "-" + Date.now(),
      iss: apiKeySid,
      sub: accountSid,
      exp: getNumericDate(60 * 60),
      grants: {
        identity: "agent", // Identidad fija o dinámica según prefieras
        voice: {
          incoming: { allow: true },
          outgoing: { application_sid: twimlAppSid },
        },
      },
    };

    const header = { alg: "HS256", typ: "JWT", cty: "twilio-fpa;v=1" };

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(apiKeySecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const token = await create(header, payload, key);

    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
