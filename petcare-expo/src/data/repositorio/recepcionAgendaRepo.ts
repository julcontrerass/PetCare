/*
 * Agenda de la recepción: los turnos de todos los veterinarios para los que trabaja la cuenta, sus pacientes (con el
 * contacto del dueño) y los datos de cada veterinario que hacen falta para sacar un turno (lugares, horarios,
 * duración de cada servicio y animales que atiende). La base solo le muestra lo de sus veterinarios y nada clínico.
 *
 * A diferencia de la agenda del veterinario, cada cambio espera la respuesta del servidor: así un horario que se
 * ocupó mientras tanto o un turno que ya no se puede tocar se avisa en el momento.
 */
import type { VeterinarioAcceso } from "../../model/modelos";
import { LocalDate } from "../../util/tiempo";
import { nuevoId } from "../../util/uuid";
import { CuentaActual } from "../cuentaActual";
import type { AccesoDto, MascotaDto, TurnoDto } from "../remoto/dtos";
import { Servicios } from "../servicios";
import type { EstadoEvento } from "./agendaRepo";
import { DuenoRepo } from "./duenoRepo";
import { ClinicasRepo } from "./clinicasRepo";

export type Llegada = "en_espera" | "no_vino";

export interface TurnoRecepcion {
  readonly id: string;
  vetId: string;
  mascotaId: string;
  tipo: string;
  motivo: string;
  fecha: LocalDate;
  hora: string;
  estado: EstadoEvento;
  notas: string;
  duracionMin: number;
  sedeId: string | null;
  llegada: Llegada | null;
}

export interface PacienteRecepcion {
  readonly id: string;
  nombre: string;
  tipo: string;
  fotoPath: string | null;
  /** Alergias o carácter: se muestran en la recepción para avisar al recibir al paciente. */
  alertas: string;
  dueno: string;
  telefono: string | null;
  email: string | null;
}

/** Lo que se carga al sacar o mover un turno. */
export interface DatosTurno {
  vetId: string;
  mascotaId: string;
  tipo: string;
  motivo: string;
  fecha: LocalDate;
  hora: string;
  sedeId: string | null;
  notas: string;
}

/** Turno general cuando el veterinario no cargó servicios propios. */
const TIPOS_GENERALES = ["Consulta", "Control", "Vacuna", "Desparasitación", "Tratamiento", "Cirugía", "Otro"];

function orden(a: TurnoRecepcion, b: TurnoRecepcion): number {
  const porFecha = a.fecha.compareTo(b.fecha);
  return porFecha !== 0 ? porFecha : a.hora < b.hora ? -1 : a.hora > b.hora ? 1 : 0;
}

function estadoDe(t: TurnoDto): EstadoEvento {
  return t.estado === "completado" ? "COMPLETADO" : t.estado === "cancelado" ? "CANCELADO" : "PENDIENTE";
}

function vigente(a: AccesoDto, hoy: LocalDate): boolean {
  if (a.estado !== "activo") return false;
  return a.vence_el == null || !LocalDate.parse(a.vence_el.slice(0, 10)).isBefore(hoy);
}

const sinVacio = (s: string): string | null => (s.trim() ? s.trim() : null);

class RecepcionAgendaRepoImpl {
  private _veterinarios: VeterinarioAcceso[] = [];
  private _turnos: TurnoRecepcion[] = [];
  private _pacientes = new Map<string, PacienteRecepcion>();
  /** Pacientes (ids de mascota) de cada veterinario: los que le dieron acceso y siguen vigentes. */
  private _pacientesPorVet = new Map<string, Set<string>>();

  /** Veterinarios con los que la cuenta tiene el vínculo activo, en el orden de sus nombres. */
  get veterinarios(): readonly VeterinarioAcceso[] { return this._veterinarios; }

  veterinario(id: string | null | undefined): VeterinarioAcceso | null {
    return this._veterinarios.find((v) => v.id === id) ?? null;
  }

  paciente(id: string): PacienteRecepcion | null {
    return this._pacientes.get(id) ?? null;
  }

  nombrePaciente(id: string): string {
    return this._pacientes.get(id)?.nombre ?? "Paciente";
  }

