import { Fechas } from "../../util/fechas";
import { Servicios } from "../servicios";
import { PacientesRepo } from "./pacientesRepo";

export type EstadoSolicitud = "PENDIENTE" | "ACEPTADA" | "RECHAZADA";

export class SolicitudItem {
  readonly id: string;
  readonly solicitante: string;
  readonly mascota: string;
  readonly hace: string;
  readonly fotoPath: string | null;
  estado: EstadoSolicitud;
  /** La pidió el propio veterinario: espera la respuesta del dueño y no tiene botones para resolverla. */
  readonly enviada: boolean;

  constructor(
    id: string,
    solicitante: string,
    mascota: string,
    hace: string,
    opciones: { fotoPath?: string | null; estado?: EstadoSolicitud; enviada?: boolean } = {},
  ) {
    this.id = id;
    this.solicitante = solicitante;
    this.mascota = mascota;
    this.hace = hace;
    this.fotoPath = opciones.fotoPath ?? null;
    this.estado = opciones.estado ?? "PENDIENTE";
    this.enviada = opciones.enviada ?? false;
  }
}

/**
 * Solicitudes de acceso del veterinario en sesión: las que él le hizo a un dueño (con su estado) y las que un
 * dueño le compartió y todavía no respondió.
 */
class SolicitudesRepoImpl {
  readonly paraVeterinario: SolicitudItem[] = [];

  limpiar(): void {
    this.paraVeterinario.length = 0;
  }

  async cargar(): Promise<void> {
    const lista = (await Servicios.fuente.misSolicitudes()).map((s) => {
      const propia = s.iniciado_por === "veterinario";
      return new SolicitudItem(
        s.id,
        s.dueno_nombre ?? "Un dueño",
        propia ? `Pediste acceso a ${s.mascota_nombre}` : `Quiere compartir a ${s.mascota_nombre}`,
        Fechas.haceTexto(s.created_at),
        {
          fotoPath: s.dueno_foto_path ?? null,
          estado: s.estado === "activo" ? "ACEPTADA" : s.estado === "rechazado" || s.estado === "inactivo" ? "RECHAZADA" : "PENDIENTE",
          enviada: propia,
        },
      );
    });
    this.paraVeterinario.length = 0;
    this.paraVeterinario.push(...lista);
  }

  pendientesVeterinario(): number {
    return this.paraVeterinario.filter((s) => s.estado === "PENDIENTE").length;
  }

  /** El veterinario acepta o rechaza que un dueño le comparta una mascota. */
  resolver(item: SolicitudItem, aceptar: boolean): void {
    item.estado = aceptar ? "ACEPTADA" : "RECHAZADA";
    void Servicios.escribir(
      {
        alFallar: async () => {
          await this.cargar();
          await PacientesRepo.cargar();
          Servicios.avisarCambio();
        },
        alTerminar: async () => {
          await PacientesRepo.cargar();
          Servicios.avisarCambio();
        },
      },
      async () => {
        await Servicios.fuente.actualizarAcceso(item.id, aceptar ? "activo" : "rechazado");
      },
    );
  }
}

export const SolicitudesRepo = new SolicitudesRepoImpl();
