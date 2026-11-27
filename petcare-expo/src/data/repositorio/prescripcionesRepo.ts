import type { Prescripcion } from "../../model/clinica";
import { crearPrescripcion, prescripcionDeDto } from "../../model/clinica";
import { claveDeToma, cumplimiento, tomaDeClave } from "../../model/tomas";
import { LocalDate, LocalDateTime } from "../../util/tiempo";
import { nuevoId } from "../../util/uuid";
import type { ConComida, NuevaPrescripcionDto } from "../remoto/dtos";
import { Servicios } from "../servicios";
import { CuentaActual } from "../cuentaActual";

const sinVacio = (s: string): string | null => (s.trim() ? s : null);

/** Medicamentos que el veterinario en sesión receta a sus pacientes; los de una consulta forman su receta. */
class PrescripcionesRepoImpl {
  private lista: Prescripcion[] = [];
  /** Tomas que el dueño ya tildó, por receta: claves "2026-11-24T08:00:00". */
  private tomas = new Map<string, Set<string>>();

  limpiar(): void {
    this.lista = [];
    this.tomas.clear();
  }

  /** Vuelve a pedir al servidor las recetas de ese paciente (y las tomas que el dueño fue tildando). */
  async cargar(pacienteId: string): Promise<void> {
    const nuevas = (await Servicios.fuente.prescripciones(pacienteId)).map(prescripcionDeDto);
    this.lista = this.lista.filter((p) => p.mascotaId !== pacienteId);
    this.lista.push(...nuevas);
    try {
      const tomas = await Servicios.fuente.tomas(pacienteId);
      for (const p of nuevas) this.tomas.delete(p.id);
      for (const t of tomas) {
        const clave = tomaDeClave(t.programada);
        if (!clave) continue;
        const dadas = this.tomas.get(t.prescripcion_id) ?? new Set<string>();
        dadas.add(claveDeToma(clave));
        this.tomas.set(t.prescripcion_id, dadas);
      }
    } catch {
      // sin el detalle de tomas la receta se muestra igual
    }
  }

  /** Cuántas tomas de la receta tocaban hasta ahora, cuántas se dieron y cuántas son en total; null si no tiene frecuencia. */
  cumplimientoDe(p: Prescripcion): { dadas: number; debidas: number; total: number } | null {
    const c = cumplimiento(p, this.tomas.get(p.id) ?? new Set());
    return c.total > 0 ? c : null;
  }

  /** Claves de las tomas que el dueño tildó de [p]. */
  dadasDe(p: Prescripcion): Set<string> {
    return this.tomas.get(p.id) ?? new Set();
  }

  /** El veterinario corta el tratamiento: no hay más tomas ni avisos, y al dueño le llega el aviso. */
  async suspender(p: Prescripcion, motivo: string): Promise<void> {
    await Servicios.fuente.suspenderTratamiento(p.id, motivo.trim() || null);
    await this.cargar(p.mascotaId);
    Servicios.avisarCambio();
  }

  /** Las recetas de la consulta (o las que se hicieron sin turno, desde la ficha del paciente). */
  deConsulta(pacienteId: string, turnoId: string | null): Prescripcion[] {
    // Las que no tienen fecha de creación (LocalDateTime.MIN en Kotlin) van primero
    return this.lista
      .filter((p) => p.mascotaId === pacienteId && p.turnoId === turnoId)
      .sort((a, b) => {
        if (a.creada === null) return b.creada === null ? 0 : -1;
        if (b.creada === null) return 1;
        return a.creada.compareTo(b.creada);
      });
  }

  deMascota(pacienteId: string): Prescripcion[] {
    return this.lista.filter((p) => p.mascotaId === pacienteId);
  }

  agregar(
    pacienteId: string,
    turnoId: string | null,
    medicamento: string,
    dosis: string,
    frecuenciaHoras: number | null,
    duracionDias: number | null,
    indicaciones: string,
    conComida: ConComida | null = null,
  ): Prescripcion {
    const p = crearPrescripcion({
      id: nuevoId(),
      mascotaId: pacienteId,
      turnoId,
      medicamento: medicamento.trim(),
      dosis: dosis.trim(),
      frecuenciaHoras,
      duracionDias,
      indicaciones: indicaciones.trim(),
      inicio: LocalDate.now(),
      creada: LocalDateTime.now(),
      conComida,
    });
    this.lista.push(p);
    void Servicios.escribir(
      {
        alFallar: async () => {
          await this.cargar(pacienteId);
          Servicios.avisarCambio();
        },
      },
      async () => {
        const veterinarioId = CuentaActual.usuarioId;
        if (!veterinarioId) throw new Error("No hay una sesión iniciada");
        const dto: NuevaPrescripcionDto = {
          id: p.id,
          mascota_id: pacienteId,
          turno_id: turnoId,
          veterinario_id: veterinarioId,
          medicamento: p.medicamento,
          dosis: sinVacio(p.dosis),
          frecuencia_horas: frecuenciaHoras,
          duracion_dias: duracionDias,
          indicaciones: sinVacio(p.indicaciones),
          inicio: p.inicio.toString(),
          con_comida: conComida,
        };
        await Servicios.fuente.crearPrescripcion(dto);
      },
    );
    return p;
  }

  eliminar(p: Prescripcion): void {
    this.lista = this.lista.filter((x) => x.id !== p.id);
    void Servicios.escribir(
      {
        alFallar: async () => {
          await this.cargar(p.mascotaId);
          Servicios.avisarCambio();
        },
      },
      async () => {
        await Servicios.fuente.eliminarPrescripcion(p.id);
      },
    );
  }
}

export const PrescripcionesRepo = new PrescripcionesRepoImpl();
