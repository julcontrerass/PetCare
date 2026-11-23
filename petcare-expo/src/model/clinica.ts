import type { PrescripcionDto } from "../data/remoto/dtos";
import { Fechas } from "../util/fechas";
import { LocalDate, LocalDateTime } from "../util/tiempo";

export const LIMITES_SIGNOS = {
  PESO_MAXIMO: 999.0,
  TEMPERATURA: { min: 25.0, max: 45.0 },
  FRECUENCIA_CARDIACA: { min: 10, max: 400 },
  FRECUENCIA_RESPIRATORIA: { min: 2, max: 200 },
};

/** Lo que se mide en la consulta; cada dato es opcional. */
export interface SignosVitales {
  pesoKg?: number | null;
  temperaturaC?: number | null;
  frecuenciaCardiaca?: number | null;
  frecuenciaRespiratoria?: number | null;
}

export function numeroTexto(valor: number): string {
  return valor % 1 === 0 ? String(Math.trunc(valor)) : valor.toFixed(1);
}

export function signosVacios(s: SignosVitales): boolean {
  return s.pesoKg == null && s.temperaturaC == null && s.frecuenciaCardiaca == null && s.frecuenciaRespiratoria == null;
}

/** "Peso 12 kg · Temp. 38.5 °C · FC 90 lpm · FR 20 rpm" con lo que haya. */
export function signosTexto(s: SignosVitales): string {
  return [
    s.pesoKg != null ? `Peso ${numeroTexto(s.pesoKg)} kg` : null,
    s.temperaturaC != null ? `Temp. ${numeroTexto(s.temperaturaC)} °C` : null,
    s.frecuenciaCardiaca != null ? `FC ${s.frecuenciaCardiaca} lpm` : null,
    s.frecuenciaRespiratoria != null ? `FR ${s.frecuenciaRespiratoria} rpm` : null,
  ]
    .filter((x): x is string => x !== null)
    .join(" · ");
}

/** Un medicamento recetado en una consulta. */
export interface Prescripcion {
  id: string;
  mascotaId: string;
  turnoId: string | null;
  medicamento: string;
  dosis: string;
  frecuenciaHoras: number | null;
  duracionDias: number | null;
  indicaciones: string;
  inicio: LocalDate;
  /** Cuándo se recetó; de ahí se cuentan las tomas. */
  creada: LocalDateTime | null;
}

/** "250 mg, cada 8 hs, durante 7 días". */
export function posologia(p: Prescripcion): string {
  return [
    p.dosis.trim() ? p.dosis : null,
    p.frecuenciaHoras != null ? `cada ${p.frecuenciaHoras} hs` : null,
    p.duracionDias != null ? `durante ${p.duracionDias} ${p.duracionDias === 1 ? "día" : "días"}` : null,
  ]
    .filter((x): x is string => x !== null)
    .join(", ");
}

export function crearPrescripcion(p: Partial<Prescripcion> & { id: string; mascotaId: string; medicamento: string }): Prescripcion {
  return {
    id: p.id,
    mascotaId: p.mascotaId,
    turnoId: p.turnoId ?? null,
    medicamento: p.medicamento,
    dosis: p.dosis ?? "",
    frecuenciaHoras: p.frecuenciaHoras ?? null,
    duracionDias: p.duracionDias ?? null,
    indicaciones: p.indicaciones ?? "",
    inicio: p.inicio ?? LocalDate.now(),
    creada: p.creada ?? null,
  };
}

export function prescripcionDeDto(d: PrescripcionDto): Prescripcion {
  return {
    id: d.id,
    mascotaId: d.mascota_id,
    turnoId: d.turno_id ?? null,
    medicamento: d.medicamento,
    dosis: d.dosis ?? "",
    frecuenciaHoras: d.frecuencia_horas ?? null,
    duracionDias: d.duracion_dias ?? null,
    indicaciones: d.indicaciones ?? "",
    inicio: Fechas.iso(d.inicio) ?? LocalDate.now(),
    creada: d.created_at ? Fechas.instante(d.created_at) : null,
  };
}
