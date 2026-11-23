import type { SignosVitales } from "../../model/modelos";
import { signosVacios } from "../../model/modelos";
import { Fechas } from "../../util/fechas";
import { LocalDate } from "../../util/tiempo";
import { nuevoId } from "../../util/uuid";
import type { InformeDto, NuevoInformeDto } from "../remoto/dtos";
import { Servicios } from "../servicios";
import { Sesion } from "../sesion";
import { PacientesRepo } from "./pacientesRepo";

/**
 * Informe de una consulta con el formato SOAP: lo que cuenta el dueño ([anamnesis]), lo que se observa y se mide
 * ([examenFisico] y [signos]), la impresión diagnóstica ([diagnostico]) y el plan ([tratamiento]).
 */
export interface InformeData {
  readonly pacienteId: string;
  readonly turnoId: string | null;
  readonly id: string | null;
  motivo: string;
  diagnostico: string;
  tratamiento: string;
  anamnesis: string;
  examenFisico: string;
  signos: SignosVitales;
  /** Día en que se hizo el informe; null mientras todavía no se guardó. */
  readonly creadoEl: LocalDate | null;
}

export function crearInformeData(
  pacienteId: string,
  o: Partial<Omit<InformeData, "pacienteId">> = {},
): InformeData {
  return {
    pacienteId,
    turnoId: o.turnoId ?? null,
    id: o.id ?? null,
    motivo: o.motivo ?? "",
    diagnostico: o.diagnostico ?? "",
    tratamiento: o.tratamiento ?? "",
    anamnesis: o.anamnesis ?? "",
    examenFisico: o.examenFisico ?? "",
    signos: o.signos ?? {},
    creadoEl: o.creadoEl ?? null,
  };
}

/**
 * Un informe lo puede modificar quien lo hizo y solo el mismo día; después queda cerrado (el servidor lo
 * exige igual: acá se evita ofrecer lo que no se va a poder guardar).
 */
export function informeEditable(i: InformeData): boolean {
  return i.creadoEl === null || i.creadoEl.equals(LocalDate.now());
}

/** True si el veterinario todavía no escribió nada. */
export function informeVacio(i: InformeData): boolean {
  return (
    !i.motivo.trim() &&
    !i.diagnostico.trim() &&
    !i.tratamiento.trim() &&
    !i.anamnesis.trim() &&
    !i.examenFisico.trim() &&
    signosVacios(i.signos)
  );
}

const sinVacio = (s: string): string | null => (s.trim() ? s : null);

/**
 * Informe clínico que el veterinario en sesión escribe sobre un paciente. Cada turno tiene el suyo; los que se
 * escriben desde la ficha del paciente, sin turno, quedan como informe general.
 */
class InformesRepoImpl {
  private informes = new Map<string, InformeData>();

  limpiar(): void {
    this.informes.clear();
  }

  private clave(pacienteId: string, turnoId: string | null): string {
    return turnoId ?? `paciente:${pacienteId}`;
  }

  private deDto(pacienteId: string, turnoId: string | null, d: InformeDto): InformeData {
    return {
      pacienteId,
      turnoId,
      id: d.id,
      motivo: d.motivo ?? "",
      diagnostico: d.diagnostico ?? "",
      tratamiento: d.tratamiento ?? "",
      anamnesis: d.anamnesis ?? "",
      examenFisico: d.examen_fisico ?? "",
      signos: {
        pesoKg: d.peso_kg ?? null,
        temperaturaC: d.temperatura_c ?? null,
        frecuenciaCardiaca: d.frecuencia_cardiaca ?? null,
        frecuenciaRespiratoria: d.frecuencia_respiratoria ?? null,
      },
      creadoEl: d.created_at != null ? Fechas.instante(d.created_at).toLocalDate() : null,
    };
  }

