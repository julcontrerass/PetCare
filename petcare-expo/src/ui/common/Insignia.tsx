import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Colores } from "./tema";
import { Texto } from "./Texto";

/** "9+" a partir de diez, como Insignia.texto. */
export function textoInsignia(cantidad: number): string {
  return cantidad > 9 ? "9+" : String(cantidad);
}

export interface InsigniaProps {
  cantidad: number;
  /** Para posicionarla (por ejemplo `position: "absolute"` sobre la campana). */
  estilo?: StyleProp<ViewStyle>;
}

/** Contador rojo de la campana. No se dibuja si [cantidad] es 0. */
export function Insignia({ cantidad, estilo }: InsigniaProps) {
  if (cantidad <= 0) return null;
  return (
    <View
      accessible
      accessibilityLabel={cantidad === 1 ? "1 notificación sin leer" : `${cantidad} notificaciones sin leer`}
      style={[estilos.caja, estilo]}
    >
      <Texto variante="etiqueta" tamano={11} color={Colores.white} allowFontScaling={false}>{textoInsignia(cantidad)}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 5,
    borderRadius: 10,
    backgroundColor: Colores.dangerRed,
    borderWidth: 1.5,
    borderColor: Colores.white,
    alignItems: "center",
    justifyContent: "center",
  },
});
