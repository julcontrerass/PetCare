import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Colores } from "./tema";
import { Diseno } from "./Diseno";
import { Icono, type NombreIcono } from "./Icono";
import { Texto } from "./Texto";
import { cursorTocable, estiloFoco, useFoco } from "./Web";

export type VarianteBoton = "primario" | "secundario" | "peligro" | "peligroContorno" | "suave" | "texto";

const ESTILOS: Record<VarianteBoton, { fondo: string; texto: string; borde?: string }> = {
  primario: { fondo: Colores.primaryTeal, texto: Colores.white },
  secundario: { fondo: Colores.white, texto: Colores.brandNavy, borde: Colores.loginFieldStroke }, // OutlinedButton
  peligro: { fondo: Colores.dangerRed, texto: Colores.white },
  /** Blanco con texto y borde rojos (Cerrar sesión del perfil). */
  peligroContorno: { fondo: Colores.white, texto: Colores.dangerRed, borde: Colores.dangerRed },
  suave: { fondo: Colores.lightTeal, texto: Colores.primaryTeal },
  texto: { fondo: "transparent", texto: Colores.primaryTeal }, // TextButton
};

export interface BotonProps {
  titulo: string;
  onPress?: () => void;
  variante?: VarianteBoton;
  icono?: NombreIcono;
  deshabilitado?: boolean;
  /** Muestra un indicador y no responde a toques. */
  cargando?: boolean;
  /** Alto en dp; 52 por defecto (Diseno.ALTO_BOTON). */
  alto?: number;
  /** Para el contenedor (márgenes, flex, ancho). */
  estilo?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/** Botón redondeado como los MaterialButton del Android (alto 52, extremos redondos). */
export function Boton({
  titulo, onPress, variante = "primario", icono, deshabilitado, cargando, alto = Diseno.ALTO_BOTON, estilo, accessibilityLabel,
}: BotonProps) {
  const e = ESTILOS[variante];
  const inactivo = !!deshabilitado || !!cargando;
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? titulo}
      accessibilityState={{ disabled: !!deshabilitado, busy: !!cargando }}
      disabled={inactivo}
      onPress={onPress}
      {...foco.props}
      style={({ pressed }) => [
        estilos.base,
        { height: alto, borderRadius: alto / 2, backgroundColor: e.fondo },
        e.borde ? { borderWidth: 1, borderColor: e.borde } : null,
        deshabilitado ? estilos.deshabilitado : null,
        pressed ? estilos.presionado : null,
        cursorTocable,
        estiloFoco(foco.enfocado),
        estilo,
      ]}
    >
      <View style={estilos.contenido}>
        {cargando ? (
          <ActivityIndicator color={e.texto} />
        ) : (
          <>
            {icono ? <Icono nombre={icono} tamano={20} color={e.texto} estilo={estilos.icono} /> : null}
            <Texto variante="boton" color={e.texto} numberOfLines={1} style={estilos.texto}>
              {titulo}
            </Texto>
          </>
        )}
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: { minWidth: Diseno.AREA_TACTIL, paddingHorizontal: 20, justifyContent: "center", alignSelf: "stretch" },
  contenido: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  icono: { marginRight: 8 },
  texto: { flexShrink: 1 },
  deshabilitado: { opacity: 0.45 },
  presionado: { opacity: 0.85 },
});

