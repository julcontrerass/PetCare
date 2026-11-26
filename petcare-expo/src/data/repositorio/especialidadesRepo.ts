/*
 * Títulos de las especialidades del veterinario en sesión. Cada especialidad elegida (dermatología, cardiología...)
 * se ofrece a los dueños recién cuando el administrador aprueba su título; acá están el estado de cada una y el envío
 * del título (título, institución, año y uno o más archivos, que van al bucket privado `credenciales`).
 */
import { CuentaActual } from "../cuentaActual";
import { subirDocumentoPrivado, type ArchivoHabilitacion } from "../habilitaciones";
import type { EspecialidadVetDto } from "../remoto/dtos";
import { Servicios } from "../servicios";

/** Lo que carga el veterinario para una especialidad (los archivos todavía en el teléfono). */
export interface CertificadoElegido {
  especialidad: string;
  titulo: string;
  institucion: string;
  anio: number;
  archivos: ArchivoHabilitacion[];
}

/** Sube los archivos de [c] a la carpeta de [usuarioId] y manda el título a revisar. */
export async function enviarCertificado(c: CertificadoElegido, usuarioId: string): Promise<void> {
  const rutas: string[] = [];
  for (const a of c.archivos) rutas.push(await subirDocumentoPrivado(a, usuarioId, "titulo"));
  await Servicios.fuente.cargarCertificadoEspecialidad({
    especialidad: c.especialidad, titulo: c.titulo.trim(), institucion: c.institucion.trim(), anio: c.anio, archivos: rutas,
  });
}

class EspecialidadesRepoImpl {
  private _lista: EspecialidadVetDto[] = [];

  get lista(): readonly EspecialidadVetDto[] { return this._lista; }

  /** Si falla se queda lo que había. */
  async cargar(): Promise<void> {
    try {
      this._lista = await Servicios.fuente.misEspecialidades();
    } catch {
      // se queda lo que había
    }
  }

  async enviar(c: CertificadoElegido): Promise<void> {
    const yo = CuentaActual.usuarioId;
    if (!yo) throw new Error("No hay una sesión iniciada");
    await enviarCertificado(c, yo);
    await this.cargar();
    Servicios.avisarCambio();
  }

  /** "2 aprobadas · 1 en revisión · 1 sin título" para la fila del perfil. */
  resumen(): string {
    if (this._lista.length === 0) return "No elegiste especialidades";
    const cuenta = (e: EspecialidadVetDto["estado"]) => this._lista.filter((x) => x.estado === e).length;
    const partes: string[] = [];
    const aprobadas = cuenta("aprobada");
    const pendientes = cuenta("pendiente");
    const faltan = cuenta("sin_certificado") + cuenta("rechazada");
    if (aprobadas > 0) partes.push(aprobadas === 1 ? "1 aprobada" : `${aprobadas} aprobadas`);
    if (pendientes > 0) partes.push(`${pendientes} en revisión`);
    if (faltan > 0) partes.push(faltan === 1 ? "1 sin título" : `${faltan} sin título`);
    return partes.join(" · ");
  }

  /** Hay especialidades que no se ofrecen porque les falta el título (o se lo rechazaron). */
  get faltanTitulos(): boolean {
    return this._lista.some((e) => e.estado === "sin_certificado" || e.estado === "rechazada");
  }

  limpiar(): void {
    this._lista = [];
  }
}

export const EspecialidadesRepo = new EspecialidadesRepoImpl();
