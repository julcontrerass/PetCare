/* Migrado de data/repositorio/SaludRepo.kt */
import { Fechas } from "../../util/fechas";
import { LocalDate } from "../../util/tiempo";
import { nuevoId } from "../../util/uuid";
import type { RegistroSaludDto } from "../remoto/dtos";
import { Servicios } from "../servicios";
import { Sesion } from "../sesion";
import { DuenoRepo } from "./duenoRepo";
import { PacientesRepo } from "./pacientesRepo";

export type TipoRegistro = "VACUNA" | "DESPARASITACION" | "TRATAMIENTO" | "CIRUGIA" | "DOCUMENTO";

export const TiposRegistro: Record<
  TipoRegistro,
  {
    etiqueta: string;
    clave: string;
    singular: string;
    /** Las vacunas y las desparasitaciones se repiten: tienen próxima dosis y pueden estar vencidas. */
    conProximaDosis: boolean;
  }
> = {
  VACUNA: { etiqueta: "Vacunas", clave: "vacuna", singular: "vacuna", conProximaDosis: true },
  DESPARASITACION: { etiqueta: "Desparasitaciones", clave: "desparasitacion", singular: "desparasitación", conProximaDosis: true },
  TRATAMIENTO: { etiqueta: "Tratamientos", clave: "tratamiento", singular: "tratamiento", conProximaDosis: false },
  CIRUGIA: { etiqueta: "Cirugías", clave: "cirugia", singular: "cirugía", conProximaDosis: false },
  DOCUMENTO: { etiqueta: "Documentos", clave: "documento", singular: "documento", conProximaDosis: false },
};

/** Los tipos en el orden de la app (equivale a `TipoRegistro.entries`). */
export const TIPOS_REGISTRO = Object.keys(TiposRegistro) as TipoRegistro[];

const DIAS_PARA_AVISAR = 30;
const PREFIJO_ARCHIVO = "archivo:";
const PREFIJO_INFORME = "informe:";

export interface RegistroSalud {
  id: string;
  tipo: TipoRegistro;
  mascotaId: string;
  mascota: string;
  titulo: string;
  detalle: string;
  fecha: string;
  estado: string | null;
  archivoPath: string | null;
  /** Solo vacunas: cuándo toca la próxima dosis y qué se aplicó (producto, lote y vencimiento del lote). */
  proximaDosis: LocalDate | null;
  marca: string | null;
  lote: string | null;
  loteVencimiento: LocalDate | null;
  /** Día en que se aplicó o se cargó el registro (la [fecha] es el texto que se muestra). */
  fechaAplicada: LocalDate | null;
  /** Viene del informe de una consulta: se puede leer pero no borrar desde el carnet. */
  deConsulta: boolean;
}

export function crearRegistroSalud(
  r: Partial<Omit<RegistroSalud, "deConsulta">> & {
    id: string; tipo: TipoRegistro; mascotaId: string; mascota: string; titulo: string; detalle: string; fecha: string;
  },
): RegistroSalud {
  return {
    id: r.id,
    tipo: r.tipo,
    mascotaId: r.mascotaId,
    mascota: r.mascota,
    titulo: r.titulo,
    detalle: r.detalle,
    fecha: r.fecha,
    estado: r.estado ?? null,
    archivoPath: r.archivoPath ?? null,
    proximaDosis: r.proximaDosis ?? null,
    marca: r.marca ?? null,
    lote: r.lote ?? null,
    loteVencimiento: r.loteVencimiento ?? null,
    fechaAplicada: r.fechaAplicada ?? null,
    deConsulta: r.id.startsWith(PREFIJO_INFORME),
  };
}

const noVacio = (t: string | null | undefined): string | null => (t != null && t.trim() !== "" ? t : null);

function fechaONull(t: string | null | undefined): LocalDate | null {
  if (t == null) return null;
  try {
    return LocalDate.parse(t);
  } catch {
    return null;
  }
}

const dos = (n: number) => String(n).padStart(2, "0");

/** Vacunas, tratamientos y documentos de las mascotas que ve el veterinario en sesión. */
class SaludRepoImpl {
  readonly PREFIJO_INFORME = PREFIJO_INFORME;

  readonly registros: RegistroSalud[] = [];

  limpiar(): void {
    this.registros.length = 0;
  }

  private reemplazar(nuevos: RegistroSalud[]): void {
    this.registros.length = 0;
    this.registros.push(...nuevos);
  }

  async cargar(): Promise<void> {
    const nuevos = (await Servicios.fuente.registrosSalud()).map((r) => this.aRegistro(r));
    this.reemplazar(nuevos);
  }

