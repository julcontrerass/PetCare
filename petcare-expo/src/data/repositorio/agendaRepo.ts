import { LocalDate } from "../../util/tiempo";
import { nuevoId } from "../../util/uuid";
import type { NuevoTurnoDto, TurnoDto } from "../remoto/dtos";
import { Servicios } from "../servicios";
import { Sesion } from "../sesion";
import { PerfilVetRepo } from "./perfilVetRepo";

export type EstadoEvento = "PENDIENTE" | "COMPLETADO" | "CANCELADO";
export const EstadosEvento: Record<EstadoEvento, { etiqueta: string }> = {
  PENDIENTE: { etiqueta: "Pendiente" },
  COMPLETADO: { etiqueta: "Completado" },
  CANCELADO: { etiqueta: "Cancelado" },
};

export interface EventoVet {
  readonly id: string;
  pacienteId: string;
  tipo: string;
  motivo: string;
  fecha: LocalDate;
  hora: string;
  estado: EstadoEvento;
  notas: string;
  veterinario: string;
  veterinarioId: string | null;
  /** Minutos que dura el turno; lo fija el servidor según el servicio. */
  duracionMin: number;
  /** Lugar de atención donde es el turno. */
  sedeId: string | null;
}

export function crearEventoVet(
  e: Omit<EventoVet, "veterinarioId" | "duracionMin" | "sedeId"> &
    Partial<Pick<EventoVet, "veterinarioId" | "duracionMin" | "sedeId">>,
): EventoVet {
  return { ...e, veterinarioId: e.veterinarioId ?? null, duracionMin: e.duracionMin ?? 30, sedeId: e.sedeId ?? null };
}

const sinVacio = (s: string): string | null => (s.trim() ? s : null);

