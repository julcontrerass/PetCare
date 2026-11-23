import type { ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Colores, sombra } from "./tema";
import { useTeclaEscape } from "./Web";

export interface DialogoCentralProps {
  visible: boolean;
  alCerrar: () => void;
  /** Si es false no se cierra tocando afuera, con atrás ni con Escape. Por defecto true. */
  cancelable?: boolean;
  /** Ancho máximo en dp; 420 por defecto (en el celular es el 88% de la pantalla, como el cartel de Android). */
  anchoMaximo?: number;
  /** Relleno interno; por defecto 20. */
  relleno?: number;
  estilo?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/** Ventana centrada sobre fondo oscuro (el AlertDialog de Android): base de los carteles y los selectores. */
export function DialogoCentral({ visible, alCerrar, cancelable = true, anchoMaximo = 420, relleno = 20, estilo, children }: DialogoCentralProps) {
  const cerrar = () => {
    if (cancelable) alCerrar();
  };
  useTeclaEscape(visible && cancelable, cerrar);
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={cerrar}>
      <View style={estilos.centro}>
        <Pressable accessibilityLabel="Cerrar" accessible={false} style={estilos.fondo} onPress={cerrar} />
        <View style={[estilos.caja, { maxWidth: anchoMaximo, padding: relleno }, estilo]} accessibilityViewIsModal>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
  fondo: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.5)" },
  caja: { width: "100%", maxHeight: "92%", backgroundColor: Colores.white, borderRadius: 20, ...sombra(4) },
});
