import { useContext } from "react";
import { SafeAreaInsetsContext, type EdgeInsets } from "react-native-safe-area-context";

const SIN_MARGENES: EdgeInsets = { top: 0, bottom: 0, left: 0, right: 0 };

/**
 * Márgenes seguros del dispositivo (muesca, barra de estado, barra de gestos). Igual que `useSafeAreaInsets`,
 * pero devuelve ceros si no hay un `SafeAreaProvider` (pruebas, web).
 */
export function useMargenes(): EdgeInsets {
  return useContext(SafeAreaInsetsContext) ?? SIN_MARGENES;
}