  /** Trae del servidor el informe propio de ese turno (o el general del paciente si no hay turno). */
  async cargar(pacienteId: string, turnoId: string | null = null): Promise<InformeData> {
    const miId = Sesion.usuarioId;
    const propio = (await Servicios.fuente.informesDe(pacienteId)).find(
      (i) => (i.veterinario_id ?? null) === miId && (i.turno_id ?? null) === turnoId,
    );
    const informe = propio === undefined ? crearInformeData(pacienteId, { turnoId }) : this.deDto(pacienteId, turnoId, propio);
    this.informes.set(this.clave(pacienteId, turnoId), informe);
    return informe;
  }

  /** Lo último que se sabe del informe, sin pedirlo al servidor. */
  obtener(pacienteId: string, turnoId: string | null = null): InformeData {
    return this.informes.get(this.clave(pacienteId, turnoId)) ?? crearInformeData(pacienteId, { turnoId });
  }

  /** Todos los pesos medidos en consultas de esa mascota, del más viejo al más nuevo. */
  async pesos(pacienteId: string): Promise<Array<[LocalDate, number]>> {
    const pares: Array<[LocalDate, number]> = [];
    for (const i of await Servicios.fuente.informesDe(pacienteId)) {
      if (i.peso_kg != null) pares.push([Fechas.instante(i.created_at).toLocalDate(), i.peso_kg]);
    }
    return pares.sort((a, b) => a[0].compareTo(b[0]));
  }

  guardar(
    pacienteId: string,
    motivo: string,
    diagnostico: string,
    tratamiento: string,
    turnoId: string | null = null,
    anamnesis = "",
    examenFisico = "",
    signos: SignosVitales = {},
  ): void {
    const previo = this.informes.get(this.clave(pacienteId, turnoId));
    // Un informe cerrado no se toca
    if (previo !== undefined && !informeEditable(previo)) return;
    const existente = previo?.id ?? null;
    const id = existente ?? nuevoId();
    this.informes.set(this.clave(pacienteId, turnoId), {
      pacienteId,
      turnoId,
      id,
      motivo,
      diagnostico,
      tratamiento,
      anamnesis,
      examenFisico,
      signos,
      creadoEl: previo?.creadoEl ?? LocalDate.now(),
    });
    // El peso del informe es el actual del animal: se ve en su ficha sin esperar al servidor
    if (signos.pesoKg != null) PacientesRepo.actualizarPeso(pacienteId, signos.pesoKg);
    void Servicios.escribir(
      {
        alFallar: async () => {
          await this.cargar(pacienteId, turnoId);
          Servicios.avisarCambio();
        },
      },
      async () => {
        if (existente !== null) {
          await Servicios.fuente.actualizarInforme(existente, {
            motivo: sinVacio(motivo),
            diagnostico: sinVacio(diagnostico),
            tratamiento: sinVacio(tratamiento),
            anamnesis: sinVacio(anamnesis),
            examen_fisico: sinVacio(examenFisico),
            peso_kg: signos.pesoKg ?? null,
            temperatura_c: signos.temperaturaC ?? null,
            frecuencia_cardiaca: signos.frecuenciaCardiaca ?? null,
            frecuencia_respiratoria: signos.frecuenciaRespiratoria ?? null,
          });
        } else {
          const veterinarioId = Sesion.usuarioId;
          if (!veterinarioId) throw new Error("No hay una sesión iniciada");
          const dto: NuevoInformeDto = {
            id,
            mascota_id: pacienteId,
            turno_id: turnoId,
            veterinario_id: veterinarioId,
            motivo: sinVacio(motivo),
            diagnostico: sinVacio(diagnostico),
            tratamiento: sinVacio(tratamiento),
            anamnesis: sinVacio(anamnesis),
            examen_fisico: sinVacio(examenFisico),
            peso_kg: signos.pesoKg ?? null,
            temperatura_c: signos.temperaturaC ?? null,
            frecuencia_cardiaca: signos.frecuenciaCardiaca ?? null,
            frecuencia_respiratoria: signos.frecuenciaRespiratoria ?? null,
          };
          await Servicios.fuente.crearInforme(dto);
        }
      },
    );
  }
}

export const InformesRepo = new InformesRepoImpl();
