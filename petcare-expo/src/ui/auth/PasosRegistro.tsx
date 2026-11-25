/*
 * Armazón común de activity_registro_dueno.xml y activity_registro_vet.xml: encabezado con "volver" y el paso actual,
 * barra de progreso por segmentos, contenido que se desplaza y barra inferior con "Atrás" y "Continuar".
 */
import { useEffect, useRef, type ReactNode } from "react";
import { Animated, ScrollView, StyleSheet, View } from "react-native";
import { Colores } from "../common/tema";
import { Boton } from "../common/Boton";
import { useEntradaDePaso } from "../common/Efectos";
import { PantallaBase } from "../common/PantallaBase";
import { Icono, type NombreIcono } from "../common/Icono";
import { Texto } from "../common/Texto";
import type { Desplazable } from "./tipos";

export interface PasosRegistroProps {
  /** "Crear cuenta" o "Cuenta profesional". */
  titulo: string;
  /** "Paso 2 de 4 · Domicilio". */
  textoPaso: string;
  /** Cuántos segmentos tiene la barra y cuántos están encendidos (hasta el paso actual, inclusive). */
  total: number;
  encendidos: number;
  /** Cambia con cada paso: reinicia el scroll y dispara la entrada animada. */
  clavePaso: number;
  mostrarAtras: boolean;
  textoSiguiente: string;
  enviando?: boolean;
  alVolver: () => void;
  alAtras: () => void;
  alSiguiente: () => void;
  children?: ReactNode;
}

/** Cabecera de cada paso: recuadro con ícono, título de 24 y subtítulo. */
export function CabeceraPaso({ icono, titulo, subtitulo }: { icono: NombreIcono; titulo: string; subtitulo: string }) {
  return (
    <View>
      <View style={estilos.icono}>
        <Icono nombre={icono} tamano={24} color={Colores.tealDark} />
      </View>
      <Texto variante="titulo" style={estilos.titulo} accessibilityRole="header">{titulo}</Texto>
      <Texto variante="subtitulo" tamano={14} style={estilos.subtitulo}>{subtitulo}</Texto>
    </View>
  );
}

export function PasosRegistro({
  titulo, textoPaso, total, encendidos, clavePaso, mostrarAtras, textoSiguiente, enviando, alVolver, alAtras, alSiguiente, children,
}: PasosRegistroProps) {
  const scroll = useRef<Desplazable>(null);
  const entrada = useEntradaDePaso(clavePaso, 60);
  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
  }, [clavePaso]);
  return (
    <PantallaBase formulario
      titulo={titulo}
      subtitulo={textoPaso}
      alVolver={alVolver}
      scroll={false}
      pie={
        <View style={estilos.barra}>
          {mostrarAtras ? (
            <Boton titulo="Atrás" variante="secundario" alto={54} estilo={{ flex: 1 }} onPress={alAtras} deshabilitado={enviando} />
          ) : null}
          <Boton titulo={textoSiguiente} alto={54} estilo={{ flex: 2 }} onPress={alSiguiente} deshabilitado={enviando} />
        </View>
      }
    >
      <View style={estilos.progreso} accessibilityRole="progressbar" accessibilityLabel={textoPaso}>
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[estilos.segmento, { backgroundColor: i < encendidos ? Colores.primaryTeal : Colores.dividerColor }]} />
        ))}
      </View>
      <ScrollView
        ref={scroll}
        style={estilos.scroll}
        contentContainerStyle={estilos.contenido}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={entrada}>{children}</Animated.View>
      </ScrollView>
    </PantallaBase>
  );
}

const estilos = StyleSheet.create({
  progreso: { flexDirection: "row", height: 5, marginTop: 10, marginHorizontal: -3 },
  segmento: { flex: 1, borderRadius: 3, marginHorizontal: 3 },
  scroll: { flex: 1 },
  contenido: { paddingTop: 22, paddingBottom: 24 },
  icono: { width: 48, height: 48, borderRadius: 12, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
  titulo: { marginTop: 12 },
  subtitulo: { marginTop: 4 },
  barra: { flexDirection: "row", gap: 8 },
});
