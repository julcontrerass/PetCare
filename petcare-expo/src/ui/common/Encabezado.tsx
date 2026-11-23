import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { BotonIcono } from "./BotonIcono";
import { Texto } from "./Texto";

export interface EncabezadoProps {
  titulo: string;
  subtitulo?: string;
  /** Si se da, muestra el botón "Volver atrás" a la izquierda. */
  alVolver?: () => void;
  /** Acción a la derecha (por ejemplo un `BotonIcono` de agregar). */
  derecha?: ReactNode;
  estilo?: StyleProp<ViewStyle>;
}

/** Encabezado de pantalla: botón volver, título (24 bold) y subtítulo (13 gris) y una acción a la derecha. */
export function Encabezado({ titulo, subtitulo, alVolver, derecha, estilo }: EncabezadoProps) {
  return (
    <View style={[estilos.fila, estilo]}>
      {alVolver ? <BotonIcono icono="volver" accessibilityLabel="Volver atrás" onPress={alVolver} estilo={estilos.volver} /> : null}
      <View style={estilos.textos}>
        <Texto variante="titulo" numberOfLines={2} accessibilityRole="header">{titulo}</Texto>
        {subtitulo ? <Texto variante="subtitulo" tamano={13} numberOfLines={2}>{subtitulo}</Texto> : null}
      </View>
      {derecha ? <View style={estilos.derecha}>{derecha}</View> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center", paddingTop: 12, paddingBottom: 8 },
  volver: { marginRight: 14 },
  textos: { flex: 1, minWidth: 0 },
  derecha: { marginLeft: 14, flexDirection: "row", alignItems: "center" },
});
