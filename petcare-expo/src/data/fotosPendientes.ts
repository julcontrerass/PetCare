/* Migrado de data/FotosPendientes.kt (las SharedPreferences pasan a AsyncStorage, que en la web usa localStorage). */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { JsonObject } from "./remoto/dtos";
import { CredencialVet } from "./credencialVet";
import { borrarArchivoLocal, existeArchivoLocal, Imagenes } from "./imagenes";
import { Servicios } from "./servicios";

/** Prefijo de las claves (era el nombre del archivo de preferencias). */
const ARCHIVO = "petcare_pendientes:";

const clavePerfil = (email: string) => ARCHIVO + email.toLowerCase();
const claveCredencial = (email: string) => ARCHIVO + email.toLowerCase() + "#credencial";

async function leer(clave: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(clave);
  } catch {
    return null;
  }
}

async function escribir(clave: string, valor: string): Promise<void> {
  try {
    await AsyncStorage.setItem(clave, valor);
  } catch {
    // sin almacenamiento: las fotos no quedan pendientes
  }
}

async function quitar(clave: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(clave);
  } catch {
    // nada
  }
}

const textoONull = (v: unknown): string | null => (typeof v === "string" ? v : null);

/**
 * Las fotos que se eligen durante el registro no se pueden subir hasta que hay una sesión abierta, y si el
 * proyecto pide confirmar el correo eso pasa recién en el primer ingreso. Hasta entonces quedan guardadas en el
 * teléfono y se suben solas la primera vez que la cuenta puede usar la app.
 * (En la web las uris son `blob:` y no sobreviven a recargar la página: si pasa, la foto simplemente no se sube.)
 */
export const FotosPendientes = {
  /** [mascotas] son pares nombre de la mascota a uri de su foto en el teléfono. */
  async guardar(email: string, fotoPerfil: string | null, mascotas: [string, string][]): Promise<void> {
    if (fotoPerfil == null && mascotas.length === 0) return;
    const datos: JsonObject = {
      mascotas: mascotas.map(([nombre, ruta]) => ({ nombre, ruta })),
    };
    if (fotoPerfil != null) datos.perfil = fotoPerfil;
    await escribir(clavePerfil(email), JSON.stringify(datos));
  },

  /**
   * La foto del carnet se guarda aparte de las otras: se puede subir aunque la cuenta todavía esté en revisión
   * (el bucket `credenciales` no pide cuenta activa), y es justamente lo que el administrador necesita para revisarla.
   */
  async guardarCredencial(email: string, ruta: string): Promise<void> {
    await escribir(claveCredencial(email), ruta);
  },

  /** Sube el carnet pendiente de [email], si hay. Devuelve true si quedó cargado. */
  async subirCredencial(email: string, usuarioId: string): Promise<boolean> {
    const clave = claveCredencial(email);
    const ruta = await leer(clave);
    if (ruta == null) return false;
    if (!(await existeArchivoLocal(ruta))) {
      await quitar(clave);
      return false;
    }
    try {
      const preparada = await Imagenes.prepararFoto(ruta);
      const subida = await CredencialVet.subirArchivo(preparada, usuarioId);
      await Servicios.fuente.guardarCredencial(subida);
      borrarArchivoLocal(preparada);
      borrarArchivoLocal(ruta);
      await quitar(clave);
      return true;
    } catch {
      return false;
    }
  },

  /** Sube lo que haya pendiente para [email]. Devuelve true si cambió la foto del perfil. */
  async subir(email: string, usuarioId: string): Promise<boolean> {
    const clave = clavePerfil(email);
    const texto = await leer(clave);
    if (texto == null) return false;
    let datos: Record<string, unknown> | null = null;
    try {
      const json: unknown = JSON.parse(texto);
      if (json !== null && typeof json === "object" && !Array.isArray(json)) datos = json as Record<string, unknown>;
    } catch {
      datos = null;
    }
    if (datos == null) {
      await quitar(clave);
      return false;
    }
    let cambioElPerfil = false;
    const rutaPerfil = textoONull(datos.perfil);
    if (rutaPerfil != null) {
      try {
        const foto = await Imagenes.subirFoto(await Imagenes.prepararFoto(rutaPerfil), usuarioId);
        await Servicios.fuente.actualizarPerfil({ foto_path: foto });
        borrarArchivoLocal(rutaPerfil);
        cambioElPerfil = true;
      } catch {
        // la foto de perfil se pierde, como en la app Android
      }
    }
    const mascotas = Array.isArray(datos.mascotas) ? (datos.mascotas as unknown[]) : [];
    if (mascotas.length > 0) {
      try {
        const creadas = await Servicios.fuente.misMascotas();
        for (const item of mascotas) {
          const m = (item !== null && typeof item === "object" ? item : {}) as Record<string, unknown>;
          const nombre = textoONull(m.nombre);
          if (nombre == null) continue;
          const ruta = textoONull(m.ruta);
          if (ruta == null) continue;
          const creada = creadas.find((c) => c.nombre === nombre);
          if (!creada) continue;
          const foto = await Imagenes.subirFoto(await Imagenes.prepararFoto(ruta), usuarioId);
          await Servicios.fuente.actualizarMascota(creada.id, { foto_path: foto });
          borrarArchivoLocal(ruta);
        }
      } catch {
        // si falla una, las que faltan no se suben
      }
    }
    await quitar(clave);
    return cambioElPerfil;
  },
};
