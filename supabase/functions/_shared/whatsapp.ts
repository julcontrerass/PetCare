// Envío de mensajes por la API de WhatsApp Cloud (Meta), común a las funciones que avisan por WhatsApp.
//
// Secretos del proyecto:
//   WHATSAPP_TOKEN      token de acceso permanente de la app de Meta
//   WHATSAPP_PHONE_ID   id del número emisor
//   WHATSAPP_PAIS       prefijo por defecto para números sin código de país (por defecto 54, Argentina)
// Cada mensaje puede usar una plantilla aprobada por Meta (su nombre va en un secreto aparte); sin plantilla se envía
// texto libre, que WhatsApp solo entrega dentro de las 24 h de una conversación.

export const configurado = () => !!Deno.env.get("WHATSAPP_TOKEN") && !!Deno.env.get("WHATSAPP_PHONE_ID");

/** Deja el número en formato internacional sin "+" (WhatsApp para Argentina pide 549 + área + número). */
export function normalizar(telefono: string, pais: string = Deno.env.get("WHATSAPP_PAIS") ?? "54"): string | null {
  let n = telefono.replace(/\D/g, "").replace(/^00/, "");
  if (n.length < 8) return null;
  if (n.startsWith(pais)) {
    n = n.slice(pais.length);
  }
  n = n.replace(/^0+/, "");
  if (pais === "54") {
    n = n.replace(/^9/, "").replace(/^(\d{2,4})15(\d{6,8})$/, "$1$2");
    return "549" + n;
  }
  return pais + n;
}

/** Envía el mensaje; con [plantilla] usa esa plantilla con [parametros] en el cuerpo. Devuelve si WhatsApp lo aceptó. */
export async function enviar(destino: string, texto: string, plantilla?: string, parametros: string[] = []): Promise<boolean> {
  const mensaje = plantilla
    ? {
      messaging_product: "whatsapp",
      to: destino,
      type: "template",
      template: {
        name: plantilla,
        language: { code: "es_AR" },
        components: [{ type: "body", parameters: parametros.map((text) => ({ type: "text", text })) }],
      },
    }
    : { messaging_product: "whatsapp", to: destino, type: "text", text: { body: texto } };
  const r = await fetch(`https://graph.facebook.com/v21.0/${Deno.env.get("WHATSAPP_PHONE_ID")}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("WHATSAPP_TOKEN")}`, "Content-Type": "application/json" },
    body: JSON.stringify(mensaje),
  });
  if (!r.ok) console.error("whatsapp", r.status, await r.text());
  return r.ok;
}
