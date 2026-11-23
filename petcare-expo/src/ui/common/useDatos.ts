import { useSyncExternalStore } from "react";
import { Servicios } from "../../data/servicios";

/**
 * Hace que la pantalla se vuelva a dibujar cuando los repositorios avisan que los datos cambiaron
 * (`Servicios.avisarCambio()`). Se llama al principio del componente y se leen los repositorios en el render.
 * Devuelve la versión de los datos.
 */
export function useDatos(): number {
  return useSyncExternalStore(
    (alCambiar) => Servicios.suscribir(alCambiar),
    () => Servicios.versionDatos,
    () => Servicios.versionDatos,
  );
}
