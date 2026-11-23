import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Animated, Dimensions, KeyboardAvoidingView, Modal, PanResponder, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Colores } from "./tema";
import { useMargenes } from "./Margenes";
import { ANCHO_COLUMNA, useTeclaEscape } from "./Web";

export interface HojaInferiorProps {
  visible: boolean;
  alCerrar: () => void;
  children?: ReactNode;
  /** Fracción de la altura de la pantalla (0 a 1) que puede ocupar como máximo; 0.9 por defecto. */
  alturaMaxima?: number;
  /** Si es false el contenido no se desplaza (para listas que ya hacen scroll). Por defecto true. */
  scroll?: boolean;
  /** Contenido fijo debajo del que se desplaza (botones). */
  pie?: ReactNode;
  /** Ancho máximo en pantallas anchas (web); 480 por defecto: se centra en vez de ocupar todo el ancho. */
  anchoMaximo?: number;
  /** Si es false no se cierra tocando afuera, arrastrando ni con Escape. */
  cancelable?: boolean;
}

const DURACION = 240;

/**
 * Hoja que sube desde abajo (bg_sheet_avisos: blanca, esquinas superiores de 28dp, manija). Se cierra tocando
 * afuera, arrastrando la manija hacia abajo, con atrás o con Escape (web). Sube con el teclado.
 */
export function HojaInferior({ visible, alCerrar, children, alturaMaxima = 0.9, scroll = true, pie, anchoMaximo = ANCHO_COLUMNA, cancelable = true }: HojaInferiorProps) {
  const [montada, setMontada] = useState(visible);
  const progreso = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const arrastre = useRef(new Animated.Value(0)).current;
  const margenes = useMargenes();
  const alto = Dimensions.get("window").height;

  const cerrar = useCallback(() => {
    if (cancelable) alCerrar();
  }, [cancelable, alCerrar]);
  useTeclaEscape(visible && cancelable, cerrar);

  useEffect(() => {
    if (visible) {
      setMontada(true);
      arrastre.setValue(0);
      Animated.timing(progreso, { toValue: 1, duration: DURACION, useNativeDriver: true }).start();
    } else if (montada) {
      Animated.timing(progreso, { toValue: 0, duration: 180, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMontada(false);
      });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const cerrarRef = useRef(cerrar);
  cerrarRef.current = cerrar;
  const gesto = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 4,
        onPanResponderMove: (_, g) => arrastre.setValue(Math.max(g.dy, 0)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > 100 || g.vy > 0.8) cerrarRef.current();
          Animated.timing(arrastre, { toValue: 0, duration: 160, useNativeDriver: true }).start();
        },
        onPanResponderTerminate: () => Animated.timing(arrastre, { toValue: 0, duration: 160, useNativeDriver: true }).start(),
      }),
    [arrastre],
  );

  if (!montada) return null;
  const subir = progreso.interpolate({ inputRange: [0, 1], outputRange: [alto * 0.4, 0] });
  const cuerpo = (
    <View style={[estilos.cuerpo, { paddingBottom: Math.max(margenes.bottom, 18) }]}>{children}</View>
  );
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={cerrar}>
      <Animated.View style={[estilos.fondo, { opacity: progreso }]}>
        <Pressable accessible={false} style={StyleSheet.absoluteFill} onPress={cerrar} />
      </Animated.View>
      <KeyboardAvoidingView behavior="padding" style={estilos.columna} pointerEvents="box-none">
        <Animated.View
          accessibilityViewIsModal
          style={[estilos.hoja, { maxWidth: anchoMaximo, maxHeight: alto * alturaMaxima, opacity: progreso, transform: [{ translateY: Animated.add(subir, arrastre) }] }]}
        >
          <View {...(cancelable ? gesto.panHandlers : {})} style={estilos.zonaManija} accessibilityLabel="Arrastrá hacia abajo para cerrar">
            <View style={estilos.manija} />
          </View>
          {scroll ? (
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} bounces={false} style={estilos.scroll}>
              {cuerpo}
            </ScrollView>
          ) : (
            cuerpo
          )}
          {pie ? <View style={[estilos.pie, { paddingBottom: Math.max(margenes.bottom, 18) }]}>{pie}</View> : null}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fondo: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.5)" },
  columna: { flex: 1, justifyContent: "flex-end", alignItems: "center" },
  hoja: {
    width: "100%",
    backgroundColor: Colores.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: "hidden",
  },
  zonaManija: { alignItems: "center", paddingTop: 10, paddingBottom: 6 },
  manija: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#D5DBE1" },
  scroll: { flexGrow: 0, flexShrink: 1 },
  cuerpo: { paddingHorizontal: 22, paddingTop: 10 },
  pie: { paddingHorizontal: 22, paddingTop: 8 },
});
