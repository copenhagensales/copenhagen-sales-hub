import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.9/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // 1. Manejo de CORS (Permitir acceso desde el navegador)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const contentType = req.headers.get("content-type") || "";

    // 2. DETECCIÓN: ¿Quién nos llama?
    // Twilio SIEMPRE envía "application/x-www-form-urlencoded"
    if (contentType.includes("application/x-www-form-urlencoded")) {
      console.log("📞 Petición recibida desde TWILIO (Generando XML)");
      return await handleTwilioVoiceRequest(req);
    }

    // Si no es Twilio, asumimos que es tu React App pidiendo un TOKEN
    console.log("💻 Petición recibida desde FRONTEND (Generando Token JSON)");
    return await handleTokenRequest(req);
  } catch (error) {
    console.error("❌ Error General:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// --- GENERAR XML (TwiML) PARA TWILIO ---
async function handleTwilioVoiceRequest(req: Request) {
  // Leemos los datos que envía Twilio
  const formData = await req.formData();
  const to = formData.get("To");

  const FALLBACK_CALLER_ID = "+4552512853";
  //Deno.env.get("TWILIO_CALLER_NUMBER") ||
  const callerId = Deno.env.get("TWILIO_CALLER_NUMBER") || FALLBACK_CALLER_ID;

  console.log(`Intentando conectar llamada hacia: ${to} desde: ${callerId}`);

  if (!to) {
    return new Response("<Response><Say>Error: No destination number found.</Say></Response>", {
      headers: { "Content-Type": "text/xml" },
    });
  }

  // Generamos el XML que Twilio necesita para conectar la llamada
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Dial callerId="${callerId}">
        <Number>${to}</Number>
      </Dial>
    </Response>`;

  return new Response(twiml, {
    status: 200,
    headers: {
      "Content-Type": "text/xml",
      ...corsHeaders,
    },
  });
}

// --- GENERAR TOKEN JWT PARA REACT ---
async function handleTokenRequest(req: Request) {
  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const apiKeySid = Deno.env.get("TWILIO_API_KEY_SID");
  const apiKeySecret = Deno.env.get("TWILIO_API_KEY_SECRET");
  const twimlAppSid = Deno.env.get("TWILIO_TWIML_APP_SID");

  if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
    throw new Error("Faltan credenciales de Twilio en Supabase Secrets");
  }

  // IMPORTANT: Always use "agent" identity for incoming calls to work
  // The incoming-call edge function routes calls to <Client>agent</Client>
  // so this device must be registered with the same identity
  const identity = "agent";
  
  console.log(`Generating token for identity: ${identity}`);

  // Crear el payload del token
  const payload = {
    jti: apiKeySid + "-" + Date.now(),
    iss: apiKeySid,
    sub: accountSid,
    exp: getNumericDate(60 * 60 * 24), // Validez de 24 horas
    grants: {
      identity: identity,
      voice: {
        incoming: { allow: true },
        outgoing: { application_sid: twimlAppSid },
      },
    },
  };

  const header = { alg: "HS256" as const, typ: "JWT", cty: "twilio-fpa;v=1" };

  // Firmar el token
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiKeySecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const token = await create(header, payload, key);

  return new Response(JSON.stringify({ token, identity }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
