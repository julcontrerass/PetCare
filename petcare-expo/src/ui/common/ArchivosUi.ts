/*
 * Migrado de ui/common/ArchivosUi.kt: elegir un archivo para subir (PDF, imagen o Word de hasta 15 MB) y abrir con la
 * aplicación del teléfono un archivo guardado en Storage (se baja la primera vez).
 *
 * Android -> Expo: `ActivityResultContracts.GetContent` es `expo-document-picker`; `FileProvider` + `ACTION_VIEW` es
 * `File.preview` de `expo-file-system` (hace el mismo `ACTION_VIEW` en Android y Quick Look en iOS) y compartir es
 * `expo-sharing`. En la web el archivo bajado es una uri `blob:` y abrir es `window.open(url)`.
 */
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import { Imagenes } from "../../data/imagenes";
import { Errores } from "../../util/errores";
import { Avisos } from "./Avisos";

/** Extensión (en minúsculas) -> tipo MIME de lo que el servidor acepta. */
export const TIPOS_ADMITIDOS: Readonly<Record<string, string>> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** El servidor acepta archivos de hasta 15 MB. */
export const TAMANO_MAXIMO = 15 * 1024 * 1024;

/** Un archivo ya leído y validado, listo para subir. */
export interface ArchivoElegido {
  nombre: string;
  extension: string;
  mime: string;
  bytes: Uint8Array;
}

/** Tipo MIME para abrir un archivo según su extensión; un tipo genérico (cualquiera) si no se conoce. */
export function mimeDe(extension: string): string {
  return TIPOS_ADMITIDOS[extension.toLowerCase()] ?? "*/*";
}

function nombreDe(uri: string): string | null {
  const limpio = uri.split("?")[0].split("#")[0];
  const ultimo = limpio.slice(limpio.lastIndexOf("/") + 1);
  if (ultimo === "" || uri.startsWith("blob:") || uri.startsWith("data:")) return null;
  try {
    return decodeURIComponent(ultimo);
  } catch {
    return ultimo;
  }
}

/**
 * Lee el archivo que eligió el usuario y comprueba que el servidor lo va a aceptar (tipo y tamaño). Si no, avisa qué
 * pasó y devuelve null. [nombre] es el que informó el selector (si no, se saca de la uri).
 */
export async function leer(uri: string, nombre?: string | null): Promise<ArchivoElegido | null> {
  const nombreFinal = nombre && nombre.trim() !== "" ? nombre : (nombreDe(uri) ?? "Documento");
  const punto = nombreFinal.lastIndexOf(".");
  const extension = punto >= 0 ? nombreFinal.slice(punto + 1).toLowerCase() : "";
  const mime = TIPOS_ADMITIDOS[extension];
  if (mime === undefined) {
    Avisos.aviso("Formato no admitido. Subí un PDF, una imagen o un documento de Word.");
    return null;
  }
  let bytes: Uint8Array | null;
  try {
    bytes = await Imagenes.bytesDe(uri);
  } catch {
    bytes = null;
  }
  if (bytes === null) {
    Avisos.error("No se pudo leer el archivo elegido.");
    return null;
  }
  if (bytes.length > TAMANO_MAXIMO) {
    Avisos.aviso("El archivo supera los 15 MB");
    return null;
  }
  return { nombre: nombreFinal, extension, mime, bytes };
}

/**
 * Abre el selector de archivos (PDF, imagen o Word) y devuelve el archivo elegido ya validado; null si se canceló o
 * no sirve (en ese caso ya se avisó).
 */
export async function elegir(): Promise<ArchivoElegido | null> {
  let resultado: DocumentPicker.DocumentPickerResult;
  try {
    resultado = await DocumentPicker.getDocumentAsync({
      type: [...new Set(Object.values(TIPOS_ADMITIDOS))],
      copyToCacheDirectory: true,
      multiple: false,
    });
  } catch (e) {
    Avisos.error(Errores.mensaje(e));
    return null;
  }
  if (resultado.canceled) return null;
  const asset = resultado.assets[0];
  if (!asset) return null;
  // Se mira el tamaño antes de leerlo para no cargar en memoria un archivo enorme
  if (asset.size != null && asset.size > TAMANO_MAXIMO) {
    const punto = asset.name.lastIndexOf(".");
    if (TIPOS_ADMITIDOS[punto >= 0 ? asset.name.slice(punto + 1).toLowerCase() : ""] !== undefined) {
      Avisos.aviso("El archivo supera los 15 MB");
      return null;
    }
  }
  return leer(asset.uri, asset.name);
}

interface VentanaMinima {
  open?: (url: string, destino: string, rasgos?: string) => unknown;
}

/** Abre una uri en otra pestaña (web). */
function abrirEnPestana(uri: string): void {
  const w = globalThis as unknown as VentanaMinima;
  if (!w.open) throw new Error("No se puede abrir una pestaña nueva");
  w.open(uri, "_blank", "noopener");
}

/** Abre con la aplicación del teléfono un archivo guardado en Storage (lo baja la primera vez). En la web, `window.open`. */
export async function abrir(bucket: string, ruta: string, extension: string): Promise<void> {
  try {
    const uri = await Imagenes.archivoLocal(bucket, ruta);
    if (Platform.OS === "web") {
      abrirEnPestana(uri);
      return;
    }
    const archivo = new File(uri);
    const mimeType = mimeDe(extension);
    if (!(await archivo.canPreview({ mimeType }))) {
      Avisos.aviso("No hay una aplicación para abrir este tipo de archivo");
      return;
    }
    await archivo.preview({ mimeType });
  } catch (e) {
    Avisos.error(Errores.mensaje(e));
  }
}

/**
 * Manda a otra aplicación un archivo guardado en Storage (lo baja la primera vez). En la web no se pueden compartir
 * archivos locales: se abre en otra pestaña.
 */
export async function compartir(bucket: string, ruta: string, extension: string, titulo = "Compartir archivo"): Promise<void> {
  try {
    const uri = await Imagenes.archivoLocal(bucket, ruta);
    if (Platform.OS === "web") {
      abrirEnPestana(uri);
      return;
    }
    if (!(await Sharing.isAvailableAsync())) {
      Avisos.aviso("No hay una aplicación disponible para esta acción");
      return;
    }
    await Sharing.shareAsync(uri, { mimeType: mimeDe(extension), dialogTitle: titulo });
  } catch (e) {
    Avisos.error(Errores.mensaje(e));
  }
}

export const ArchivosUi = { TIPOS_ADMITIDOS, TAMANO_MAXIMO, mimeDe, leer, elegir, abrir, compartir };
