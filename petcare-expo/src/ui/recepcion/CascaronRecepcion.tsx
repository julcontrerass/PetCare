/*
 * Contenedor del modo recepción (como CascaronVet): la barra inferior con Hoy, Agenda, Pacientes y Perfil (en
 * escritorio, el menú lateral), y mientras está a la vista vuelve a pedir los turnos cada 15 segundos.
 */
import { Tabs, useFocusEffect } from "expo-router";
import { useCallback, useEffect } from "react";
import { RecepcionAgendaRepo } from "../../data/repositorio/recepcionAgendaRepo";
import { ClinicasRepo } from "../../data/repositorio/clinicasRepo";
import { Servicios } from "../../data/servicios";
import { pedirPermisoDeNotificaciones } from "../common/permisoNotificaciones";
import { useDatos } from "../common/useDatos";
import { useSesionRequerida } from "../common/useSesionRequerida";
import { useEscritorio } from "../common/Web";
import { BarraRecepcion, RutaDeSeccionRecepcion, type SeccionRecepcion } from "./BarraRecepcion";

const INTERVALO_MS = 15_000;

/** Lo que se usa de las props de `tabBar` (estructural, como en CascaronVet). */
interface BarraProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigateToTab: (claveDeRuta: string) => void;
}

function BarraDePestanas({ state, navigateToTab }: BarraProps) {
  const nombre = state.routes[state.index]?.name ?? "";
  const actual = (Object.entries(RutaDeSeccionRecepcion) as [SeccionRecepcion, string][]).find(([, r]) => r === nombre)?.[0] ?? "hoy";
  const elegir = (s: SeccionRecepcion) => {
    const ruta = state.routes.find((r) => r.name === RutaDeSeccionRecepcion[s]);
    if (ruta && s !== actual) navigateToTab(ruta.key);
  };
  return <BarraRecepcion seleccionada={actual} alElegir={elegir} />;
}

/** Vuelve a pedir los vínculos y la agenda al entrar y cada [INTERVALO_MS] mientras la pantalla está a la vista. */
function useActualizarRecepcion(): void {
  useFocusEffect(
    useCallback(() => {
      let vigente = true;
      const recargar = async () => {
        try {
          await ClinicasRepo.cargar();
          await RecepcionAgendaRepo.cargar();
          if (vigente) Servicios.avisarCambio();
        } catch {
          // un fallo de red no rompe la pantalla: se reintenta en el próximo ciclo
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

export function CascaronRecepcion() {
  const activa = useSesionRequerida();
  useDatos();
  useActualizarRecepcion();
  const escritorio = useEscritorio();

  useEffect(() => {
    void pedirPermisoDeNotificaciones();
  }, []);

  if (!activa) return null;
  return (
    <Tabs
      backBehavior="firstRoute"
      screenOptions={{ headerShown: false }}
      tabBar={(props) => (escritorio ? null : <BarraDePestanas {...props} />)}
    >
      <Tabs.Screen name="index" options={{ title: "Hoy" }} />
      <Tabs.Screen name="agenda" options={{ title: "Agenda" }} />
      <Tabs.Screen name="pacientes" options={{ title: "Pacientes" }} />
      <Tabs.Screen name="perfil" options={{ title: "Perfil" }} />
    </Tabs>
  );
}