  /** Pacientes de [vetId] (o de todos), ordenados por nombre. */
  pacientes(vetId: string | null = null): PacienteRecepcion[] {
    const ids = new Set<string>();
    for (const [vet, mascotas] of this._pacientesPorVet) {
      if (vetId == null || vet === vetId) mascotas.forEach((m) => ids.add(m));
    }
    return [...ids].map((id) => this._pacientes.get(id)).filter((p): p is PacienteRecepcion => p != null)
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }

  /** Veterinarios que atienden a la mascota (para mostrarlo en la lista de pacientes). */
  veterinariosDe(mascotaId: string): VeterinarioAcceso[] {
    return this._veterinarios.filter((v) => this._pacientesPorVet.get(v.id)?.has(mascotaId));
  }

  turno(id: string | null | undefined): TurnoRecepcion | null {
    return this._turnos.find((t) => t.id === id) ?? null;
  }

  private de(vetId: string | null): TurnoRecepcion[] {
    return vetId == null ? this._turnos : this._turnos.filter((t) => t.vetId === vetId);
  }

  /** Turnos de hoy que todavía no se completaron ni cancelaron, por hora. */
  deHoy(vetId: string | null = null): TurnoRecepcion[] {
    const hoy = LocalDate.now();
    return this.de(vetId).filter((t) => t.fecha.equals(hoy) && t.estado === "PENDIENTE").sort(orden);
  }

  /** Turnos pendientes de hoy en adelante. */
  proximos(vetId: string | null = null): TurnoRecepcion[] {
    const hoy = LocalDate.now();
    return this.de(vetId).filter((t) => t.estado === "PENDIENTE" && !t.fecha.isBefore(hoy)).sort(orden);
  }

  /** Completados o cancelados, los más nuevos primero. */
  porEstado(estado: EstadoEvento, vetId: string | null = null): TurnoRecepcion[] {
    return this.de(vetId).filter((t) => t.estado === estado).sort((a, b) => orden(b, a));
  }

  /** Servicios que se pueden elegir con ese veterinario: los suyos y los generales. */
  tipos(vet: VeterinarioAcceso, actual: string | null = null): string[] {
    const extra = actual && actual.trim() ? [actual] : [];
    return [...new Set([...vet.especialidades, ...TIPOS_GENERALES, ...extra])];
  }

  /**
   * Horarios de inicio que ofrece el veterinario ese día en ese lugar para un turno de [duracionMin], y cuáles de
   * ellos no se pueden tomar (se pisan con otro turno suyo o ya pasaron). [ignorarId] es el turno que se mueve.
   */
  horarios(
    vet: VeterinarioAcceso, fecha: LocalDate, duracionMin: number, sedeId: string | null, ignorarId: string | null = null,
  ): { horas: string[]; ocupadas: string[] } {
    const sede = vet.sede(sedeId);
    const horas = DuenoRepo.horasDe(vet, fecha, duracionMin, sede);
    // La agenda del veterinario se ve completa: todos sus turnos pendientes de ese día ocupan su horario
    const tomados = this._turnos.filter(
      (t) => t.vetId === vet.id && t.id !== ignorarId && t.estado === "PENDIENTE" && t.fecha.equals(fecha),
    );
    const ocupadas = horas.filter(
      (h) => DuenoRepo.horaPasada(fecha, h) || tomados.some((t) => DuenoRepo.seSuperponen(h, duracionMin, t.hora, t.duracionMin)),
    );
    return { horas, ocupadas };
  }

  async cargar(): Promise<void> {
    const ids = new Set(ClinicasRepo.veterinariosConAgenda);
    if (ids.size === 0) {
      this.limpiar();
      return;
    }
    const f = Servicios.fuente;
    const [catalogo, turnos, mascotas, accesos] = await Promise.all([
      f.catalogoVeterinarios(), f.turnos(), f.mascotasDelVeterinario(), f.accesos(),
    ]);
    this._veterinarios = catalogo
      .filter((p) => ids.has(p.id))
      .map((p) => DuenoRepo.aVeterinario(p, "ACTIVO", []))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    const hoy = LocalDate.now();
    this._pacientesPorVet = new Map();
    for (const a of accesos) {
      if (!ids.has(a.veterinario_id) || !vigente(a, hoy)) continue;
      const lista = this._pacientesPorVet.get(a.veterinario_id) ?? new Set<string>();
      lista.add(a.mascota_id);
      this._pacientesPorVet.set(a.veterinario_id, lista);
    }
    this._pacientes = new Map(mascotas.map((m) => [m.id, this.aPaciente(m)]));
    this._turnos = turnos.filter((t) => t.veterinario_id != null && ids.has(t.veterinario_id)).map((t) => this.aTurno(t));
  }

