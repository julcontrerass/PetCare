// Manda por correo los avisos de la cola (public.correos_cola): cuenta aprobada, rechazada, suspendida, reactivada o en revision.
// No recibe datos: solo vacia la cola, asi que llamarla de mas no hace nada raro.
// Configuracion (Edge Functions > Secrets):
//   RESEND_API_KEY  clave de Resend (opcion 1), con MAIL_FROM = "PetCare <aviso@tu-dominio>" si ya verificaste un dominio
//   SMTP_USER y SMTP_PASS  usuario y clave de aplicacion de Gmail (opcion 2); manda desde esa misma casilla
import { createClient } from "npm:@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const SMTP_USER = Deno.env.get("SMTP_USER") ?? "";
const SMTP_PASS = Deno.env.get("SMTP_PASS") ?? "";
const MAIL_FROM = Deno.env.get("MAIL_FROM") ??
  (RESEND_API_KEY ? "PetCare <onboarding@resend.dev>" : SMTP_USER ? `PetCare <${SMTP_USER}>` : "");

type Fila = {
  id: string;
  destinatario: string;
  tipo: "aprobada" | "rechazada" | "suspendida" | "reactivada" | "revision";
  nombre: string | null;
  motivo: string | null;
  como_rol: boolean;
};

function escapar(t: string) {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function plantilla(f: Fila) {
  const nombre = f.nombre?.trim() || "";
  const saludo = nombre ? `Hola ${nombre},` : "Hola,";
  const que = f.como_rol ? "tu alta como veterinario/a" : "tu cuenta de veterinario/a";
  const motivo = f.motivo ? `Motivo: ${f.motivo}.` : "";
  let asunto = "";
  let cuerpo = "";
  switch (f.tipo) {
    case "aprobada":
      asunto = "PetCare: tu cuenta fue aprobada";
      cuerpo = `Verificamos tu matrícula y ${que} ya está activa. Ya podés ingresar a PetCare${
        f.como_rol ? " y elegir el modo veterinario" : ""
      }.`;
      break;
    case "rechazada":
      asunto = "PetCare: no pudimos aprobar tu solicitud";
      cuerpo = `El administrador rechazó ${que}. ${motivo} Si creés que es un error, podés volver a presentar la solicitud con tus datos y la foto de tu carnet.`;
      break;
    case "suspendida":
      asunto = "PetCare: tu cuenta fue suspendida";
      cuerpo = `El administrador suspendió ${que}. ${motivo} Mientras tanto no vas a poder atender desde la app.`;
      break;
    case "reactivada":
      asunto = "PetCare: tu cuenta fue reactivada";
      cuerpo = `El administrador reactivó ${que}. Ya podés volver a usar PetCare.`;
      break;
    case "revision":
      asunto = "PetCare: tu cuenta está en revisión";
      cuerpo = `${que[0].toUpperCase()}${que.slice(1)} quedó en revisión. ${motivo} El administrador va a verificar tu matrícula y te vamos a avisar el resultado.`;
      break;
  }
  cuerpo = cuerpo.replace(/\s+/g, " ").trim();
  const texto = `${saludo}\n\n${cuerpo}\n\nEquipo PetCare`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0B2A4A">` +
    `<h2 style="color:#02797A;margin:0 0 16px">PetCare</h2>` +
    `<p style="font-size:16px">${escapar(saludo)}</p>` +
    `<p style="font-size:16px;line-height:1.5">${escapar(cuerpo)}</p>` +
    `<p style="font-size:14px;color:#55657A;margin-top:24px">Equipo PetCare</p></div>`;
  return { asunto, texto, html };
}

async function enviar(f: Fila) {
  const { asunto, texto, html } = plantilla(f);
  if (RESEND_API_KEY) {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: MAIL_FROM, to: [f.destinatario], subject: asunto, html, text: texto }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return;
  }
  const cliente = new SMTPClient({
    connection: { hostname: "smtp.gmail.com", port: 465, tls: true, auth: { username: SMTP_USER, password: SMTP_PASS } },
  });
  try {
    await cliente.send({ from: MAIL_FROM, to: f.destinatario, subject: asunto, content: texto, html });
  } finally {
    await cliente.close();
  }
}

Deno.serve(async () => {
  const configurado = RESEND_API_KEY ? "resend" : SMTP_USER && SMTP_PASS ? "smtp" : "ninguno";
  const cabeceras = { "Content-Type": "application/json" };
  if (configurado === "ninguno") {
    // Sin clave no se toca la cola: los correos esperan a que se configure el envio
    const { count } = await db.from("correos_cola").select("id", { count: "exact", head: true }).is("enviado_at", null);
    return new Response(JSON.stringify({ configurado, pendientes: count ?? 0, enviados: 0 }), { headers: cabeceras });
  }
  const { data, error } = await db.rpc("reclamar_correos", { p_max: 20 });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: cabeceras });
  let enviados = 0;
  let fallidos = 0;
  for (const f of (data ?? []) as Fila[]) {
    try {
      await enviar(f);
      await db.from("correos_cola").update({ enviado_at: new Date().toISOString(), error: null }).eq("id", f.id);
      enviados++;
    } catch (e) {
      fallidos++;
      await db.from("correos_cola").update({ error: String(e instanceof Error ? e.message : e).slice(0, 500) }).eq("id", f.id);
    }
  }
  return new Response(JSON.stringify({ configurado, enviados, fallidos }), { headers: cabeceras });
});