  /** Nombre de la mascota para mostrar: la del paciente del veterinario o la del dueño en sesión. */
  private nombreDe(mascotaId: string): string {
    return (
      PacientesRepo.porId(mascotaId)?.nombre ??
      DuenoRepo.mascotas.find((m) => m.id === mascotaId)?.nombre ??
      "Mascota"
    );
  }

  /**
   * Carga el carnet del dueño: lo que cargó él o el veterinario en vacunas, tratamientos y documentos, más los
   * archivos que el veterinario adjuntó a las consultas (que se muestran en Documentos) y los tratamientos que
   * indicó en sus informes (que se muestran en Tratamientos).
   */
  async cargarComoDueno(): Promise<void> {
    const f = Servicios.fuente;
    const propios = (await f.registrosSalud()).map((r) => this.aRegistro(r));
    const adjuntos: RegistroSalud[] = [];
    for (const m of DuenoRepo.mascotas) {
      let archivos: Awaited<ReturnType<typeof f.archivosDe>> = [];
      try {
        archivos = await f.archivosDe(m.id);
      } catch {
        archivos = [];
      }
      for (const a of archivos) {
        adjuntos.push(
          crearRegistroSalud({
            id: PREFIJO_ARCHIVO + a.id, tipo: "DOCUMENTO", mascotaId: a.mascota_id, mascota: m.nombre, titulo: a.nombre,
            detalle: a.extension.toUpperCase() + (a.turno_id != null ? " · adjunto a una consulta" : ""),
            fecha: Fechas.corta(Fechas.instante(a.created_at).toLocalDate()), archivoPath: a.storage_path,
          }),
        );
      }
    }
    const indicados: RegistroSalud[] = [];
    for (const m of DuenoRepo.mascotas) {
      let informes: Awaited<ReturnType<typeof f.informesDe>> = [];
      try {
        informes = await f.informesDe(m.id);
      } catch {
        informes = [];
      }
      for (const i of informes.filter((x) => noVacio(x.tratamiento) !== null)) {
        indicados.push(
          crearRegistroSalud({
            id: PREFIJO_INFORME + i.id, tipo: "TRATAMIENTO", mascotaId: m.id, mascota: m.nombre,
            titulo: noVacio(i.diagnostico) ?? "Tratamiento indicado",
            detalle: i.tratamiento ?? "",
            fecha: Fechas.corta(Fechas.instante(i.created_at).toLocalDate()),
            estado: "Indicado",
          }),
        );
      }
    }
    this.reemplazar([...propios, ...adjuntos, ...indicados]);
  }

  private aRegistro(r: RegistroSaludDto): RegistroSalud {
    const tipo = TIPOS_REGISTRO.find((t) => TiposRegistro[t].clave === r.tipo) ?? "DOCUMENTO";
    const fecha = LocalDate.parse(r.fecha);
    const proxima = r.proxima_dosis != null ? LocalDate.parse(r.proxima_dosis) : null;
    const fin = r.fecha_fin != null ? LocalDate.parse(r.fecha_fin) : null;
    const hoy = LocalDate.now();
    const loteVencimiento = r.lote_vencimiento != null ? fechaONull(r.lote_vencimiento) : null;
    let detalle: string;
    let textoFecha: string;
    let estado: string | null;
    switch (tipo) {
      case "VACUNA":
      case "DESPARASITACION":
        detalle = [
          proxima ? `Próxima dosis: ${Fechas.corta(proxima)}` : "Sin próxima dosis",
          noVacio(r.marca),
          noVacio(r.lote) !== null ? `Lote ${r.lote}` : null,
          loteVencimiento ? `Vence ${dos(loteVencimiento.monthValue)}/${loteVencimiento.year}` : null,
        ]
          .filter((x): x is string => x !== null)
          .join(" · ");
        textoFecha = Fechas.corta(fecha);
        if (proxima == null) estado = "Al día";
        else if (proxima.isBefore(hoy)) estado = "Vencida";
        else if (!proxima.isAfter(hoy.plusDays(DIAS_PARA_AVISAR))) estado = "Próxima";
        else estado = "Al día";
        break;
      case "TRATAMIENTO":
        detalle = noVacio(r.detalle) ?? "Sin indicaciones";
        textoFecha = fin != null ? `${Fechas.corta(fecha)} - ${Fechas.corta(fin)}` : `Desde ${Fechas.corta(fecha)}`;
        estado = fin != null && fin.isBefore(hoy) ? "Finalizado" : "Activo";
        break;
      case "CIRUGIA":
        detalle = noVacio(r.detalle) ?? "Sin detalles";
        textoFecha = Fechas.corta(fecha);
        estado = null;
        break;
      default:
        detalle = noVacio(r.detalle) ?? "Documento";
        textoFecha = Fechas.corta(fecha);
        estado = null;
    }
    return crearRegistroSalud({
      id: r.id, tipo, mascotaId: r.mascota_id, mascota: this.nombreDe(r.mascota_id),
      titulo: r.titulo, detalle, fecha: textoFecha, estado, archivoPath: r.archivo_path ?? null,
      fechaAplicada: fecha, proximaDosis: proxima, marca: noVacio(r.marca), lote: noVacio(r.lote),
      loteVencimiento,
    });
  }

