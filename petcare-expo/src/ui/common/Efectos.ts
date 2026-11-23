/** Animaciones cortas que se repiten en la interfaz (port de Efectos.kt). */
import { useCallback, useEffect, useRef } from "react";
import { Animated, Easing, type StyleProp, type ViewStyle } from "react-native";

/**
 * Pequeño "rebote" al tocar un botón (Efectos.rebote). Devuelve `{ estilo, rebotar }`: se aplica `estilo` a un
 * `Animated.View` y se llama a `rebotar()` en el `onPress`.
 */
export function useRebote(): { estilo: Animated.WithAnimatedValue<StyleProp<ViewStyle>>; rebotar: () => void } {
  const escala = useRef(new Animated.Value(1)).current;
  const rebotar = useCallback(() => {
    escala.stopAnimation();
    escala.setValue(0.92);
    Animated.timing(escala, { toValue: 1, duration: 220, easing: Easing.out(Easing.back(4)), useNativeDriver: true }).start();
  }, [escala]);
  return { estilo: { transform: [{ scale: escala }] }, rebotar };
}

/**
 * Aparece desde abajo, para cuando cambia el paso de un asistente (Efectos.entradaDePaso). Se aplica `estilo` a un
 * `Animated.View`; la animación corre cada vez que cambia [paso].
 */
export function useEntradaDePaso(paso: unknown, desplazamiento = 24): Animated.WithAnimatedValue<StyleProp<ViewStyle>> {
  const progreso = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    progreso.setValue(0);
    Animated.timing(progreso, { toValue: 1, duration: 280, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [paso, progreso]);
  return { opacity: progreso, transform: [{ translateY: progreso.interpolate({ inputRange: [0, 1], outputRange: [desplazamiento, 0] }) }] };
}
