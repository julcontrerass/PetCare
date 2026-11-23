/* Ayudas para mostrar la foto de la credencial sin guardarla en el dispositivo. */
import { esWeb } from "../common/Web";

const ABECEDARIO = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Tipo de imagen según los primeros bytes (la foto se subió como jpg, pero puede ser png o webp). */
export function tipoDeImagen(bytes: Uint8Array): string {
  if (bytes.length > 3 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e) return "image/png";
  if (bytes.length > 11 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) return "image/webp";
  if (bytes.length > 2 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  return "image/jpeg";
}

export function aBase64(bytes: Uint8Array): string {
  const partes: string[] = [];
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    partes.push(
      ABECEDARIO[(n >> 18) & 63] + ABECEDARIO[(n >> 12) & 63] +
        (i + 1 < bytes.length ? ABECEDARIO[(n >> 6) & 63] : "=") +
        (i + 2 < bytes.length ? ABECEDARIO[n & 63] : "="),
    );
  }
  return partes.join("");
}

export interface ImagenEnMemoria {
  uri: string;
  /** Libera la uri `blob:` (en la web); en el teléfono no hay nada que liberar. */
  liberar: () => void;
}

/** Arma una uri para mostrar la imagen directamente desde la memoria: `blob:` en la web y `data:` en el teléfono. */
export function imagenEnMemoria(bytes: Uint8Array): ImagenEnMemoria {
  const tipo = tipoDeImagen(bytes);
  if (esWeb() && typeof URL !== "undefined" && typeof URL.createObjectURL === "function") {
    const copia = new Uint8Array(bytes.byteLength);
    copia.set(bytes);
    const uri = URL.createObjectURL(new Blob([copia], { type: tipo }));
    return { uri, liberar: () => URL.revokeObjectURL(uri) };
  }
  return { uri: `data:${tipo};base64,${aBase64(bytes)}`, liberar: () => {} };
}
