import { Redirect } from "expo-router";

/** Entrada de la app: el ingreso retoma la sesión guardada y lleva a la pantalla de cada rol. */
export default function Entrada() {
  return <Redirect href="/auth" />;
}
