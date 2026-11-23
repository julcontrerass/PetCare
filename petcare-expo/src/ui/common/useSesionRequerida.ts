import { useEffect } from "react";
import { router } from "expo-router";
import { Sesion } from "../../data/sesion";

/**
 * Port de `BaseActivity.volverSiNoHaySesion`: si no hay sesión activa (por ejemplo se recargó la página o el
 * sistema mató la app y los datos en memoria ya no están) vuelve al ingreso con `router.replace("/auth")`.
 * Las pantallas del panel lo llaman al empezar. Devuelve true si hay sesión (si no, la pantalla no debe dibujar datos).
 */
export function useSesionRequerida(): boolean {
  const activa = Sesion.activa;
  useEffect(() => {
    if (!activa) router.replace("/auth");
  }, [activa]);
  return activa;
}