function compararTexto(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Orden por fecha y, a igual fecha, por hora. */
function orden(a: EventoVet, b: EventoVet): number {
  const porFecha = a.fecha.compareTo(b.fecha);
  return porFecha !== 0 ? porFecha : compararTexto(a.hora, b.hora);
}

function nombreEstado(estado: EstadoEvento): string {
  switch (estado) {
    case "PENDIENTE": return "pendiente";
    case "COMPLETADO": return "completado";
    case "CANCELADO": return "cancelado";
  }
}

/** Turnos y consultas del veterinario en sesión. */
class AgendaRepoImpl {
  private readonly TIPOS_GENERALES = ["Consulta", "Control", "Vacuna", "Desparasitación", "Tratamiento", "Cirugía", "Otro"];

  /**
   * Tipos que se pueden elegir al cargar un turno propio: los servicios que ofrece el veterinario (cada uno con
   * su duración) y los generales. [actual] es el tipo que ya tiene un turno que se está editando.
   */
  tipos(actual: string | null = null): string[] {
    const extra = actual && actual.trim() ? [actual] : [];
    return [...new Set([...PerfilVetRepo.serviciosOfrecidos(), ...this.TIPOS_GENERALES, ...extra])];
  }

  readonly eventos: EventoVet[] = [];

  limpiar(): void {
    this.eventos.length = 0;
  }

  async cargar(): Promise<void> {
    const nuevos = (await Servicios.fuente.turnos()).map((t) => this.aEvento(t));
    this.eventos.length = 0;
    this.eventos.push(...nuevos);
  }

  private aEvento(t: TurnoDto): EventoVet {
    return {
      id: t.id,
      pacienteId: t.mascota_id,
      tipo: t.categoria,
      motivo: t.motivo && t.motivo.trim() ? t.motivo : t.categoria,
      fecha: LocalDate.parse(t.fecha),
      hora: t.hora.slice(0, 5),
      estado: t.estado === "completado" ? "COMPLETADO" : t.estado === "cancelado" ? "CANCELADO" : "PENDIENTE",
      notas: t.notas ?? "",
      veterinario: PerfilVetRepo.nombre,
      veterinarioId: t.veterinario_id ?? null,
      duracionMin: t.duracion_min,
      sedeId: t.sede_id ?? null,
    };
  }

  private readonly alFallar = async (): Promise<void> => {
    await this.cargar();
    Servicios.avisarCambio();
  };

  /** Agenda un turno propio. El servidor valida que el horario esté libre y dentro de la atención. */
  agregar(
    pacienteId: string,
    tipo: string,
    motivo: string,
    fecha: LocalDate,
    hora: string,
    estado: EstadoEvento,
    notas: string,
    sedeId: string | null = null,
  ): EventoVet {
    const id = nuevoId();
    const vetId = Sesion.usuarioId;
    const idSede = PerfilVetRepo.sede(sedeId)?.id;
    const lugar = idSede && idSede.trim() ? idSede : null;
    const e: EventoVet = {
      id,
      pacienteId,
      tipo,
      motivo,
      fecha,
      hora,
      estado,
      notas,
      veterinario: PerfilVetRepo.nombre,
      veterinarioId: vetId,
      duracionMin: PerfilVetRepo.duracionDe(tipo),
      sedeId: lugar,
    };
    this.eventos.push(e);
    void Servicios.escribir({ alFallar: this.alFallar }, async () => {
      if (!vetId) throw new Error("No hay una sesión iniciada");
      const dto: NuevoTurnoDto = {
        id,
        mascota_id: pacienteId,
        veterinario_id: vetId,
        categoria: tipo,
        motivo,
        fecha: fecha.toString(),
        hora: `${hora}:00`,
        estado: nombreEstado(estado),
        notas: sinVacio(notas),
        creado_por: vetId,
        sede_id: lugar,
      };
      await Servicios.fuente.crearTurno(dto);
    });
    return e;
  }

  /** Guarda en el servidor los cambios hechos a un turno (tipo, motivo, fecha, hora y notas). */
  guardar(e: EventoVet): void {
    void Servicios.escribir({ alFallar: this.alFallar }, async () => {
      await Servicios.fuente.actualizarTurno(e.id, {
        categoria: e.tipo,
        motivo: e.motivo,
        fecha: e.fecha.toString(),
        hora: `${e.hora}:00`,
        ...(e.sedeId != null ? { sede_id: e.sedeId } : {}),
        notas: sinVacio(e.notas),
      });
    });
  }

  cambiarEstado(e: EventoVet, estado: EstadoEvento): void {
    e.estado = estado;
    void Servicios.escribir({ alFallar: this.alFallar }, async () => {
      await Servicios.fuente.actualizarTurno(e.id, { estado: nombreEstado(estado) });
    });
  }

  porId(id: string | null | undefined): EventoVet | null {
    return this.eventos.find((e) => e.id === id) ?? null;
  }

  deHoy(): EventoVet[] {
    const hoy = LocalDate.now();
    return this.eventos.filter((e) => e.fecha.equals(hoy) && e.estado === "PENDIENTE").sort(orden);
  }

  proximos(): EventoVet[] {
    const hoy = LocalDate.now();
    return this.eventos.filter((e) => e.estado === "PENDIENTE" && !e.fecha.isBefore(hoy)).sort(orden);
  }

  porEstado(estado: EstadoEvento): EventoVet[] {
    return this.eventos.filter((e) => e.estado === estado).sort((a, b) => orden(b, a));
  }

  deMascota(pacienteId: string): EventoVet[] {
    return this.eventos.filter((e) => e.pacienteId === pacienteId).sort((a, b) => orden(b, a));
  }

  ultimaConsulta(pacienteId: string): EventoVet | null {
    let mayor: EventoVet | null = null;
    for (const e of this.eventos) {
      if (e.pacienteId !== pacienteId || e.estado !== "COMPLETADO") continue;
      if (mayor === null || orden(mayor, e) < 0) mayor = e;
    }
    return mayor;
  }

  proximoEvento(pacienteId: string): EventoVet | null {
    return this.proximos().find((e) => e.pacienteId === pacienteId) ?? null;
  }

  /** Pacientes distintos con turno hoy, estén pendientes o ya atendidos (los cancelados no cuentan). */
  pacientesHoy(): number {
    const hoy = LocalDate.now();
    return new Set(this.eventos.filter((e) => e.fecha.equals(hoy) && e.estado !== "CANCELADO").map((e) => e.pacienteId)).size;
  }
}

export const AgendaRepo = new AgendaRepoImpl();
