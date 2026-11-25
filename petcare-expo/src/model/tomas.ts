/*
 * Tomas de una receta: una cada [frecuenciaHoras] desde que se recetó, durante [duracionDias]. Es el mismo cálculo con
 * el que se programan los avisos de "Hora de la medicación" (DuenoRepo.programarAvisos), así cada aviso coincide con
 * una toma para tildar.
 */
import { LocalDate, LocalDateTime } from "../util/tiempo";
import type { Prescripcion } from "./clinica";

/** Tope de tomas por receta (una cada hora durante un mes y algo). */
const MAXIMO_TOMAS = 800;

/** Cuándo empieza la medicación: la hora en que se recetó o, si no se sabe, las 9 del día de inicio. Sin segundos. */
export function inicioDeTomas(p: Prescripcion): LocalDateTime {
  const base = p.creada ?? LocalDateTime.ofDate(p.inicio, 9, 0);
  return LocalDateTime.ofDate(base.toLocalDate(), base.hour, base.minute, 0);
}

/** Todas las tomas de la receta, en orden; ninguna si no tiene frecuencia o duración. */
export function momentosDeTomas(p: Prescripcion): LocalDateTime[] {
  const cada = p.frecuenciaHoras;
  const dias = p.duracionDias;
  if (cada == null || cada <= 0 || dias == null || dias <= 0) return [];
  const inicio = inicioDeTomas(p);
  const fin = inicio.plusDays(dias);
  const tomas: LocalDateTime[] = [];
  for (let t = inicio; t.isBefore(fin) && tomas.length < MAXIMO_TOMAS; t = t.plusHours(cada)) tomas.push(t);
  return tomas;
}

/** Las tomas de la receta que caen en [dia]. */
export function tomasDelDia(p: Prescripcion, dia: LocalDate): LocalDateTime[] {
  return momentosDeTomas(p).filter((t) => t.toLocalDate().equals(dia));
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

/** Cuántas tomas tocaban hasta [ahora] y cuántas de esas se dieron. */
export function cumplimiento(p: Prescripcion, dadas: Set<string>, ahora: LocalDateTime = LocalDateTime.now()): { dadas: number; debidas: number; total: number } {
  const todas = momentosDeTomas(p);
  const debidas = todas.filter((t) => !t.isAfter(ahora));
  return { dadas: debidas.filter((t) => dadas.has(claveDeToma(t))).length, debidas: debidas.length, total: todas.length };
}
