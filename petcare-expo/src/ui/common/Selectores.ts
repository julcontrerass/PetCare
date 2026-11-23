import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

/** Un archivo elegido en el teléfono o en el navegador. */
export interface ArchivoElegido {
  uri: string;
  nombre: string;
  /** Tamaño en bytes, si el sistema lo informa. */
  tamano: number | null;
  tipoMime: string | null;
}

/**
 * Abre la galería (o la cámara) y devuelve la uri de la imagen elegida; null si el usuario cancela o no da el
 * permiso. Equivale a `pedirImagen`/`pedirFoto` de las Activity de Android. En la web abre el selector de archivos.
 */
export async function elegirImagen(opciones: { camara?: boolean; editar?: boolean; aspecto?: [number, number] } = {}): Promise<string | null> {
  const { camara = false, editar = false, aspecto } = opciones;
  try {
    if (Platform.OS !== "web") {
      const permiso = camara
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permiso.granted) return null;
    }
    const pedido = { mediaTypes: ["images"] as ImagePicker.MediaType[], allowsEditing: editar, aspect: aspecto, quality: 1 };
    const resultado = camara ? await ImagePicker.launchCameraAsync(pedido) : await ImagePicker.launchImageLibraryAsync(pedido);
    if (resultado.canceled) return null;
    return resultado.assets[0]?.uri ?? null;
  } catch {
    return null;
  }
}

/** Abre el selector de documentos y devuelve el archivo elegido; null si se cancela. Equivale a `pedirArchivo`. */
export async function elegirArchivo(tipos: string | string[] = "*/*"): Promise<ArchivoElegido | null> {
  try {
    const resultado = await DocumentPicker.getDocumentAsync({ type: tipos, copyToCacheDirectory: true, multiple: false });
    if (resultado.canceled) return null;
    const a = resultado.assets[0];
    if (!a) return null;
    return { uri: a.uri, nombre: a.name, tamano: a.size ?? null, tipoMime: a.mimeType ?? null };
  } catch {
    return null;
  }
}
