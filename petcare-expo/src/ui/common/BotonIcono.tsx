import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Colores, sombra } from "./tema";
import { Diseno } from "./Diseno";
import { Icono, type NombreIcono } from "./Icono";
import { cursorTocable, estiloFoco, useFoco } from "./Web";

export interface BotonIconoProps {
  icono: NombreIcono;
  onPress: () => void;
  /** Obligatorio: es lo que leen los lectores de pantalla (contentDescription). */
  accessibilityLabel: string;
  /** "blanco" (circular_white con elevación, como el botón volver), "suave" (bg_icon_tile) o "ninguno". */
  fondo?: "blanco" | "suave" | "ninguno";
  color?: string;
  tamano?: number;
  estilo?: StyleProp<ViewStyle>;
}

/** Botón redondo con un ícono (volver, agregar, cerrar). Área táctil de al menos 44 dp. */
export function BotonIcono({ icono, onPress, accessibilityLabel, fondo = "blanco", color = Colores.brandNavy, tamano = 22, estilo }: BotonIconoProps) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={4}
      {...foco.props}
      style={({ pressed }) => [
        estilos.base,
        fondo === "blanco" ? estilos.blanco : fondo === "suave" ? estilos.suave : null,
        pressed ? { opacity: 0.8 } : null,
        cursorTocable,
        estiloFoco(foco.enfocado),
        estilo,
      ]}
    >
      <Icono nombre={icono} tamano={tamano} color={color} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: { width: Diseno.AREA_TACTIL, height: Diseno.AREA_TACTIL, borderRadius: Diseno.AREA_TACTIL / 2, alignItems: "center", justifyContent: "center" },
  blanco: { backgroundColor: Colores.white, ...sombra(1) },
  suave: { backgroundColor: Colores.lightTeal, borderRadius: 12 },
});
