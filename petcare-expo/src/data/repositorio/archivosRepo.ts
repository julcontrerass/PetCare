import { Fechas } from "../../util/fechas";
import { nuevoId } from "../../util/uuid";
import type { ArchivoDto, NuevoArchivoDto } from "../remoto/dtos";
import { Imagenes } from "../imagenes";
import { Servicios } from "../servicios";
import { Sesion } from "../sesion";

export interface ArchivoItem {
  readonly id: string;
  readonly pacienteId: string;
  readonly nombre: string;
  readonly fecha: string;
  readonly tipoExtension: string;
  /** Nombre del ícono de MaterialCommunityIcons (en Kotlin era `iconRes`, un drawable `ic_*`). */
  readonly icono: string;
  readonly storagePath: string;
  /** Turno al que se adjuntó el archivo (null si se subió suelto a la ficha). */
  readonly turnoId: string | null;
}

/** Estudios, recetas y documentos de una mascota, guardados en el bucket privado `archivos`. */
class ArchivosRepoImpl {
  readonly BUCKET = "archivos";

  private porPaciente = new Map<string, ArchivoItem[]>();

  limpiar(): void {
    this.porPaciente.clear();
  }

  dePaciente(pacienteId: string): ArchivoItem[] {
    return this.porPaciente.get(pacienteId) ?? [];
  }

  /** Los archivos que se adjuntaron al informe de un turno. */
  deTurno(pacienteId: string, turnoId: string): ArchivoItem[] {
    return this.dePaciente(pacienteId).filter((a) => a.turnoId === turnoId);
  }

  async cargar(pacienteId: string): Promise<void> {
    const lista = (await Servicios.fuente.archivosDe(pacienteId)).map((a) => this.aItem(a));
    this.porPaciente.set(pacienteId, [...lista]);
  }

  /** Doc/Docx: lápiz (ic_pencil); imágenes: cámara (ic_camera); el resto: lista (ic_list). */
  private iconoDe(extension: string): string {
    switch (extension.toUpperCase()) {
      case "DOC":
      case "DOCX":
        return "pencil";
      case "JPG":
      case "JPEG":
      case "PNG":
        return "camera";
      default:
        return "format-list-bulleted";
    }
  }

  private aItem(a: ArchivoDto): ArchivoItem {
    const ext = a.extension.toUpperCase();
    const cuando = Fechas.instante(a.created_at).toLocalDate();
    return {
      id: a.id,
      pacienteId: a.mascota_id,
      nombre: a.nombre,
      fecha: `Subido el ${Fechas.corta(cuando)} · ${ext}`,
      tipoExtension: ext,
      icono: this.iconoDe(ext),
      storagePath: a.storage_path,
      turnoId: a.turno_id ?? null,
    };
  }

  /** Sube el archivo a Storage y lo registra en la ficha. Falla con excepción si el servidor lo rechaza. */
  async agregar(
    pacienteId: string,
    nombre: string,
    extension: string,
    bytes: Uint8Array,
    tipoMime: string,
    turnoId: string | null = null,
  ): Promise<ArchivoItem> {
    const usuario = Sesion.usuarioId;
    if (!usuario) throw new Error("No hay una sesión iniciada");
    const id = nuevoId();
    const ruta = `${pacienteId}/${id}.${extension.toLowerCase()}`;
    await Servicios.fuente.subir(this.BUCKET, ruta, bytes, tipoMime);
    try {
      const dto: NuevoArchivoDto = {
        id,
        mascota_id: pacienteId,
        nombre,
        extension: extension.toLowerCase(),
        storage_path: ruta,
        tamano_bytes: bytes.length,
        subido_por: usuario,
        turno_id: turnoId,
      };
      await Servicios.fuente.crearArchivo(dto);
    } catch (e) {
      try {
        await Servicios.fuente.borrar(this.BUCKET, [ruta]);
      } catch {
        // si tampoco se puede borrar, se avisa el error original
      }
      throw e;
    }
    const ext = extension.toUpperCase();
    const item: ArchivoItem = {
      id,
      pacienteId,
      nombre,
      fecha: `Subido hoy · ${ext}`,
      tipoExtension: ext,
      icono: this.iconoDe(ext),
      storagePath: ruta,
      turnoId,
    };
    let lista = this.porPaciente.get(pacienteId);
    if (!lista) {
      lista = [];
      this.porPaciente.set(pacienteId, lista);
    }
    lista.unshift(item);
    return item;
  }

  renombrar(item: ArchivoItem, nuevoNombre: string): void {
    const lista = this.porPaciente.get(item.pacienteId);
    if (!lista) return;
    const indice = lista.findIndex((a) => a.id === item.id);
    if (indice !== -1) lista[indice] = { ...item, nombre: nuevoNombre };
    void Servicios.escribir(
      {
        alFallar: async () => {
          await this.cargar(item.pacienteId);
          Servicios.avisarCambio();
        },
      },
      async () => {
        await Servicios.fuente.renombrarArchivo(item.id, nuevoNombre);
      },
    );
  }

  eliminar(item: ArchivoItem): void {
    const lista = this.porPaciente.get(item.pacienteId);
    if (lista) {
      this.porPaciente.set(
        item.pacienteId,
        lista.filter((a) => a.id !== item.id),
      );
    }
    void Servicios.escribir(
      {
        alFallar: async () => {
          await this.cargar(item.pacienteId);
          Servicios.avisarCambio();
        },
      },
      async () => {
        await Servicios.fuente.eliminarArchivo(item.id);
        await Servicios.fuente.borrar(this.BUCKET, [item.storagePath]);
      },
    );
  }

  /** Copia local del archivo (se descarga la primera vez) para abrirlo con otra aplicación; devuelve su uri `file://`. */
  async archivoLocal(item: ArchivoItem): Promise<string> {
    return Imagenes.archivoLocal(this.BUCKET, item.storagePath);
  }
}

export const ArchivosRepo = new ArchivosRepoImpl();
