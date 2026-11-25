/*
 * A dónde lleva tocar una notificación del dueño. Las notificaciones guardan tipo, título y mensaje (no el turno ni la
 * mascota), así que el destino sale del tipo y de la mascota que se nombra en el texto: los avisos de la base empiezan
 * con "Luna: ..." o la mencionan ("Luna volvió a estar activa").
 */
import type { Mascota, TipoNotificacion } from "../../model/modelos";
import { NavDueno } from "./navegacionDueno";

export type DestinoAvisoDueno =
  | { a: "mascota"; mascota: Mascota }
  | { a: "calendario" }
  | { a: "recordatorios" }
  | { a: "solicitudes" }
  | { a: "veterinarios" }
  | { a: "inicio" }
  | { a: "mascotas" }
  | { a: "perfil" };

const sinTildes = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** La mascota nombrada en el aviso (la de nombre más largo si hay varias que coinciden), o null. */
export function mascotaDelAviso(mensaje: string, mascotas: Mascota[]): Mascota | null {
  const texto = ` ${sinTildes(mensaje)} `;
  let elegida: Mascota | null = null;
  for (const m of mascotas) {
    const nombre = sinTildes(m.nombre.trim());
    if (!nombre) continue;
    const escapado = nombre.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`[^\\p{L}\\p{N}]${escapado}[^\\p{L}\\p{N}]`, "u").test(texto)) {
      if (!elegida || m.nombre.length > elegida.nombre.length) elegida = m;
    }
  }
  return elegida;
}

export function destinoAvisoDueno(aviso: { tipo: TipoNotificacion; titulo: string; mensaje: string }, mascotas: Mascota[]): DestinoAvisoDueno {
  const titulo = sinTildes(aviso.titulo);
  const mascota = mascotaDelAviso(aviso.mensaje, mascotas);
  switch (aviso.tipo) {
    case "TURNO":
    case "CANCELACION":
      return { a: "calendario" };
    case "COMPLETADO":
      // El turno terminado queda en el historial de la mascota
      return mascota ? { a: "mascota", mascota } : { a: "recordatorios" };
    case "ACCESO":
      return titulo.includes("solicitud") ? { a: "solicitudes" } : { a: "veterinarios" };
    case "CUENTA":
      return { a: "perfil" };
    case "MASCOTA":
      if (titulo.includes("invitaron")) return { a: "inicio" }; // la invitación se acepta desde el Inicio
      if (titulo.includes("recordatorio")) return { a: "recordatorios" };
      return mascota ? { a: "mascota", mascota } : { a: "mascotas" };
  }
}

export function irADestinoDueno(d: DestinoAvisoDueno): void {
  switch (d.a) {
    case "mascota": NavDueno.irADetalleMascota(d.mascota); break;
    case "calendario": NavDueno.irACalendario(); break;
    case "recordatorios": NavDueno.irARecordatorios(); break;
    case "solicitudes": NavDueno.irASolicitudes(); break;
    case "veterinarios": NavDueno.irAVeterinarios(); break;
    case "inicio": NavDueno.irAHome(); break;
    case "mascotas": NavDueno.irAMascotas(); break;
    case "perfil": NavDueno.irAPerfil(); break;
  }
}
