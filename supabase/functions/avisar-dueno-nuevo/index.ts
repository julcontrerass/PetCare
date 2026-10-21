// Le manda por WhatsApp a un dueño recién creado por su veterinario el correo y la contraseña temporal para entrar.
//
// La app llama a esta función justo después de crear la cuenta (crear-cuenta-dueno). Se comprueba que quien llama
// es el veterinario que creó esa cuenta y que el dueño todavía no cambió la contraseña temporal; el correo y el
// teléfono se leen de la base. Si WhatsApp no está configurado responde { ok: false, error: "sin_configurar" } y
// la app sigue como si nada (el veterinario igual ve la contraseña en pantalla).
//
// Secretos: los de ../_shared/whatsapp.ts y, opcionalmente, WHATSAPP_PLANTILLA_DUENO (plantilla con 3 variables:
// nombre, correo y contraseña).
//
// Se despliega con verify_jwt activado:  supabase functions deploy avisar-dueno-nuevo
import { createClient } from "npm:@supabase/supabase-js@2";
import { configurado, enviar, normalizar } from "../_shared/whatsapp.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const responder = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return responder(405, { ok: false, error: "metodo" });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  const { data: sesion } = await admin.auth.getUser(token);
  if (!sesion?.user) return responder(401, { ok: false, error: "sin_sesion" });
  const vetId = sesion.user.id;

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return responder(400, { ok: false, error: "datos" });
  }
  const duenoId = typeof cuerpo.usuario_id === "string" ? cuerpo.usuario_id : "";
  const password = typeof cuerpo.password_temporal === "string" ? cuerpo.password_temporal : "";
  if (!duenoId || !password) return responder(400, { ok: false, error: "datos" });

  const { data: dueno } = await admin
    .from("profiles")
    .select("nombre, email, telefono, creada_por_veterinario, debe_cambiar_password")
    .eq("id", duenoId)
    .maybeSingle();
  if (!dueno || dueno.creada_por_veterinario !== vetId || !dueno.debe_cambiar_password) {
    return responder(403, { ok: false, error: "no_autorizado" });
  }

  if (!configurado()) return responder(200, { ok: false, error: "sin_configurar" });
  const destino = normalizar(String(dueno.telefono ?? ""));
  if (!destino) return responder(200, { ok: false, error: "sin_telefono" });

  const nombre = String(dueno.nombre ?? "").split(" ")[0] || "";
  const texto = `¡Hola ${nombre}! Tu veterinario/a te creó una cuenta en PetCare para que puedas ver la ficha de tu mascota.\n` +
    `Ingresá con:\nCorreo: ${dueno.email}\nContraseña temporal: ${password}\n` +
    `La app te va a pedir elegir tu propia contraseña la primera vez.`;

  const enviado = await enviar(destino, texto, Deno.env.get("WHATSAPP_PLANTILLA_DUENO"), [nombre || "hola", dueno.email, password]);
  return responder(200, enviado ? { ok: true } : { ok: false, error: "envio" });
});
