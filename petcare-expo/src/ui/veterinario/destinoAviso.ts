/*
 * A dónde lleva tocar una notificación del veterinario (ver src/ui/dueno/destinoAviso.ts: las notificaciones no guardan
 * el turno ni el paciente, el destino sale del tipo y del título).
 */
import type { TipoNotificacion } from "../../model/modelos";
import { NavVet } from "./navegacionVet";

export type DestinoAvisoVet = "agenda" | "solicitudes" | "pacientes" | "perfil";

export function destinoAvisoVet(aviso: { tipo: TipoNotificacion; titulo: string }): DestinoAvisoVet {
  switch (aviso.tipo) {
    case "TURNO":
    case "CANCELACION":
    case "COMPLETADO":
      return "agenda";
    case "ACCESO":
      // "Nueva solicitud" (un dueño le compartió una mascota) se responde en Solicitudes; los cambios de acceso, en Pacientes
      return aviso.titulo.toLowerCase().includes("solicitud") ? "solicitudes" : "pacientes";
    case "CUENTA":
      return "perfil";
    case "MASCOTA":
      return "pacientes";
  }
}

export function irADestinoVet(d: DestinoAvisoVet): void {
  switch (d) {
    case "agenda": NavVet.irAAgenda(); break;
    case "solicitudes": NavVet.solicitudes(); break;
    case "pacientes": NavVet.irAPacientes(); break;
    case "perfil": NavVet.irAPerfil(); break;
  }
}
