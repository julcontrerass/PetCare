/*
 * Migrado de PetCareApp.kt (Application.onCreate). Se llama una vez al arrancar la app, antes de dibujar la
 * primera pantalla. Corre igual en Android, iOS y la web.
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { AvisosDelSistema } from "./avisos/avisosDelSistema";
import { Servicios } from "./servicios";
import { Sesion } from "./sesion";

let iniciada = false;

/**
 * Crea los canales de notificación y deja configurados los ganchos que no dependen de la interfaz: cómo se
 * muestran las notificaciones con la app a la vista y por dónde salen los avisos en pantalla.
 *
 * Quedan para la interfaz (se anota después de llamar a esta función): `Sesion.alAvisar`,
 * `Sesion.alVolverAlIngreso` y `Servicios.alMostrarError` (si no se configura, los errores salen por `Sesion.alAvisar`).
 */
export async function iniciarApp(): Promise<void> {
  if (iniciada) return;
  iniciada = true;

  // Los avisos dentro de la pantalla salen por el mismo gancho que usa la sesión
  AvisosDelSistema.alAvisarEnPantalla = (mensaje) => Sesion.alAvisar?.(mensaje);
  Servicios.alMostrarError ??= (mensaje) => Sesion.alAvisar?.(mensaje);

  // En la web no hay notificaciones locales programadas ni canales: no hay nada más que preparar
  if (Platform.OS === "web") return;

  try {
    // Como en Android, un recordatorio se muestra aunque la app esté abierta
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // sin manejador las notificaciones con la app abierta no se ven, pero el resto funciona
  }
  await AvisosDelSistema.crearCanales();
}
