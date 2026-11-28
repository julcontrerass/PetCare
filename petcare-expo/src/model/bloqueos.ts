/*
 * Bloqueos de agenda: los momentos en que un veterinario no atiende (cirugía, enfermedad, viaje, feriado...) y la pausa
 * fija de cada lugar. La base no deja sacar turnos que los pisen; acá está la misma regla para mostrar los horarios.
 * Las horas son locales de Argentina, como las de los turnos.
 */
import type { BloqueoDto } from "../data/remoto/dtos";
import { LocalDate, LocalDateTime } from "../util/tiempo";
import type { SedeVet } from "./modelos";
import { tomaDeClave } from "./tomas";

export interface Bloqueo {
  readonly id: string;
  readonly veterinarioId: string;
  readonly desde: LocalDateTime;
  readonly hasta: LocalDateTime;
  readonly motivo: string;
}

/** Motivos que se ofrecen al bloquear (también se puede escribir otro). */
export const MOTIVOS_BLOQUEO = ["Cirugía", "Enfermedad", "Viaje", "Feriado", "Capacitación", "Trámite personal"];

export function bloqueoDeDto(d: BloqueoDto): Bloqueo | null {
  const desde = tomaDeClave(d.desde);
  const hasta = tomaDeClave(d.hasta);
  if (!desde || !hasta) return null;
  return { id: d.id, veterinarioId: d.veterinario_id, desde, hasta, motivo: d.motivo };
}

function minutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** El bloqueo (de [bloqueos]) que pisa un turno de [duracionMin] que arranca ese día a [hora], o null. */
export function bloqueoQuePisa(bloqueos: readonly Bloqueo[], fecha: LocalDate, hora: string, duracionMin: number): Bloqueo | null {
  const inicio = LocalDateTime.ofDate(fecha).plusMinutes(minutos(hora));
  const fin = inicio.plusMinutes(duracionMin);
  return bloqueos.find((b) => b.desde.isBefore(fin) && inicio.isBefore(b.hasta)) ?? null;
}

/** True si un turno de [duracionMin] que arranca a [hora] pisa la pausa del lugar. */
export function pisaPausa(sede: SedeVet | null | undefined, hora: string, duracionMin: number): boolean {
  if (!sede?.pausaDesde || !sede.pausaHasta) return false;
  const inicio = minutos(hora);
  return inicio < minutos(sede.pausaHasta) && minutos(sede.pausaDesde) < inicio + duracionMin;
}

/** Bloqueos que todavía no terminaron, del más próximo al más lejano. */
export function vigentes(bloqueos: readonly Bloqueo[], ahora: LocalDateTime = LocalDateTime.now()): Bloqueo[] {
  return bloqueos.filter((b) => ahora.isBefore(b.hasta)).sort((a, b) => a.desde.compareTo(b.desde));
}

/** "Lunes 30/11, todo el día", "Lunes 30/11 de 13:00 a 17:00" o "Del 30/11 al 4/12". */
export function textoBloqueo(b: Bloqueo): string {
  const dia = (f: LocalDate) => `${f.dayOfMonth}/${f.monthValue}`;
  const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const inicio = b.desde.toLocalDate();
  // Un bloqueo de día entero termina a las 00:00 del día siguiente
  const finIncluido = b.hasta.hour === 0 && b.hasta.minute === 0 ? b.hasta.toLocalDate().minusDays(1) : b.hasta.toLocalDate();
  const diaEntero = b.desde.hour === 0 && b.desde.minute === 0 && b.hasta.hour === 0 && b.hasta.minute === 0;
  if (inicio.equals(finIncluido)) {
    const nombre = `${DIAS[inicio.dayOfWeek - 1]} ${dia(inicio)}`;
    return diaEntero ? `${nombre}, todo el día` : `${nombre} de ${b.desde.horaTexto()} a ${b.hasta.horaTexto()}`;
  }
  return diaEntero
    ? `Del ${dia(inicio)} al ${dia(finIncluido)}`
    : `Del ${dia(inicio)} ${b.desde.horaTexto()} al ${dia(b.hasta.toLocalDate())} ${b.hasta.horaTexto()}`;
}

/** Cuántos turnos pendientes (que todavía no pasaron) caen entre [desde] y [hasta]. */
export function turnosQuePisan(
  turnos: readonly { fecha: LocalDate; hora: string; duracionMin: number; estado: string }[],
  desde: LocalDateTime, hasta: LocalDateTime, ahora: LocalDateTime = LocalDateTime.now(),
): number {
  return turnos.filter((t) => {
    if (t.estado !== "PENDIENTE") return false;
    const inicio = LocalDateTime.ofDate(t.fecha).plusMinutes(minutos(t.hora));
    return ahora.isBefore(inicio) && inicio.isBefore(hasta) && desde.isBefore(inicio.plusMinutes(t.duracionMin));
  }).length;
}
