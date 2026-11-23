import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Colores } from "./tema";
import { Icono, type NombreIcono } from "./Icono";
import { Tarjeta } from "./Tarjeta";
import { Texto } from "./Texto";
import { cursorTocable, estiloFoco, useFoco } from "./Web";

export interface EstadoVacioProps {
  icono: NombreIcono;
  titulo: string;
  mensaje: string;
  /** Texto del botón; el botón solo se muestra si se dan `textoBoton` y `alBoton`. */
  textoBoton?: string;
  alBoton?: () => void;
  estilo?: StyleProp<ViewStyle>;
}

/** Tarjeta "no hay nada todavía" (view_empty_state / Componentes.estadoVacio). */
export function EstadoVacio({ icono, titulo, mensaje, textoBoton, alBoton, estilo }: EstadoVacioProps) {
  const foco = useFoco();
  return (
    <Tarjeta estilo={[estilos.tarjeta, estilo]}>
      <View style={estilos.circulo}>
        <Icono nombre={icono} tamano={24} color={Colores.primaryTeal} />
      </View>
      <Texto variante="etiqueta" tamano={14} centrado style={estilos.titulo}>{titulo}</Texto>
      <Texto variante="chico" tamano={12} centrado style={estilos.mensaje}>{mensaje}</Texto>
      {textoBoton && alBoton ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={textoBoton}
          onPress={alBoton}
          hitSlop={8}
          {...foco.props}
          style={[estilos.cta, cursorTocable, estiloFoco(foco.enfocado)]}
        >
          <Texto variante="etiqueta" tamano={13} color={Colores.primaryTeal}>{textoBoton}</Texto>
        </Pressable>
      ) : null}
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { alignItems: "center", marginTop: 10, marginBottom: 2 },
  circulo: { width: 46, height: 46, borderRadius: 23, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
  titulo: { marginTop: 8 },
  mensaje: { marginTop: 3 },
  cta: {
    marginTop: 10,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colores.primaryTeal,
  },
});
