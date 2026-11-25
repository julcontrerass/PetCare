import { Stack, usePathname } from "expo-router";
import { MarcoConMenu } from "../../ui/common/MenuLateral";
import { MenuLateralVet } from "../../ui/veterinario/BarraVet";

/**
 * App del veterinario: una pila sin encabezado. `(tabs)` tiene la barra inferior; el resto (de AgregarConsulta,
 * DetalleEventoVet, DetallePaciente, NuevoDueno, SolicitudesVet y VacunasPendientes) se apila encima, sin barra.
 * En escritorio el menú lateral queda a la izquierda de todas sus pantallas.
 */
export default function LayoutVet() {
  const ruta = usePathname();
  return (
    <MarcoConMenu menu={<MenuLateralVet ruta={ruta} />}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="consulta-nueva" />
        <Stack.Screen name="evento/[id]" />
        <Stack.Screen name="paciente/[id]" />
        <Stack.Screen name="dueno-nuevo" />
        <Stack.Screen name="solicitudes" />
        <Stack.Screen name="vacunas-pendientes" />
      </Stack>
    </MarcoConMenu>
  );
}
