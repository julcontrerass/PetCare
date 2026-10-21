// Avisa por WhatsApp a un veterinario que el administrador aprobó o rechazó su alta.
//
// La app llama a esta función después de revisar la solicitud. Acá se comprueba que quien llama es un
// administrador activo y se lee el estado y el teléfono desde la base: el mensaje depende del estado real de la
// cuenta, no de lo que mande la app.
//
// Usa la API de WhatsApp Cloud (Meta). Hacen falta estos secretos del proyecto:
//   WHATSAPP_TOKEN        token de acceso permanente de la app de Meta
//   WHATSAPP_PHONE_ID     id del número emisor
//   WHATSAPP_PLANTILLA_APROBADO / WHATSAPP_PLANTILLA_RECHAZADO   nombres de las plantillas aprobadas por Meta
//     (opcional; si faltan se envía texto libre, que WhatsApp solo entrega dentro de las 24 h de una conversación)
//
// Si no están configurados responde { ok: false, error: "sin_configurar" } y la app sigue como si nada: el aviso
// dentro de la app (private.notificar) se envía igual.
//
// Se despliega con verify_jwt activado:  supabase functions deploy avisar-whatsapp
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
  const { data: quien } = await admin.from("profiles").select("rol, estado").eq("id", sesion.user.id).maybeSingle();
  if (!quien || quien.rol !== "admin" || quien.estado !== "activo") {
    return responder(403, { ok: false, error: "no_autorizado" });
  }

  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = await req.json();
  } catch {
    return responder(400, { ok: false, error: "datos" });
  }
  const vetId = typeof cuerpo.veterinario_id === "string" ? cuerpo.veterinario_id : "";
  if (!vetId) return responder(400, { ok: false, error: "datos" });

  const { data: vet } = await admin
    .from("veterinarios")
    .select("estado_revision, motivo_revision, profiles!inner(nombre, telefono)")
    .eq("profile_id", vetId)
    .maybeSingle();
  // deno-lint-ignore no-explicit-any
  const perfil: any = Array.isArray(vet?.profiles) ? vet?.profiles[0] : vet?.profiles;
  if (!vet || !perfil) return responder(404, { ok: false, error: "no_encontrado" });

  const aprobado = vet.estado_revision === "activo";
  const rechazado = vet.estado_revision === "rechazado";
  if (!aprobado && !rechazado) return responder(200, { ok: false, error: "estado", mensaje: "No hay nada para avisar" });

  if (!configurado()) return responder(200, { ok: false, error: "sin_configurar" });

  const destino = normalizar(String(perfil.telefono ?? ""));
  if (!destino) return responder(200, { ok: false, error: "sin_telefono" });

  const nombre = String(perfil.nombre ?? "").split(" ")[0] || "";
  const motivo = String(vet.motivo_revision ?? "").trim();
  const texto = aprobado
    ? `¡Hola ${nombre}! Tu alta como veterinario/a en PetCare fue aprobada. Ya podés ingresar a la app.`
    : `Hola ${nombre}. Tu solicitud de alta como veterinario/a en PetCare no fue aprobada` +
      (motivo ? `. Motivo: ${motivo}` : "") + ". Podés corregir tus datos y volver a solicitarla.";

  const enviado = await enviar(
    destino,
    texto,
    Deno.env.get(aprobado ? "WHATSAPP_PLANTILLA_APROBADO" : "WHATSAPP_PLANTILLA_RECHAZADO"),
    aprobado ? [nombre || "colega"] : [nombre || "colega", motivo || "sin detalle"],
  );
  if (!enviado) return responder(200, { ok: false, error: "envio" });
  return responder(200, { ok: true });
});
