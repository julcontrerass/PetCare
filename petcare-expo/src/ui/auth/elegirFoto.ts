/*
 * Elegir la foto de perfil, de una mascota o del carnet. Reemplaza al GetContent + copiarFoto de las Activities de
 * registro, y al recorte (dialog_crop_photo) con el editor del propio selector (allowsEditing).
 */
import * as ImagePicker from "expo-image-picker";
import { File, Paths } from "expo-file-system";
import { Platform } from "react-native";
import { borrarArchivoLocal } from "../../data/imagenes";
import { Avisos } from "../common/Avisos";

interface OpcionesFoto {
  /** Abre el editor del selector para recortar (foto de perfil o de mascota: cuadrada). */
  recortar?: boolean;
  /** Prefijo del archivo copiado, como "foto_registro". */
  prefijo?: string;
}

/**
 * Deja la imagen elegida en una carpeta que el sistema no vacía (en Android se copiaba a filesDir): las fotos del
 * registro pueden esperar hasta el primer ingreso. En la web la uri `blob:` se usa como viene.
 */
async function conservar(uri: string, prefijo: string): Promise<string> {
  if (Platform.OS === "web") return uri;
  const destino = new File(Paths.document, `${prefijo}_${Date.now()}.jpg`);
  await new File(uri).copy(destino);
  return destino.uri;
}

/** Abre la galería y devuelve la uri de la foto, o null si se canceló o no se pudo leer ("No pudimos cargar la imagen"). */
export async function elegirFoto(opciones: OpcionesFoto = {}): Promise<string | null> {
  const { recortar = false, prefijo = "foto_registro" } = opciones;
  try {
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: recortar,
      aspect: recortar ? [1, 1] : undefined,
      quality: 1,
    });
    if (r.canceled || r.assets.length === 0) return null;
    const uri = r.assets[0].uri;
    try {
      return await conservar(uri, prefijo);
    } catch {
      // si no se puede copiar, la uri del selector sigue sirviendo mientras la app esté abierta
      return uri;
    }
  } catch {
    Avisos.mostrar("No pudimos cargar la imagen");
    return null;
  }
}

/** Descarta una foto elegida que ya no se usa (se reemplazó o se quitó la mascota). */
export function descartarFoto(uri: string | null | undefined): void {
  if (uri) borrarArchivoLocal(uri);
}
