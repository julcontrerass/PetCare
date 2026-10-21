// Le manda un correo a un veterinario cuando el administrador aprueba o rechaza su alta.
//
// La app llama a esta función después de revisar la solicitud. Se comprueba que quien llama es un administrador
// activo y el estado, el motivo y el correo se leen de la base: el mensaje depende del estado real de la cuenta,
// no de lo que mande la app. Si el envío falla no pasa nada: la revisión ya está guardada y el veterinario ve el
// aviso dentro de la app.
//
// El correo sale por SMTP (por ejemplo una cuenta de Gmail con contraseña de aplicación). Secretos del proyecto:
//   SMTP_USER   dirección desde la que se envía (ej. tucuenta@gmail.com)
//   SMTP_PASS   contraseña de aplicación (no la contraseña de la cuenta)
//   SMTP_HOST   opcional, por defecto smtp.gmail.com
//   SMTP_PORT   opcional, por defecto 465
// Si faltan responde { ok: false, error: "sin_configurar" }.
//
// Se despliega con verify_jwt activado:  supabase functions deploy avisar-veterinario
import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const responder = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const escapar = (t: string) =>
  t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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
    .select("estado_revision, motivo_revision, profiles!inner(nombre, email)")
    .eq("profile_id", vetId)
    .maybeSingle();
  // deno-lint-ignore no-explicit-any
  const perfil: any = Array.isArray(vet?.profiles) ? vet?.profiles[0] : vet?.profiles;
  if (!vet || !perfil?.email) return responder(404, { ok: false, error: "no_encontrado" });

  const aprobado = vet.estado_revision === "activo";
  if (!aprobado && vet.estado_revision !== "rechazado") {
    return responder(200, { ok: false, error: "estado", mensaje: "No hay nada para avisar" });
  }

  const usuario = Deno.env.get("SMTP_USER");
  const clave = Deno.env.get("SMTP_PASS");
  if (!usuario || !clave) return responder(200, { ok: false, error: "sin_configurar" });

  const nombre = String(perfil.nombre ?? "").trim().split(" ")[0] || "";
  const motivo = String(vet.motivo_revision ?? "").trim();
  const asunto = aprobado ? "Tu alta en PetCare fue aprobada" : "Tu solicitud de alta en PetCare";
  const lineas = aprobado
    ? [`Hola ${nombre},`, "Verificamos tu matrícula y tu alta como veterinario/a en PetCare fue aprobada.", "Ya podés ingresar a la app con tu cuenta."]
    : [
      `Hola ${nombre},`,
      "Tu solicitud de alta como veterinario/a en PetCare no fue aprobada." + (motivo ? ` Motivo: ${motivo}.` : ""),
      "Podés corregir tus datos y volver a solicitarla.",
    ];

  try {
    const smtp = new SMTPClient({
      connection: {
        hostname: Deno.env.get("SMTP_HOST") ?? "smtp.gmail.com",
        port: Number(Deno.env.get("SMTP_PORT") ?? "465"),
        tls: true,
        auth: { username: usuario, password: clave },
      },
    });
    await smtp.send({
      from: `PetCare <${usuario}>`,
      to: perfil.email,
      subject: asunto,
      content: lineas.join("\n\n") + "\n\nEl equipo de PetCare",
      html: lineas.map((l) => `<p>${escapar(l)}</p>`).join("") + "<p>El equipo de PetCare</p>",
    });
    await smtp.close();
  } catch (e) {
    console.error("correo", e instanceof Error ? e.message : e);
    return responder(200, { ok: false, error: "envio" });
  }
  return responder(200, { ok: true });
});
