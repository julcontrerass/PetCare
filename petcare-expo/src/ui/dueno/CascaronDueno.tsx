/*
 * Migrado de ui/dueno/DuenoActivity.kt (onCreate) + activity_dueno.xml: el cascarón de la app del dueño. Las
 * secciones son rutas de expo-router (src/app/dueno/(tabs)); acá se arma la barra inferior personalizada y lo que
 * hacía `DuenoActivity.onCreate`: pedir sesión, redibujar con los datos, el panel de notificaciones, el primer
 * ingreso, el permiso de avisos y el refresco cada 30 s.
 */
import { Tabs, usePathname, useSegments } from "expo-router";
import { useEffect, useState, useSyncExternalStore } from "react";
import { AppState, BackHandler, Platform, StyleSheet, View } from "react-native";
import { DuenoRepo } from "../../data/repositorio/duenoRepo";
import { Servicios } from "../../data/servicios";
import { Colores } from "../common/tema";
import { NotificacionesDuenoPanel } from "../common/NotificacionesDuenoPanel";
import { pedirPermisoDeNotificaciones } from "../common/permisoNotificaciones";
import { useDatos } from "../common/useDatos";
import { useSesionRequerida } from "../common/useSesionRequerida";
import { useEscritorio } from "../common/Web";
import { BarraInferior, MenuMasOverlay, useCerrarMenuAlCambiar } from "./BarraInferior";
import { PanelNotificacionesDueno } from "./estadoDueno";
import { accionAtras, MenuMas } from "./menuMas";
import { NavDueno } from "./navegacionDueno";
import { PrimerIngresoDialogo } from "./PrimerIngresoDialogo";

export const INTERVALO_ACTUALIZACION_MS = 30_000;

/** Pantallas del grupo: las tres pestañas y las rutas ocultas (la barra queda siempre visible). */
export const PANTALLAS_OCULTAS = [
  "calendario", "perfil", "perfil-editar", "veterinarios", "solicitudes", "mascota-nueva", "mascota/[id]",
  "evento-nuevo", "evento/[id]",
] as const;

function usePanelNotificaciones(): boolean {
  return useSyncExternalStore(
    (o) => PanelNotificacionesDueno.suscribir(o),
    () => PanelNotificacionesDueno.visible,
    () => PanelNotificacionesDueno.visible,
  );
}

/** Mientras la pantalla está a la vista, pide cada 30 s los cambios que hacen los veterinarios. */
function useRefrescoPeriodico(activo: boolean) {
  useEffect(() => {
    if (!activo) return;
    const id = setInterval(() => {
      if (Platform.OS !== "web" && AppState.currentState !== "active") return;
      DuenoRepo.recargarDerivados().then(() => Servicios.avisarCambio(), () => {});
    }, INTERVALO_ACTUALIZACION_MS);
    return () => clearInterval(id);
  }, [activo]);
}

/** El "atrás" del sistema: cierra el menú o, en una sección que no es Inicio, vuelve a Inicio. */
function useAtras(enTabs: boolean, enInicio: boolean) {
  useEffect(() => {
    if (Platform.OS === "web") return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      const accion = accionAtras(enTabs, enInicio, MenuMas.abierto);
      if (accion === "cerrarMenu") MenuMas.cerrar();
      else if (accion === "irAInicio") NavDueno.irAHome();
      return accion !== "sistema";
    });
    return () => sub.remove();
  }, [enTabs, enInicio]);
}

export default function LayoutTabsDueno() {
  const hay = useSesionRequerida();
  useDatos();
  const ruta = usePathname();
  const segmentos = useSegments() as string[];
  const panel = usePanelNotificaciones();
  const escritorio = useEscritorio();
  const [primerCerrado, setPrimerCerrado] = useState(false);
  const enInicio = ruta === "/dueno" || ruta === "/dueno/" || ruta === "/dueno/index";
  const enTabs = segmentos.length === 0 || segmentos.includes("(tabs)");

  useCerrarMenuAlCambiar(ruta);
  useRefrescoPeriodico(hay);
  useAtras(enTabs, enInicio);
  useEffect(() => {
    if (hay) void pedirPermisoDeNotificaciones();
  }, [hay]);

  return (
    <View style={estilos.raiz}>
      <Tabs
        screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: Colores.loginBg } }}
        tabBar={({ state }: { state: { index: number; routes: { name: string }[] } }) =>
          // En escritorio las secciones están en el menú lateral (MarcoDueno)
          escritorio ? null : <BarraInferior ruta={state.routes[state.index]?.name} />
        }
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="mascotas" />
        <Tabs.Screen name="recordatorios" />
        {PANTALLAS_OCULTAS.map((n) => (
          <Tabs.Screen key={n} name={n} />
        ))}
      </Tabs>
      {escritorio ? null : <MenuMasOverlay />}
      <NotificacionesDuenoPanel visible={panel} alCerrar={() => PanelNotificacionesDueno.ocultar()} />
      <PrimerIngresoDialogo
        visible={hay && DuenoRepo.perfil.debeCambiarPassword && !primerCerrado}
        alCerrar={() => setPrimerCerrado(true)}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Colores.loginBg },
});
