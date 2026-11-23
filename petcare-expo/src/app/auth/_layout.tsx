import { Stack } from "expo-router";

/** Ingreso y registros: una pila sin encabezado (cada pantalla dibuja el suyo). */
export default function LayoutAuth() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
