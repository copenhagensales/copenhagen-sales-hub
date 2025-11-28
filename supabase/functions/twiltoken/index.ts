import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { create, getNumericDate } from "https://deno.land/x/djwt@v2.9/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "OPTIONS, POST",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // 1. Manejo de CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    // 2. Detectar quién nos llama: ¿Es Twilio pidiendo instrucciones (XML)?
    // Twilio siempre envía "application/x-www-form-urlencoded"
    const contentType = req.headers.get("content-type") || "";
    
    if (contentType.includes("application/x-www-form-urlencoded")) {
      return await handleTwilioVoiceRequest(req);
    }

    // 3. Si no es Twilio, asumimos que es tu Frontend pidiendo un TOKEN (JSON)
    return await handleTokenRequest(req);

  } catch (error) {
    console.error("Error general:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// --- LÓGICA PARA GENERAR EL TOKEN (Para tu Frontend) ---
async function handleTokenRequest(req: Request) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
  const apiKeySid = Deno.env.get("TWILIO_API_KEY_SID");
  const apiKeySecret = Deno.env.get("TWILIO_API_KEY_SECRET");
  const twimlAppSid = Deno.env.get("TWILIO_TWIML_APP_SID");

  if (!accountSid || !apiKeySid || !apiKeySecret || !twimlAppSid) {
    throw new Error("Faltan credenciales de Twilio en .env");
  }

  // Identidad del usuario (agent)
  let identity = "agent";
  try {
    const body = await req.json();
    if (body?.identity) identity = body.identity;
  } catch (e) { /* Body vacío, usamos default */ }

  const payload = {
    jti: apiKeySid + "-" + Date.now(),
    iss: apiKeySid,
    sub: accountSid,
    exp: getNumericDate(60 * 60),
    grants: {
      identity: identity,
      voice: {
        incoming: { allow: true },
        outgoing: { application_sid: twimlAppSid }
      }
    }
  };

  const header = { alg: "HS256" as const, typ: "JWT", cty: "twilio-fpa;v=1" };
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(apiKeySecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const token = await create(header, payload, key);

  return new Response(JSON.stringify({ token }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// --- LÓGICA PARA CONECTAR LA LLAMADA (Para Twilio) ---
async function handleTwilioVoiceRequest(req: Request) {
  // Twilio nos envía datos del formulario (To, From, etc.)
  const formData = await req.formData();
  const to = formData.get("To");
  
  // OBTENER EL NÚMERO DE ORIGEN VERIFICADO
  const callerId = Deno.env.get("TWILIO_CALLER_NUMBER");

  if (!to) {
    return new Response("<Response><Say>Error: No number provided</Say></Response>", {
      headers: { "Content-Type": "text/xml" }
    });
  }

  if (!callerId) {
    console.error("ERROR: Falta TWILIO_CALLER_NUMBER en Supabase");
    return new Response("<Response><Say>Configuration Error: Missing Caller ID</Say></Response>", {
      headers: { "Content-Type": "text/xml" }
    });
  }

  console.log(`Twilio pide conectar llamada a: ${to} desde: ${callerId}`);

  // Generamos el XML (TwiML) que Twilio necesita
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
      ...corsHeaders 
    },
  });
}
