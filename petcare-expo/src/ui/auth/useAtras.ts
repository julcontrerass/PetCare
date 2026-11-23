/*
 * `onBackPressedDispatcher.addCallback`: intercepta el botón atrás del sistema (Android). En la web no existe: el
 * botón del navegador sigue su camino y no se intercepta.
 */
import { useCallback, useRef } from "react";
import { BackHandler, Platform } from "react-native";
import { useFocusEffect } from "expo-router";

export function useAtras(alAtras: () => void): void {
  const ultima = useRef(alAtras);
  ultima.current = alAtras;
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "web") return undefined;
      const suscripcion = BackHandler.addEventListener("hardwareBackPress", () => {
        ultima.current();
        return true;
      });
      return () => suscripcion.remove();
    }, []),
  );
}
