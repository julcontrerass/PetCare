/* Botón con contorno de color (los MaterialButton OutlinedButton de las hojas del administrador). */
import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Icono, type NombreIcono } from "../common/Icono";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";

export interface BotonContornoProps {
  titulo: string;
  onPress?: () => void;
  /** Color del contorno, del texto y del ícono (verde azulado o rojo). */
  color?: string;
  icono?: NombreIcono;
  deshabilitado?: boolean;
  cargando?: boolean;
  alto?: number;
  estilo?: StyleProp<ViewStyle>;
}

export function BotonContorno({
  titulo, onPress, color = Colores.primaryTeal, icono, deshabilitado, cargando, alto = 50, estilo,
}: BotonContornoProps) {
  const foco = useFoco();
  const inactivo = !!deshabilitado || !!cargando;
  const tinta = deshabilitado ? Colores.textGray : color;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={titulo}
      accessibilityState={{ disabled: !!deshabilitado, busy: !!cargando }}
      disabled={inactivo}
      onPress={onPress}
      {...foco.props}
      style={({ pressed }) => [
        estilos.base,
        { height: alto, borderRadius: alto / 2, borderColor: deshabilitado ? Colores.loginFieldStroke : color },
        pressed ? { opacity: 0.8 } : null,
        deshabilitado ? { opacity: 0.7 } : null,
        cursorTocable,
        estiloFoco(foco.enfocado),
        estilo,
      ]}
    >
      {cargando ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          {icono ? <Icono nombre={icono} tamano={20} color={tinta} estilo={estilos.icono} /> : null}
          <Texto variante="boton" tamano={15} color={tinta} numberOfLines={1}>{titulo}</Texto>
        </>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    paddingHorizontal: 16,
    backgroundColor: "transparent",
  },
  icono: { marginRight: 8 },
});
