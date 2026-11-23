import { router } from "expo-router";
import { Sesion, type Rol } from "../../data/sesion";
import { Errores } from "../../util/errores";
import { Avisos } from "./Avisos";

/** Pasa de usar la cuenta como dueño a usarla como veterinario (y al revés) sin cerrar la sesión (ModoDeUso.kt). */
export const ModoDeUso = {
  async cambiar(nuevo: Rol): Promise<void> {
    try {
      await Sesion.cambiarModo(nuevo);
      router.replace(nuevo === "VETERINARIO" ? "/vet" : "/dueno");
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
    }
  },
};
