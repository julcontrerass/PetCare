/*
 * Migrado de ui/veterinario/HomeVeterinarioActivity.kt: el contenedor de la app del veterinario. Una barra inferior fija
 * (`BarraVet`) y, arriba, la pestaña que se esté viendo. Además de la barra: exige sesión, redibuja con los datos,
 * recarga los datos del veterinario mientras está a la vista, pide el permiso de notificaciones una vez, muestra el
 * panel de avisos cuando se toca la campana de Inicio y atiende el pedido de foto del perfil.
 * Atrás desde otra pestaña vuelve a Inicio (`backBehavior="firstRoute"`; en Android, `OnBackPressedCallback`).
 */
import { Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { elegirImagen } from "../common/Selectores";
import { NotificacionesVetPanel } from "../common/NotificacionesVetPanel";
import { pedirPermisoDeNotificaciones } from "../common/permisoNotificaciones";
import { useActualizarDatosVeterinario } from "../common/useActualizarDatosVeterinario";
import { useDatos } from "../common/useDatos";
import { useSesionRequerida } from "../common/useSesionRequerida";
import { useEscritorio } from "../common/Web";
import { BarraVet } from "./BarraVet";
import { EstadoCascaron } from "./estadoCascaronVet";
import { NavVet } from "./navegacionVet";
import { RutaDeSeccion, seccionDeRuta, type SeccionVet } from "./SeccionVet";

/** Lo que se usa de las props de `tabBar` (estructural: no depende de los tipos internos de react-navigation). */
interface BarraProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigateToTab: (claveDeRuta: string) => void;
}

function BarraDePestanas({ state, navigateToTab }: BarraProps) {
  const actual = seccionDeRuta(state.routes[state.index]?.name ?? "") ?? "inicio";
  const elegir = (s: SeccionVet) => {
    const ruta = state.routes.find((r) => r.name === RutaDeSeccion[s]);
    if (ruta && s !== actual) navigateToTab(ruta.key);
  };
  return <BarraVet seleccionada={actual} alElegir={elegir} alAgregar={() => NavVet.agregarConsulta()} />;
}

export function CascaronVet() {
  const activa = useSesionRequerida();
  useDatos();
  useActualizarDatosVeterinario();
  const [avisos, setAvisos] = useState(false);
  // En escritorio las solapas están en el menú lateral (MarcoConMenu en src/app/vet/_layout.tsx)
  const escritorio = useEscritorio();

  useEffect(() => {
    EstadoCascaron.manejadorAvisos = () => setAvisos(true);
    EstadoCascaron.manejadorFoto = (alElegir) => {
      void elegirImagen({ editar: true, aspecto: [1, 1] }).then((uri) => {
        if (uri) alElegir(uri);
      });
    };
    void pedirPermisoDeNotificaciones();
    return () => {
      EstadoCascaron.manejadorAvisos = null;
      EstadoCascaron.manejadorFoto = null;
    };
  }, []);

  if (!activa) return null;
  return (
    <>
      <Tabs
        backBehavior="firstRoute"
        screenOptions={{ headerShown: false }}
        tabBar={(props) => (escritorio ? null : <BarraDePestanas {...props} />)}
      >
        <Tabs.Screen name="index" options={{ title: "Inicio" }} />
        <Tabs.Screen name="pacientes" options={{ title: "Pacientes" }} />
        <Tabs.Screen name="agenda" options={{ title: "Agenda" }} />
        <Tabs.Screen name="perfil" options={{ title: "Perfil" }} />
      </Tabs>
      <NotificacionesVetPanel visible={avisos} alCerrar={() => setAvisos(false)} />
    </>
  );
}
