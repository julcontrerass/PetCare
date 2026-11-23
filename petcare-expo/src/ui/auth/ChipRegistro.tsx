/* Port de view_chip_registro.xml (estilo ChipRegistro) y de los ChipGroup del registro. */
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Colores } from "../common/tema";
import { Icono } from "../common/Icono";
import { Texto } from "../common/Texto";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";

export interface ChipRegistroProps {
  texto: string;
  marcado: boolean;
  /** Se llama con el valor nuevo (el chip alterna al tocarlo). */
  alCambiar: (marcado: boolean) => void;
}

/** Chip de selección: blanco con borde gris; marcado, fondo lightTeal, borde teal y tilde (checkedIcon). */
export function ChipRegistro({ texto, marcado, alCambiar }: ChipRegistroProps) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={texto}
      accessibilityState={{ checked: marcado }}
      onPress={() => alCambiar(!marcado)}
      {...foco.props}
      style={[
        estilos.chip,
        { backgroundColor: marcado ? Colores.lightTeal : Colores.white, borderColor: marcado ? Colores.primaryTeal : Colores.loginFieldStroke },
        cursorTocable,
        estiloFoco(foco.enfocado),
      ]}
    >
      {marcado ? <Icono nombre="check" tamano={18} color={Colores.tealDark} estilo={estilos.tilde} /> : null}
      <Texto variante="etiqueta" peso="regular" tamano={13.5} color={marcado ? Colores.tealDark : Colores.brandNavy}>
        {texto}
      </Texto>
    </Pressable>
  );
}

/** ChipGroup: los chips en filas que saltan de línea. */
export function GrupoChips({ children, estilo, espacioVertical = 8 }: { children: React.ReactNode; estilo?: StyleProp<ViewStyle>; espacioVertical?: number }) {
  return <View style={[estilos.grupo, { rowGap: espacioVertical }, estilo]}>{children}</View>;
}

const estilos = StyleSheet.create({
  chip: {
    minHeight: 42,
    borderRadius: 21,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  tilde: { marginRight: 4 },
  grupo: { flexDirection: "row", flexWrap: "wrap", columnGap: 8 },
});