  limpiar(): void {
    this._veterinarios = [];
    this._turnos = [];
    this._pacientes = new Map();
    this._pacientesPorVet = new Map();
  }

  // ---------- Cambios (cada uno espera al servidor y vuelve a pedir la agenda) ----------

  async sacarTurno(d: DatosTurno): Promise<void> {
    const yo = CuentaActual.usuarioId;
    if (!yo) throw new Error("No hay una sesión iniciada");
    await Servicios.fuente.crearTurno({
      id: nuevoId(), mascota_id: d.mascotaId, veterinario_id: d.vetId, categoria: d.tipo, motivo: d.motivo.trim() || d.tipo,
      fecha: d.fecha.toString(), hora: `${d.hora}:00`, estado: "pendiente", notas: sinVacio(d.notas), creado_por: yo,
      sede_id: d.sedeId,
    });
    await this.recargar();
  }

  /** Cambia el día, la hora, el lugar, el servicio, el motivo o las notas de un turno pendiente. */
  async mover(t: TurnoRecepcion, d: DatosTurno): Promise<void> {
    await Servicios.fuente.actualizarTurno(t.id, {
      categoria: d.tipo, motivo: d.motivo.trim() || d.tipo, fecha: d.fecha.toString(), hora: `${d.hora}:00`,
      notas: sinVacio(d.notas), ...(d.sedeId != null ? { sede_id: d.sedeId } : {}),
    });
    await this.recargar();
  }

  async cancelar(t: TurnoRecepcion): Promise<void> {
    await Servicios.fuente.actualizarTurno(t.id, { estado: "cancelado" });
    await this.recargar();
  }

  /** Marca que el paciente llegó (sala de espera) o que no vino; null quita la marca. */
  async marcarLlegada(t: TurnoRecepcion, llegada: Llegada | null): Promise<void> {
    await Servicios.fuente.actualizarTurno(t.id, { llegada });
    await this.recargar();
  }

  private async recargar(): Promise<void> {
    try {
      await this.cargar();
    } finally {
      Servicios.avisarCambio();
    }
  }

  private aTurno(t: TurnoDto): TurnoRecepcion {
    return {
      id: t.id,
      vetId: t.veterinario_id ?? "",
      mascotaId: t.mascota_id,
      tipo: t.categoria,
      motivo: t.motivo && t.motivo.trim() ? t.motivo : t.categoria,
      fecha: LocalDate.parse(t.fecha),
      hora: t.hora.slice(0, 5),
      estado: estadoDe(t),
      notas: t.notas ?? "",
      duracionMin: t.duracion_min,
      sedeId: t.sede_id ?? null,
      llegada: t.llegada ?? null,
    };
  }

  private aPaciente(m: MascotaDto): PacienteRecepcion {
    return {
      id: m.id,
      nombre: m.nombre,
      tipo: m.tipo,
      fotoPath: m.foto_path ?? null,
      alertas: m.alertas_clinicas ?? "",
      dueno: m.dueno?.nombre ?? m.propietario_nombre ?? "Sin dueño cargado",
      telefono: m.dueno?.telefono ?? m.propietario_telefono ?? null,
      email: m.dueno?.email ?? m.propietario_email ?? null,
    };
  }
}

export const RecepcionAgendaRepo = new RecepcionAgendaRepoImpl();

// En el modo recepción, aceptar o dejar un vínculo cambia qué agenda se ve: se vuelve a pedir en el momento
ClinicasRepo.alCambiar = async () => {
  if (CuentaActual.rol === "RECEPCIONISTA") await RecepcionAgendaRepo.cargar();
};
