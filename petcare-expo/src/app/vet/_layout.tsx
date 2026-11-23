import { Stack } from "expo-router";

/**
 * App del veterinario: una pila sin encabezado. `(tabs)` tiene la barra inferior; el resto (de AgregarConsulta,
 * DetalleEventoVet, DetallePaciente, NuevoDueno, SolicitudesVet y VacunasPendientes) se apila encima, sin barra.
 */
export default function LayoutVet() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="consulta-nueva" />
      <Stack.Screen name="evento/[id]" />
      <Stack.Screen name="paciente/[id]" />
      <Stack.Screen name="dueno-nuevo" />
      <Stack.Screen name="solicitudes" />
      <Stack.Screen name="vacunas-pendientes" />
    </Stack>
  );
}
