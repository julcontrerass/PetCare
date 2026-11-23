import { Stack } from "expo-router";

/** App del dueño (de DuenoActivity): las secciones con barra inferior y el carnet de salud, que va aparte. */
export default function LayoutDueno() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="carnet" />
    </Stack>
  );
}
