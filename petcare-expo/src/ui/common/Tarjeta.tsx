import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Colores, sombra } from "./tema";
import { cursorTocable, estiloFoco, useFoco } from "./Web";

export interface TarjetaProps {
  children?: ReactNode;
  /** Si se da, la tarjeta es tocable. */
  onPress?: () => void;
  /** Aspecto de bg_card_selected (fondo verdoso y borde teal de 2dp). */
  seleccionada?: boolean;
  /** Relleno interno en dp; 16 por defecto. */
  relleno?: number;
  estilo?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Tarjeta blanca (bg_card_white: radio 18, elevación 2dp). */
export function Tarjeta({ children, onPress, seleccionada, relleno = 16, estilo, accessibilityLabel }: TarjetaProps) {
  const foco = useFoco();
  const base: StyleProp<ViewStyle> = [
    estilos.tarjeta,
    // El borde de 2dp ocupa lugar en RN: siempre está (transparente si no está seleccionada) y se descuenta del relleno
    { padding: Math.max(relleno - 2, 0) },
    seleccionada ? estilos.seleccionada : null,
  ];
  if (!onPress) {
    return <View accessibilityLabel={accessibilityLabel} style={[base, estilo]}>{children}</View>;
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: !!seleccionada }}
      onPress={onPress}
      {...foco.props}
      style={({ pressed }) => [base, pressed ? estilos.presionada : null, cursorTocable, estiloFoco(foco.enfocado), estilo]}
    >
      {children}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  tarjeta: {
    backgroundColor: Colores.white,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "transparent",
    ...sombra(1),
  },
  seleccionada: { backgroundColor: "#EAF6F5", borderColor: Colores.primaryTeal },
  presionada: { opacity: 0.92 },
});
