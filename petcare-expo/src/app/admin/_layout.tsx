import { Stack } from "expo-router";

/** Panel del administrador: una sola pantalla (las secciones son pestañas internas), sin encabezado. */
export default function LayoutAdmin() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
