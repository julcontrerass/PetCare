import type { SedeVet } from "../../model/modelos";
import { crearSede } from "../../model/modelos";
import { CatalogoMedico } from "../catalogoMedico";
import { LocalDate, LocalDateTime, horaDesdeMinutos } from "../../util/tiempo";
import { AgendaRepo } from "./agendaRepo";
import { PerfilVetRepo } from "./perfilVetRepo";

export interface Horario {
  hora: string;
  libre: boolean;
}

/** Como toIntOrNull de Kotlin: solo enteros completos (con signo opcional). */
function enteroONull(texto: string | undefined): number | null {
  return texto !== undefined && /^[+-]?\d+$/.test(texto) ? Number(texto) : null;
}

/**
 * Reglas de disponibilidad del veterinario: días de atención, franja horaria del perfil y turnos ya ocupados en
 * la agenda. Cada turno dura lo que corresponde a su servicio; los horarios arrancan cada [PASO_MIN] minutos.
 */
class DisponibilidadVetImpl {
  /** Duración que se usa cuando todavía no se sabe qué servicio es. */
  readonly DURACION_MIN = 30;

  /** Cada cuántos minutos arranca un horario de la grilla. */
  readonly PASO_MIN = 30;

  /** El lugar que se usa cuando no se indica uno: el principal (o, sin lugares cargados, los datos de siempre). */
  private lugar(sede: SedeVet | null | undefined): SedeVet {
    return (
      sede ??
      PerfilVetRepo.sede(null) ??
      crearSede({
        id: "",
        nombre: PerfilVetRepo.clinica,
        dias: PerfilVetRepo.diasSeleccionados.map((activo, i) => (activo ? i + 1 : 0)).filter((d) => d > 0),
        apertura: PerfilVetRepo.horaApertura,
        cierre: PerfilVetRepo.horaCierre,
      })
    );
  }

  trabajaEl(fecha: LocalDate, sede: SedeVet | null = null): boolean {
    return this.lugar(sede).dias.includes(fecha.dayOfWeek);
  }

  nombreDia(fecha: LocalDate): string {
    return PerfilVetRepo.todosLosDias[fecha.dayOfWeek - 1];
  }

  private minutos(hora: string): number | null {
    const partes = hora.trim().split(":");
    const h = enteroONull(partes[0]);
    if (h === null) return null;
    const m = enteroONull(partes[1]);
    if (m === null) return null;
    return h * 60 + m;
  }

  private formato(min: number): string {
    return horaDesdeMinutos(min);
  }

  /** "10:00" + 90 min = "11:30". */
  horaFin(hora: string, duracionMin: number): string {
    return this.formato(((this.minutos(hora) ?? 0) + duracionMin) % (24 * 60));
  }

  /** Un turno pendiente ocupa el horario si su franja se superpone con la del turno que se quiere cargar. */
  ocupado(fecha: LocalDate, hora: string, duracionMin: number, ignorarId: string | null = null): boolean {
    const inicio = this.minutos(hora);
    if (inicio === null) return false;
    return AgendaRepo.eventos.some((e) => {
      if (e.id === ignorarId || e.estado !== "PENDIENTE" || !e.fecha.equals(fecha)) return false;
      const otro = this.minutos(e.hora);
      if (otro === null) return false;
      return inicio < otro + e.duracionMin && otro < inicio + duracionMin;
    });
  }

  private yaPaso(fecha: LocalDate, min: number): boolean {
    const hoy = LocalDate.now();
    if (fecha.isBefore(hoy)) return true;
    if (!fecha.equals(hoy)) return false;
    const ahora = LocalDateTime.now();
    return min <= ahora.hour * 60 + ahora.minute;
  }

  /** Los horarios de inicio de la franja de atención para un turno de [duracionMin], marcando cuáles siguen libres. */
  horarios(
    fecha: LocalDate,
    duracionMin: number = this.DURACION_MIN,
    ignorarId: string | null = null,
    sede: SedeVet | null = null,
  ): Horario[] {
    if (!this.trabajaEl(fecha, sede)) return [];
    const inicio = this.minutos(this.lugar(sede).apertura);
    if (inicio === null) return [];
    const fin = this.minutos(this.lugar(sede).cierre);
    if (fin === null) return [];
    const lista: Horario[] = [];
    let t = inicio;
    while (t + duracionMin <= fin) {
      const hora = this.formato(t);
      lista.push({ hora, libre: !this.yaPaso(fecha, t) && !this.ocupado(fecha, hora, duracionMin, ignorarId) });
      t += this.PASO_MIN;
    }
    return lista;
  }

  /** Devuelve el motivo por el que no se puede agendar, o null si está todo bien. */
  validar(
    fecha: LocalDate,
    hora: string,
    duracionMin: number = this.DURACION_MIN,
    ignorarId: string | null = null,
    sede: SedeVet | null = null,
  ): string | null {
    const donde = this.lugar(sede);
    const enOtro = PerfilVetRepo.sedes.length > 1 && donde.nombre.trim() ? ` en ${donde.nombre}` : "";
    if (fecha.isBefore(LocalDate.now())) return "No podés seleccionar una fecha que ya pasó";
    if (!this.trabajaEl(fecha, sede)) return `No atendés los ${this.nombreDia(fecha).toLowerCase()}${enOtro}`;
    const m = this.minutos(hora);
    if (m === null) return "Elegí un horario";
    const inicio = this.minutos(donde.apertura) ?? 0;
    const fin = this.minutos(donde.cierre) ?? 24 * 60;
    if (m < inicio || m >= fin) {
      return `El horario está fuera de tu atención${enOtro} (${donde.apertura} a ${donde.cierre} hs)`;
    }
    if (m + duracionMin > fin) {
      return (
        `El turno dura ${CatalogoMedico.textoDuracion(duracionMin)} y no llega a terminar antes de que ` +
        `cierres (${donde.cierre} hs)`
      );
    }
    if (this.yaPaso(fecha, m)) return "Ese horario ya pasó";
    if (this.ocupado(fecha, hora, duracionMin, ignorarId)) return "Ya tenés un turno en ese horario";
    return null;
  }
}

export const DisponibilidadVet = new DisponibilidadVetImpl();
