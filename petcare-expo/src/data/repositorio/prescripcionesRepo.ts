import type { Prescripcion } from "../../model/clinica";
import { crearPrescripcion, prescripcionDeDto } from "../../model/clinica";
import { LocalDate, LocalDateTime } from "../../util/tiempo";
import { nuevoId } from "../../util/uuid";
import type { NuevaPrescripcionDto } from "../remoto/dtos";
import { Servicios } from "../servicios";
import { Sesion } from "../sesion";

const sinVacio = (s: string): string | null => (s.trim() ? s : null);

/** Medicamentos que el veterinario en sesión receta a sus pacientes; los de una consulta forman su receta. */
class PrescripcionesRepoImpl {
  private lista: Prescripcion[] = [];

  limpiar(): void {
    this.lista = [];
  }

  /** Vuelve a pedir al servidor las recetas de ese paciente. */
  async cargar(pacienteId: string): Promise<void> {
    const nuevas = (await Servicios.fuente.prescripciones(pacienteId)).map(prescripcionDeDto);
    this.lista = this.lista.filter((p) => p.mascotaId !== pacienteId);
    this.lista.push(...nuevas);
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
        const veterinarioId = Sesion.usuarioId;
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
