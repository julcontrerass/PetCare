/*
 * Habilitaciones de una veterinaria (comercial y sanitaria): un PDF o una imagen que se sube al bucket privado
 * `credenciales`, en la carpeta de quien lo sube. Solo lo ven esa persona y el administrador de la plataforma, que
 * los usa para verificar que la veterinaria exista.
 */
import { nuevoId } from "../util/uuid";
import { Imagenes } from "./imagenes";
import { Servicios } from "./servicios";

export const BUCKET_HABILITACIONES = "credenciales";

/** Lo que acepta el bucket (y el límite de tamaño que tiene). */
export const TIPOS_HABILITACION: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
export const TAMANO_MAXIMO_HABILITACION = 10 * 1024 * 1024;

/** Un archivo elegido en el teléfono o el navegador, todavía sin subir. */
export interface ArchivoHabilitacion {
  uri: string;
  nombre: string;
}

export function extensionDe(nombre: string): string {
  const punto = nombre.lastIndexOf(".");
  return punto >= 0 ? nombre.slice(punto + 1).toLowerCase() : "";
}

/** Por qué no sirve el archivo, o null si sirve. */
export function problemaConHabilitacion(nombre: string, tamano: number | null): string | null {
  if (TIPOS_HABILITACION[extensionDe(nombre)] === undefined) return "Subí un PDF o una foto (JPG, PNG o WEBP)";
  if (tamano != null && tamano > TAMANO_MAXIMO_HABILITACION) return "El archivo supera los 10 MB";
  return null;
}

/** Sube una habilitación a la carpeta de [usuarioId] y devuelve su ruta en el bucket. */
export function subirHabilitacion(archivo: ArchivoHabilitacion, usuarioId: string): Promise<string> {
  return subirDocumentoPrivado(archivo, usuarioId, "habilitacion");
}

/**
 * Sube un documento (PDF o imagen) al bucket privado `credenciales`, en la carpeta de [usuarioId]: habilitaciones,
 * títulos de especialidades. Devuelve su ruta.
 */
export async function subirDocumentoPrivado(archivo: ArchivoHabilitacion, usuarioId: string, prefijo: string): Promise<string> {
  const extension = extensionDe(archivo.nombre);
  const mime = TIPOS_HABILITACION[extension];
  if (!mime) throw new Error("Subí un PDF o una foto (JPG, PNG o WEBP)");
  const bytes = await Imagenes.bytesDe(archivo.uri);
  if (bytes.length > TAMANO_MAXIMO_HABILITACION) throw new Error("El archivo supera los 10 MB");
  const ruta = `${usuarioId}/${prefijo}-${nuevoId()}.${extension === "jpeg" ? "jpg" : extension}`;
  await Servicios.fuente.subir(BUCKET_HABILITACIONES, ruta, bytes, mime);
  return ruta;
}
