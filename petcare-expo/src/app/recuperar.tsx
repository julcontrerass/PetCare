import { Redirect, useLocalSearchParams } from "expo-router";

/**
 * Con el esquema `petcare://recuperar?code=...` expo-router entrega la ruta `/recuperar?code=...`: se manda a
 * `/auth/recuperar` conservando todos los parámetros.
 */
export default function RecuperarEnlace() {
  const parametros = useLocalSearchParams<Record<string, string | string[]>>();
  return <Redirect href={{ pathname: "/auth/recuperar", params: parametros }} />;
}
