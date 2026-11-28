/*
 * Bloqueos de agenda de los veterinarios que la cuenta ve: los propios (veterinario) o los de los veterinarios cuya
 * agenda maneja (recepción). Se usan para no ofrecer esos horarios y para listarlos y quitarlos.
 */
import { bloqueoDeDto, bloqueoQuePisa, vigentes, type Bloqueo } from "../../model/bloqueos";
import type { LocalDate, LocalDateTime } from "../../util/tiempo";
import type { BloqueoAfectadoDto } from "../remoto/dtos";
import { Servicios } from "../servicios";

/** "2026-11-30T08:00:00", como la guarda la base. */
export function claveLocal(m: LocalDateTime): string {
  const dos = (n: number) => String(n).padStart(2, "0");
  return `${m.toLocalDate().toString()}T${dos(m.hour)}:${dos(m.minute)}:00`;
}

class BloqueosRepoImpl {
  private lista: Bloqueo[] = [];
  private ids: string[] = [];

  /** Pide los bloqueos que todavía no terminaron de esos veterinarios. */
  async cargar(veterinarioIds: string[]): Promise<void> {
    this.ids = [...veterinarioIds];
    const dtos = await Servicios.fuente.bloqueos(this.ids);
    this.lista = dtos.map(bloqueoDeDto).filter((b): b is Bloqueo => b !== null);
  }

  limpiar(): void {
    this.lista = [];
    this.ids = [];
  }

  /** Los que todavía no terminaron de ese veterinario, del más próximo al más lejano. */
  de(veterinarioId: string): Bloqueo[] {
    return vigentes(this.lista.filter((b) => b.veterinarioId === veterinarioId));
  }

  /** El bloqueo de ese veterinario que pisa el turno, o null. */
  quePisa(veterinarioId: string, fecha: LocalDate, hora: string, duracionMin: number): Bloqueo | null {
    return bloqueoQuePisa(this.lista.filter((b) => b.veterinarioId === veterinarioId), fecha, hora, duracionMin);
  }

  /** Bloquea [desde, hasta) y devuelve los turnos que caen adentro (cancelados si [cancelar]). */
  async crear(veterinarioId: string, desde: LocalDateTime, hasta: LocalDateTime, motivo: string, cancelar: boolean): Promise<BloqueoAfectadoDto[]> {
    const afectados = await Servicios.fuente.crearBloqueo(veterinarioId, claveLocal(desde), claveLocal(hasta), motivo.trim(), cancelar);
    await this.cargar(this.ids.includes(veterinarioId) ? this.ids : [...this.ids, veterinarioId]);
    return afectados;
  }

  async eliminar(b: Bloqueo): Promise<void> {
    await Servicios.fuente.eliminarBloqueo(b.id);
    this.lista = this.lista.filter((x) => x.id !== b.id);
  }
}

export const BloqueosRepo = new BloqueosRepoImpl();
