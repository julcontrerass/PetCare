import type { ReactNode } from "react";
import { KeyboardAvoidingView, RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { Colores } from "./tema";
import { Diseno } from "./Diseno";
import { Encabezado } from "./Encabezado";
import { ANCHO_COLUMNA } from "./Web";

export interface PantallaBaseProps {
  /** Si se da, se dibuja el [Encabezado] arriba (fijo, no se desplaza). */
  titulo?: string;
  subtitulo?: string;
  alVolver?: () => void;
  /** Acción a la derecha del encabezado. */
  derecha?: ReactNode;
  /** Si el contenido se desplaza (ScrollView). Por defecto true. Con false el contenido llena la pantalla. */
  scroll?: boolean;
  /** Pull-to-refresh: `refrescando` + `alRefrescar` (solo con scroll). */
  refrescando?: boolean;
  alRefrescar?: () => void;
  /** Contenido fijo al pie, sobre el borde inferior (botones de guardar). */
  pie?: ReactNode;
  /** Ancho máximo de la columna central en pantallas anchas (web); 480 por defecto, el administrador usa 1100. */
  anchoMaximo?: number;
  /** Margen horizontal; 20 por defecto (Diseno.MARGEN_PANTALLA). */
  margen?: number;
  /** Bordes que respeta la zona segura; ["top", "bottom"] por defecto. Dentro de pestañas usar ["top"]. */
  bordes?: readonly Edge[];
  /** Fondo; loginBg por defecto. */
  fondo?: string;
  /** Estilo del contenido (el interior del scroll). */
  estiloContenido?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * Base de toda pantalla: zona segura, fondo loginBg, encabezado opcional, contenido con scroll (y refresco) opcional,
 * pie fijo opcional y manejo del teclado. En pantallas anchas centra el contenido en una columna de [anchoMaximo].
 */
export function PantallaBase({
  titulo, subtitulo, alVolver, derecha, scroll = true, refrescando, alRefrescar, pie, anchoMaximo = ANCHO_COLUMNA,
  margen = Diseno.MARGEN_PANTALLA, bordes = ["top", "bottom"], fondo = Colores.loginBg, estiloContenido, children,
}: PantallaBaseProps) {
  const conEncabezado = titulo != null;
  const relleno = { paddingHorizontal: margen };
  return (
    <SafeAreaView edges={bordes} style={[estilos.raiz, { backgroundColor: fondo }]}>
      <KeyboardAvoidingView behavior="padding" style={estilos.raiz}>
        <View style={[estilos.columna, { maxWidth: anchoMaximo }]}>
          {conEncabezado ? (
            <View style={relleno}>
              <Encabezado titulo={titulo} subtitulo={subtitulo} alVolver={alVolver} derecha={derecha} />
            </View>
          ) : null}
          {scroll ? (
            <ScrollView
              style={estilos.raiz}
              contentContainerStyle={[estilos.contenidoScroll, relleno, estiloContenido]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              refreshControl={
                alRefrescar ? (
                  <RefreshControl refreshing={!!refrescando} onRefresh={alRefrescar} colors={[Colores.primaryTeal]} tintColor={Colores.primaryTeal} />
                ) : undefined
              }
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[estilos.raiz, relleno, estiloContenido]}>{children}</View>
          )}
          {pie ? <View style={[estilos.pie, relleno]}>{pie}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  columna: { flex: 1, width: "100%", alignSelf: "center" },
  contenidoScroll: { flexGrow: 1, paddingTop: 8, paddingBottom: 24 },
  pie: { paddingTop: 10, paddingBottom: 12 },
});
