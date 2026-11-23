import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { Avisos } from "./Avisos";

const CLAVE = "petcare_permisos/notificaciones_preguntado";

/**
 * Port de `BaseActivity.pedirPermisoDeNotificaciones`: explica para qué sirven las notificaciones y pide el permiso.
 * Se pregunta una sola vez: si el usuario dice "Ahora no" no se vuelve a insistir. En la web no hace nada (no hay
 * notificaciones programadas).
 */
export async function pedirPermisoDeNotificaciones(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    if ((await Notifications.getPermissionsAsync()).granted) return;
    if ((await AsyncStorage.getItem(CLAVE)) === "1") return;
    await AsyncStorage.setItem(CLAVE, "1");
  } catch {
    return;
  }
  Avisos.confirmar({
    titulo: "Activar notificaciones",
    mensaje:
      "Te avisamos cuando se acerque la fecha de un turno, cuando se agende, cambie o cancele, y cuando " +
      "tu veterinario termine la consulta.",
    textoAceptar: "Activar",
    textoCancelar: "Ahora no",
    peligro: false,
    icono: "notificacion",
    alAceptar: () => {
      void Notifications.requestPermissionsAsync().catch(() => {});
    },
  });
}