  /**
   * Vacunas y desparasitaciones vencidas o que vencen en los próximos [dias] días, de la más atrasada a la más
   * lejana.
   */
  vacunasARecordar(dias = 30, hoy: LocalDate = LocalDate.now()): RegistroSalud[] {
    const limite = hoy.plusDays(dias);
    return this.registros
      .filter((r) => TiposRegistro[r.tipo].conProximaDosis && r.proximaDosis != null)
      .filter((r) => !r.proximaDosis!.isAfter(limite))
      .sort((a, b) => a.proximaDosis!.compareTo(b.proximaDosis!));
  }

  filtrar(tipo: TipoRegistro, consulta: string, mascotaId: string | null): RegistroSalud[] {
    const q = consulta.trim().toLowerCase();
    return this.registros.filter(
      (r) =>
        r.tipo === tipo &&
        (mascotaId == null || r.mascotaId === mascotaId) &&
        (q === "" ||
          r.titulo.toLowerCase().includes(q) ||
          r.detalle.toLowerCase().includes(q) ||
          r.mascota.toLowerCase().includes(q)),
    );
  }

  /**
   * Agrega un registro. [fechaFin] es el cierre de un tratamiento, [proximaDosis] la siguiente vacuna y
   * [archivoPath] el documento ya subido a Storage.
   */
  agregar(
    tipo: TipoRegistro, mascotaId: string, titulo: string, detalle: string | null, fecha: LocalDate,
    fechaFin: LocalDate | null = null, proximaDosis: LocalDate | null = null, archivoPath: string | null = null,
    marca: string | null = null, lote: string | null = null, loteVencimiento: LocalDate | null = null,
  ): RegistroSalud {
    const id = nuevoId();
    const dto: RegistroSaludDto = {
      id, mascota_id: mascotaId, tipo: TiposRegistro[tipo].clave, titulo, detalle,
      fecha: fecha.toString(), fecha_fin: fechaFin?.toString() ?? null, proxima_dosis: proximaDosis?.toString() ?? null,
      archivo_path: archivoPath, marca, lote, lote_vencimiento: loteVencimiento?.toString() ?? null,
    };
    const registro = this.aRegistro(dto);
    this.registros.unshift(registro);
    void Servicios.escribir(
      {
        alFallar: async () => {
          await this.recargar();
          Servicios.avisarCambio();
        },
      },
      async () => {
        const usuario = Sesion.usuarioId;
        if (!usuario) throw new Error("No hay una sesión iniciada");
        await Servicios.fuente.crearRegistroSalud({
          id, mascota_id: mascotaId, tipo: TiposRegistro[tipo].clave, titulo, detalle,
          fecha: fecha.toString(), fecha_fin: fechaFin?.toString() ?? null, proxima_dosis: proximaDosis?.toString() ?? null,
          archivo_path: archivoPath, creado_por: usuario,
          marca: noVacio(marca), lote: noVacio(lote), lote_vencimiento: loteVencimiento?.toString() ?? null,
        });
      },
    );
    return registro;
  }

  eliminar(registro: RegistroSalud): void {
    const i = this.registros.indexOf(registro);
    if (i >= 0) this.registros.splice(i, 1);
    const esArchivo = registro.id.startsWith(PREFIJO_ARCHIVO);
    void Servicios.escribir(
      {
        alFallar: async () => {
          await this.recargar();
          Servicios.avisarCambio();
        },
      },
      async () => {
        if (esArchivo) await Servicios.fuente.eliminarArchivo(registro.id.slice(PREFIJO_ARCHIVO.length));
        else await Servicios.fuente.eliminarRegistroSalud(registro.id);
        if (registro.archivoPath) await Servicios.fuente.borrar("archivos", [registro.archivoPath]);
      },
    );
  }

  /** Vuelve a pedir el carnet según quién tiene la sesión. */
  private async recargar(): Promise<void> {
    if (Sesion.rol === "DUENO") await this.cargarComoDueno();
    else await this.cargar();
  }
}

export const SaludRepo = new SaludRepoImpl();
