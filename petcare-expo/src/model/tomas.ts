/*
 * Tomas de una receta: el plan arranca cuando el dueño da la primera dosis y sigue una cada [frecuenciaHoras] durante
 * [duracionDias] (o hasta que el veterinario lo suspende). Es el mismo cálculo con el que se programan los avisos de
 * "Hora de la medicación" (DuenoRepo.programarAvisos), así cada aviso coincide con una toma para tildar.
 */
import { LocalDate, LocalDateTime } from "../util/tiempo";
import type { Prescripcion } from "./clinica";

/** Tope de tomas por receta (una cada hora durante un mes y algo). */
const MAXIMO_TOMAS = 800;

export type EstadoTratamiento = "sin_empezar" | "en_curso" | "terminado" | "suspendido";

/** La receta tiene un plan de tomas (frecuencia y duración). */
export function tienePlan(p: Prescripcion): boolean {
  return p.frecuenciaHoras != null && p.frecuenciaHoras > 0 && p.duracionDias != null && p.duracionDias > 0;
}

/** Cuándo empieza la medicación: la primera dosis que marcó el dueño, sin segundos; null si todavía no empezó. */
export function inicioDeTomas(p: Prescripcion): LocalDateTime | null {
  const base = p.empezo;
  return base ? LocalDateTime.ofDate(base.toLocalDate(), base.hour, base.minute, 0) : null;
}

/** Cuántas tomas son en total (aunque todavía no haya empezado). */
export function totalDeTomas(p: Prescripcion): number {
  if (!tienePlan(p)) return 0;
  return Math.min(MAXIMO_TOMAS, Math.ceil((p.duracionDias! * 24) / p.frecuenciaHoras!));
}

/** Todas las tomas del plan, en orden; ninguna si no tiene plan o todavía no empezó. Se cortan si se suspendió. */
export function momentosDeTomas(p: Prescripcion): LocalDateTime[] {
  const inicio = inicioDeTomas(p);
  if (!tienePlan(p) || !inicio) return [];
  const cada = p.frecuenciaHoras!;
  let fin = inicio.plusDays(p.duracionDias!);
  if (p.suspendida && p.suspendida.isBefore(fin)) fin = p.suspendida;
  const tomas: LocalDateTime[] = [];
  for (let t = inicio; t.isBefore(fin) && tomas.length < MAXIMO_TOMAS; t = t.plusHours(cada)) tomas.push(t);
  return tomas;
}

/** Las tomas de la receta que caen en [dia]. */
export function tomasDelDia(p: Prescripcion, dia: LocalDate): LocalDateTime[] {
  return momentosDeTomas(p).filter((t) => t.toLocalDate().equals(dia));
}

/** Las tomas agrupadas por día, en orden (para la grilla del tratamiento). */
export function tomasPorDia(momentos: LocalDateTime[]): { dia: LocalDate; tomas: LocalDateTime[] }[] {
  const dias: { dia: LocalDate; tomas: LocalDateTime[] }[] = [];
  for (const t of momentos) {
    const dia = t.toLocalDate();
    const ultimo = dias[dias.length - 1];
    if (ultimo && ultimo.dia.equals(dia)) ultimo.tomas.push(t);
    else dias.push({ dia, tomas: [t] });
  }
  return dias;
}

/** La clave con la que se guarda la toma en la base ("2026-11-24T08:00:00", hora local). */
export function claveDeToma(t: LocalDateTime): string {
  return t.toString();
}

/** Lee la hora programada que devuelve la base ("2026-11-24T08:00:00" o "2026-11-24 08:00:00"); null si no se entiende. */
export function tomaDeClave(texto: string): LocalDateTime | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/.exec(texto);
  if (!m) return null;
  try {
    return LocalDateTime.of(Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4]), Number(m[5]), Number(m[6] ?? 0));
  } catch {
    return null;
  }
}

/** Cuántas tomas tocaban hasta [ahora] y cuántas de esas se dieron (y cuántas son en total). */
export function cumplimiento(p: Prescripcion, dadas: Set<string>, ahora: LocalDateTime = LocalDateTime.now()): { dadas: number; debidas: number; total: number } {
  const todas = momentosDeTomas(p);
  const debidas = todas.filter((t) => !t.isAfter(ahora));
  const total = todas.length > 0 ? todas.length : totalDeTomas(p);
  return { dadas: debidas.filter((t) => dadas.has(claveDeToma(t))).length, debidas: debidas.length, total };
}

/** En qué anda el tratamiento. */
export function estadoTratamiento(p: Prescripcion, ahora: LocalDateTime = LocalDateTime.now()): EstadoTratamiento {
  if (p.suspendida) return "suspendido";
  const todas = momentosDeTomas(p);
  if (todas.length === 0) return "sin_empezar";
  return todas[todas.length - 1].isAfter(ahora) ? "en_curso" : "terminado";
}

/** Minutos de atraso desde los que una toma sin tildar se ve como atrasada (y se pregunta a qué hora se dio). */
export const MINUTOS_ATRASO = 30;
