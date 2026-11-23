import type { SedeVet } from "../../model/modelos";
import type { JsonObject } from "./dtos";

/** Los lugares extra como los espera el servidor (`sedes` del registro y `p_sedes` del pedido de alta). */
export function datosDeSedes(sedes: SedeVet[]): JsonObject[] {
  return sedes.map((s) => ({
    nombre: s.nombre,
    direccion: s.direccion,
    dias_atencion: [...s.dias].sort((a, b) => a - b),
    hora_apertura: s.apertura,
    hora_cierre: s.cierre,
  }));
}
