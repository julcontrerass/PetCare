import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Colores } from "./tema";
import { Icono, type NombreIcono } from "./Icono";
import { Texto } from "./Texto";
import { cursorTocable, estiloFoco, useFoco } from "./Web";

/**
 * neutro = bg_chip_neutral, ok = bg_chip_ok, aviso = bg_chip_warn, peligro = bg_chip_danger, info = teal suave,
 * seleccionado = bg_chip_selected, sinSeleccionar = bg_chip_unselected (blanco con borde; para filtros).
 */
export type TonoChip = "neutro" | "ok" | "aviso" | "peligro" | "info" | "seleccionado" | "sinSeleccionar";

const TONOS: Record<TonoChip, { fondo: string; texto: string; borde?: string; radio: number }> = {
  neutro: { fondo: "#EEF2F1", texto: Colores.textGray, radio: 10 },
  ok: { fondo: Colores.lightGreen, texto: Colores.successGreen, radio: 10 },
  aviso: { fondo: Colores.lightOrange, texto: Colores.accentOrangeDark, radio: 10 },
  peligro: { fondo: Colores.lightRed, texto: Colores.dangerRed, radio: 10 },
  info: { fondo: Colores.lightTeal, texto: Colores.primaryTeal, radio: 10 },
  seleccionado: { fondo: Colores.primaryTeal, texto: Colores.white, radio: 8 },
  sinSeleccionar: { fondo: Colores.white, texto: Colores.brandNavy, borde: "#DDDDDD", radio: 8 },
};

export interface ChipProps {
  texto: string;
  tono?: TonoChip;
  icono?: NombreIcono;
  /** Si se da, el chip es tocable (filtros, selección). */
  onPress?: () => void;
  estilo?: StyleProp<ViewStyle>;
}

/** Etiqueta chica de color (estado, filtro). */
export function Chip({ texto, tono = "neutro", icono, onPress, estilo }: ChipProps) {
  const t = TONOS[tono];
  const foco = useFoco();
  const contenido = (
    <>
      {icono ? <Icono nombre={icono} tamano={14} color={t.texto} estilo={estilos.icono} /> : null}
      <Texto variante="etiqueta" tamano={12} color={t.texto}>{texto}</Texto>
    </>
  );
  const caja: StyleProp<ViewStyle> = [
    estilos.chip,
    { backgroundColor: t.fondo, borderRadius: t.radio },
    t.borde ? { borderWidth: 1, borderColor: t.borde } : null,
  ];
  if (!onPress) return <View style={[caja, estilo]}>{contenido}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityState={{ selected: tono === "seleccionado" }}
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      {...foco.props}
      style={[caja, cursorTocable, estiloFoco(foco.enfocado), estilo]}
    >
      {contenido}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  chip: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4 },
  icono: { marginRight: 4 },
});
