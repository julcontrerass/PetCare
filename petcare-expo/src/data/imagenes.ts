/*
 * Migrado de data/Imagenes.kt (solo la parte de datos: caché de archivos, descarga, achicado y subida; el dibujo
 * en pantalla lo hace el componente <ImagenRemota>).
 */
import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { nuevoId } from "../util/uuid";
import { Servicios } from "./servicios";

const LADO_MAXIMO = 1280;
const CALIDAD_JPEG = 0.85;

const esWeb = Platform.OS === "web";

// ---------- Caché nativa (carpeta de caché del teléfono) ----------

function carpeta(): Directory {
  const dir = new Directory(Paths.cache, "storage");
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Nombre de archivo seguro: la "/" pasa a "_" (como en la app Android) y lo raro se codifica. */
function nombreDeCache(bucket: string, ruta: string): string {
  const seguro = ruta
    .replace(/\//g, "_")
    .replace(/[^A-Za-z0-9._-]/g, (c) => `_x${c.codePointAt(0)!.toString(16)}_`);
  return `${bucket}_${seguro}`;
}

function archivoDeCache(bucket: string, ruta: string): File {
  return new File(carpeta(), nombreDeCache(bucket, ruta));
}

// ---------- Caché web (en memoria: no hay sistema de archivos) ----------

/** En la web los archivos bajados viven como `blob:` uri creadas con `URL.createObjectURL`. */
const enMemoria = new Map<string, string>();

function claveWeb(bucket: string, ruta: string): string {
  return `${bucket}/${ruta}`;
}

function tipoMimeDe(ruta: string): string {
  const ext = ruta.includes(".") ? ruta.slice(ruta.lastIndexOf(".") + 1).toLowerCase() : "";
  switch (ext) {
    case "jpg":
    case "jpeg": return "image/jpeg";
    case "png": return "image/png";
    case "webp": return "image/webp";
    case "gif": return "image/gif";
    case "pdf": return "application/pdf";
    case "txt": return "text/plain";
    default: return "application/octet-stream";
  }
}

function urlDeBytes(bytes: Uint8Array, ruta: string): string {
  // Se copia a un ArrayBuffer propio para que Blob acepte el tipo
  const copia = new Uint8Array(bytes.byteLength);
  copia.set(bytes);
  return URL.createObjectURL(new Blob([copia], { type: tipoMimeDe(ruta) }));
}

/** Descargas en curso: si el mismo archivo se pide varias veces a la vez se espera la misma descarga. */
const descargas = new Map<string, Promise<string>>();

/** Dónde está la copia local (una uri) del archivo; null si todavía no se bajó. Es síncrona. */
function uriEnCache(bucket: string, ruta: string): string | null {
  if (!ruta) return null;
  if (esWeb) return enMemoria.get(claveWeb(bucket, ruta)) ?? null;
  try {
    const f = archivoDeCache(bucket, ruta);
    return f.exists && f.size > 0 ? f.uri : null;
  } catch {
    return null;
  }
}

/** Descarga el archivo si todavía no está en el teléfono y devuelve su copia local (uri `file://` o `blob:`). */
async function archivoLocal(bucket: string, ruta: string): Promise<string> {
  const enCache = uriEnCache(bucket, ruta);
  if (enCache) return enCache;
  const clave = `${bucket}/${ruta}`;
  let descarga = descargas.get(clave);
  if (!descarga) {
    descarga = (async () => {
      const bytes = await Servicios.fuente.descargar(bucket, ruta);
      if (esWeb) {
        const url = urlDeBytes(bytes, ruta);
        enMemoria.set(claveWeb(bucket, ruta), url);
        return url;
      }
      const destino = archivoDeCache(bucket, ruta);
      try {
        if (!destino.exists) destino.create({ intermediates: true });
        await destino.write(bytes);
      } catch (e) {
        try {
          if (destino.exists) destino.delete();
        } catch {
          // no se pudo limpiar el archivo a medias
        }
        throw e;
      }
      return destino.uri;
    })();
    descargas.set(clave, descarga);
  }
  try {
    return await descarga;
  } finally {
    if (descargas.get(clave) === descarga) descargas.delete(clave);
  }
}

/** Lee un archivo local (`file://`, `content://`, `blob:` o `data:`). */
async function bytesDe(uri: string): Promise<Uint8Array> {
  if (esWeb) {
    const respuesta = await fetch(uri);
    return new Uint8Array(await respuesta.arrayBuffer());
  }
  return new File(uri).bytes();
}

/** Achica (lado máximo 1280) y comprime a JPEG 85 la foto elegida; devuelve la uri de un JPEG listo para subir. */
async function prepararFoto(uri: string): Promise<string> {
  // Se decodifica ya achicada para no cargar en memoria fotos enormes de la cámara
  const base = await ImageManipulator.manipulate(uri, { maxWidth: LADO_MAXIMO, maxHeight: LADO_MAXIMO }).renderAsync();
  let imagen = base;
  if (Math.max(base.width, base.height) > LADO_MAXIMO) {
    const contexto = ImageManipulator.manipulate(base);
    contexto.resize(base.width >= base.height ? { width: LADO_MAXIMO } : { height: LADO_MAXIMO });
    imagen = await contexto.renderAsync();
  }
  const resultado = await imagen.saveAsync({ format: SaveFormat.JPEG, compress: CALIDAD_JPEG });
  return resultado.uri;
}

/**
 * Sube una foto ya preparada al bucket `fotos` en la carpeta del usuario y devuelve su ruta.
 * La copia queda en caché para no volver a bajarla.
 */
async function subirFoto(uriPreparada: string, usuarioId: string): Promise<string> {
  const ruta = `${usuarioId}/${nuevoId()}.jpg`;
  const bytes = await bytesDe(uriPreparada);
  await Servicios.fuente.subir(Imagenes.BUCKET_FOTOS, ruta, bytes, "image/jpeg");
  // La foto ya está subida: si no se puede dejar la copia en caché, se baja de nuevo cuando haga falta
  try {
    if (esWeb) {
      enMemoria.set(claveWeb(Imagenes.BUCKET_FOTOS, ruta), urlDeBytes(bytes, ruta));
    } else {
      const destino = archivoDeCache(Imagenes.BUCKET_FOTOS, ruta);
      if (!destino.exists) destino.create({ intermediates: true });
      await destino.write(bytes);
    }
  } catch {
    // sin copia local
  }
  return ruta;
}

/** Borra del servidor una foto que ya no se usa (no falla si no existía). */
async function borrarFoto(ruta: string | null | undefined): Promise<void> {
  if (!ruta || !ruta.trim()) return;
  try {
    await Servicios.fuente.borrar(Imagenes.BUCKET_FOTOS, [ruta]);
  } catch {
    // ya no estaba
  }
  try {
    if (esWeb) {
      const clave = claveWeb(Imagenes.BUCKET_FOTOS, ruta);
      const url = enMemoria.get(clave);
      if (url) URL.revokeObjectURL(url);
      enMemoria.delete(clave);
    } else {
      const f = archivoDeCache(Imagenes.BUCKET_FOTOS, ruta);
      if (f.exists) f.delete();
    }
  } catch {
    // la copia local se queda
  }
}

function limpiarCache(): void {
  if (esWeb) {
    for (const url of enMemoria.values()) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // nada
      }
    }
    enMemoria.clear();
    return;
  }
  try {
    const dir = new Directory(Paths.cache, "storage");
    if (dir.exists) dir.delete();
  } catch {
    // nada que limpiar
  }
}

/** True si el archivo local sigue disponible (en la web se prueba con un pedido a la uri `blob:`). */
export async function existeArchivoLocal(uri: string): Promise<boolean> {
  try {
    if (esWeb) {
      const r = await fetch(uri);
      return r.ok;
    }
    return new File(uri).exists;
  } catch {
    return false;
  }
}

/** Borra un archivo local que ya se usó (no falla si no existe; en la web se libera la uri `blob:`). */
export function borrarArchivoLocal(uri: string): void {
  try {
    if (esWeb) {
      if (uri.startsWith("blob:")) URL.revokeObjectURL(uri);
      return;
    }
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // nada
  }
}

/**
 * Fotos y archivos que viven en Storage. Se descargan una sola vez a la carpeta de caché del teléfono (en la web, a
 * una uri `blob:` en memoria) y desde ahí se muestran; las fotos nuevas se achican antes de subirlas.
 */
export const Imagenes = {
  BUCKET_FOTOS: "fotos",
  uriEnCache,
  archivoLocal,
  bytesDe,
  prepararFoto,
  subirFoto,
  borrarFoto,
  limpiarCache,
};
