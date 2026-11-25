import { router } from "expo-router";
import { Sesion, type Rol } from "../../data/sesion";
import { Errores } from "../../util/errores";
import { Avisos } from "./Avisos";

const RUTA: Record<Rol, "/dueno" | "/vet" | "/recepcion" | "/admin"> = {
  DUENO: "/dueno",
  VETERINARIO: "/vet",
  RECEPCIONISTA: "/recepcion",
  ADMIN: "/admin",
};

/** Pasa de un modo de la cuenta a otro (dueño, veterinario, recepción) sin cerrar la sesión (ModoDeUso.kt). */
export const ModoDeUso = {
  async cambiar(nuevo: Rol): Promise<void> {
    try {
      await Sesion.cambiarModo(nuevo);
      router.replace(RUTA[nuevo]);
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
    }
  },
};
