/* Piezas chicas que repiten los formularios: banner informativo (bg_info_banner), casilla de términos y filas. */
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Colores } from "../common/tema";
import { Icono } from "../common/Icono";
import { Texto } from "../common/Texto";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";

/** `bg_info_banner`: fondo #E3F3F1, esquinas de 16, texto teal oscuro de 13.5. */
export function CajaInfo({ texto, color = Colores.tealDark, estilo }: { texto: string; color?: string; estilo?: StyleProp<ViewStyle> }) {
  return (
    <View style={[estilos.info, estilo]}>
      <Texto variante="cuerpo" tamano={13.5} color={color}>{texto}</Texto>
    </View>
  );
}

/** CheckBox con el tilde teal ("Acepto los términos y condiciones"). */
export function Casilla({ texto, marcada, alCambiar, estilo }: { texto: string; marcada: boolean; alCambiar: (m: boolean) => void; estilo?: StyleProp<ViewStyle> }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={texto}
      accessibilityState={{ checked: marcada }}
      onPress={() => alCambiar(!marcada)}
      {...foco.props}
      style={[estilos.casilla, cursorTocable, estiloFoco(foco.enfocado), estilo]}
    >
      <View style={[estilos.caja, marcada ? estilos.cajaMarcada : null]}>
        {marcada ? <Icono nombre="check" tamano={16} color={Colores.white} /> : null}
      </View>
      <Texto variante="cuerpo" style={estilos.textoCasilla}>{texto}</Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  info: { backgroundColor: "#E3F3F1", borderRadius: 16, padding: 14 },
  casilla: { flexDirection: "row", alignItems: "center", minHeight: 44 },
  caja: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: Colores.textGray, alignItems: "center", justifyContent: "center" },
  cajaMarcada: { backgroundColor: Colores.primaryTeal, borderColor: Colores.primaryTeal },
  textoCasilla: { marginLeft: 12, flexShrink: 1 },
});
