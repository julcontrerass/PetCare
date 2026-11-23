import { router } from "expo-router";

/** Fija los parámetros que ve `useLocalSearchParams` en la prueba y limpia las llamadas anteriores al router. */
export function fijarRuta(parametros: Record<string, string | string[]> = {}) {
  (globalThis as { __parametrosDeRuta?: unknown }).__parametrosDeRuta = parametros;
  for (const funcion of Object.values(router)) {
    if (typeof funcion === "function" && "mockClear" in funcion) (funcion as jest.Mock).mockClear();
  }
}

export const enrutador = router as unknown as {
  push: jest.Mock; replace: jest.Mock; back: jest.Mock; navigate: jest.Mock; dismiss: jest.Mock;
};
