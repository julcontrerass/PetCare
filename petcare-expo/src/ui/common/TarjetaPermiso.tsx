/*
 * Migrado de ui/common/TarjetaPermiso.kt: aviso, arriba de la lista de notificaciones, de que el teléfono tiene
 * apagadas las de la app. No se dibuja si las notificaciones ya están permitidas.
 *
 * Web: solo aparece si el navegador tiene la API `Notification`; "Activar" pide el permiso (los ajustes del navegador
 * no se abren desde la página).
 */
import { useCallback, useEffect, useState } from "react";
import { AppState, Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AvisosDelSistema } from "../../data/avisos/avisosDelSistema";
import { Boton } from "./Boton";
import { Colores } from "./tema";
import { Texto } from "./Texto";

/** True si hay que mostrar el aviso: las notificaciones están apagadas (y, en la web, el navegador las admite). */
async function faltaPermiso(): Promise<boolean> {
  if (Platform.OS === "web" && (globalThis as unknown as { Notification?: unknown }).Notification === undefined) return false;
  try {
    return !(await AvisosDelSistema.permitido());
  } catch {
    return false;
  }
}

export interface TarjetaPermisoProps {
  estilo?: StyleProp<ViewStyle>;
}

/** Devuelve la tarjeta, o nada si las notificaciones del teléfono ya están permitidas. */
export function TarjetaPermiso({ estilo }: TarjetaPermisoProps) {
  const [mostrar, setMostrar] = useState(false);

  const revisar = useCallback(() => {
    void faltaPermiso().then(setMostrar);
  }, []);

  useEffect(() => {
    revisar();
    // Al volver de los ajustes del teléfono se vuelve a mirar
    const suscripcion = AppState.addEventListener("change", (estado) => {
      if (estado === "active") revisar();
    });
    return () => suscripcion.remove();
  }, [revisar]);

  if (!mostrar) return null;

  const activar = async () => {
    if (Platform.OS === "web") await AvisosDelSistema.pedirPermiso();
    else await AvisosDelSistema.abrirAjustes();
    revisar();
  };

  return (
    <View style={[estilos.tarjeta, estilo]} accessibilityRole="alert">
      <Texto variante="etiqueta" tamano={14.5}>Las notificaciones del teléfono están desactivadas</Texto>
      <Texto variante="subtitulo" tamano={13} color={Colores.textGray} style={estilos.mensaje}>
        Activalas para que te avisemos de tus turnos aunque la app esté cerrada.
      </Texto>
      <Boton titulo="Activar" alto={40} onPress={() => void activar()} estilo={estilos.boton} />
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    marginBottom: 14, paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12, borderWidth: 1,
    backgroundColor: Colores.lightOrange, borderColor: Colores.accentOrange,
  },
  mensaje: { paddingTop: 4, paddingBottom: 10 },
  boton: { alignSelf: "flex-start" },
});
