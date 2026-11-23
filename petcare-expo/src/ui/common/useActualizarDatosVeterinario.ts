import { useCallback } from "react";
import { useFocusEffect } from "expo-router";
import { Servicios } from "../../data/servicios";
import { Sesion } from "../../data/sesion";

/** Cada cuánto se piden los turnos y avisos nuevos mientras la pantalla está a la vista (ms). */
const INTERVALO_MS = 15_000;

/**
 * Port de `BaseActivity.actualizarDatosVeterinario`: mientras la pantalla del veterinario está enfocada vuelve a
 * pedir sus datos al servidor al entrar y cada 15 segundos, y avisa el cambio (`Servicios.avisarCambio()`) para que
 * las pantallas con `useDatos()` se redibujen. Un solo ciclo por pantalla, que se cancela al salir.
 */
export function useActualizarDatosVeterinario(): void {
  useFocusEffect(
    useCallback(() => {
      let vigente = true;
      const recargar = async () => {
        try {
          await Sesion.recargarVeterinario();
          if (vigente) Servicios.avisarCambio();
        } catch {
          // Igual que runCatching: un fallo de red no rompe la pantalla, se reintenta en el próximo ciclo
        }
      };
      void recargar();
      const id = setInterval(() => void recargar(), INTERVALO_MS);
      return () => {
        vigente = false;
        clearInterval(id);
      };
    }, []),
  );
}
