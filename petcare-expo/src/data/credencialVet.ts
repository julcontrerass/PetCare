/* Migrado de data/CredencialVet.kt */
import { nuevoId } from "../util/uuid";
import { borrarArchivoLocal, Imagenes } from "./imagenes";
import { Servicios } from "./servicios";

/**
 * Foto del carnet o de la matrícula con la que el administrador verifica a un veterinario. Va al bucket privado
 * `credenciales`, en la carpeta del propio usuario, y solo la ve el administrador.
 */
export const CredencialVet = {
  BUCKET: "credenciales",

  /** Sube la foto elegida (ya preparada) y devuelve su ruta en el bucket; todavía no queda registrada en el perfil. */
  async subirArchivo(uriPreparada: string, usuarioId: string): Promise<string> {
    const ruta = `${usuarioId}/${nuevoId()}.jpg`;
    const bytes = await Imagenes.bytesDe(uriPreparada);
    await Servicios.fuente.subir(CredencialVet.BUCKET, ruta, bytes, "image/jpeg");
    return ruta;
  },

  /** Achica la imagen elegida, la sube y la deja registrada en el perfil del veterinario. */
  async subir(uri: string, usuarioId: string): Promise<string> {
    const archivo = await Imagenes.prepararFoto(uri);
    const ruta = await CredencialVet.subirArchivo(archivo, usuarioId);
    await Servicios.fuente.guardarCredencial(ruta);
    borrarArchivoLocal(archivo);
    return ruta;
  },
};
