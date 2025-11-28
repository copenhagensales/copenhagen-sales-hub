import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// Usamos djwt que es nativa para Deno, en lugar de la librería pesada de Twilio
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.9/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // 1. Manejo de CORS (Preflight)
  // Es importante devolver 204 No Content, no null con 200
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // 2. Solo permitir POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // 3. Obtener credenciales
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const apiKeySid = Deno.env.get("TWILIO_API_KEY_SID");
    const apiKeySecret = Deno.env.get("TWILIO_API_KEY_SECRET");
    const twimlAppSid = Deno.env.get("TWILIO_TWIML_APP_SID");

    // Validar existencia
    if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
      throw new Error("Faltan credenciales de Twilio en .env");
    }

    // 4. Determinar identidad
    // Intentamos leer del body, si falla usamos 'agent'
    let identity = "agent";
    try {
      const body = await req.json();
      if (body?.identity) identity = body.identity;
    } catch (e) {
      // Body vacío o inválido, continuamos con default
    }

    console.log(`[Twilio] Generando token para identidad: ${identity}`);

    // 5. CONSTRUCCIÓN MANUAL DEL TOKEN
    // Esto reemplaza a la librería 'twilio' y elimina el error de 'Object prototype'

    const payload = {
      jti: apiKeySid + "-" + Date.now(),
      iss: apiKeySid,
      sub: accountSid,
      exp: getNumericDate(60 * 60), // 1 hora de validez
      grants: {
        identity: identity,
        voice: {
          incoming: { allow: true },
          outgoing: { application_sid: twimlAppSid },
        },
      },
    };

    const header = {
      alg: "HS256",
      typ: "JWT",
      cty: "twilio-fpa;v=1",
    };

    // Importar la clave secreta usando Web Crypto API (Nativo del navegador/Deno)
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(apiKeySecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    // Firmar el token
    const token = await create(header, payload, key);

    console.log("[Twilio] Token generado correctamente");

    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[Twilio] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Error desconocido",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
