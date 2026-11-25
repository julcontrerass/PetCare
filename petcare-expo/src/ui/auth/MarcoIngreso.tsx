/*
 * Marco del ingreso en escritorio (web ancha): a la izquierda el panel de la marca con una ficha clínica de ejemplo
 * sobre la foto de las mascotas; a la derecha el formulario, centrado sobre fondo crema. En el teléfono devuelve el
 * contenido tal cual (la app conserva su diseño de siempre).
 */
import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { Image, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { Icono } from "../common/Icono";
import { Colores, sombra } from "../common/tema";
import { Texto } from "../common/Texto";
import { useEscritorio } from "../common/Web";

const LOGO = require("../../../assets/images/logo_petcare.png") as number;
const MASCOTAS = require("../../../assets/images/mascotas_inicio.png") as number;

/** Ancho de la columna del formulario. */
const ANCHO_FORMULARIO_INGRESO = 400;
/** Alto aproximado de la ficha de ejemplo y del bloque del título (con su margen), para saber si entran juntos. */
const ALTO_FICHA = 220;
const ALTO_TITULARES = 270;

/** Una fila de la ficha de ejemplo. */
function FilaFicha({ icono, color, fondo, titulo, detalle }: { icono: "vacuna" | "calendario" | "receta"; color: string; fondo: string; titulo: string; detalle: string }) {
  return (
    <View style={estilos.filaFicha}>
      <View style={[estilos.iconoFicha, { backgroundColor: fondo }]}>
        <Icono nombre={icono} tamano={18} color={color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Texto tamano={13.5} negrita color={Colores.brandNavy} numberOfLines={1}>{titulo}</Texto>
        <Texto tamano={12} color={Colores.textGray} numberOfLines={1}>{detalle}</Texto>
      </View>
    </View>
  );
}

/** Ficha clínica de ejemplo: muestra de un vistazo qué guarda PetCare. Es decorativa (los lectores de pantalla la saltean). */
function FichaDeEjemplo() {
  return (
    <View style={estilos.ficha} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={estilos.cabeceraFicha}>
        <View style={estilos.inicialFicha}>
          <Texto tamano={18} negrita color={Colores.primaryTeal}>L</Texto>
        </View>
        <View style={{ marginLeft: 12 }}>
          <Texto tamano={16} negrita color={Colores.brandNavy}>Luna</Texto>
          <Texto tamano={12} color={Colores.textGray}>Golden retriever, 4 años</Texto>
        </View>
      </View>
      <FilaFicha icono="vacuna" color={Colores.successGreen} fondo={Colores.lightGreen} titulo="Antirrábica al día" detalle="Aplicada el 12 de marzo" />
      <FilaFicha icono="calendario" color={Colores.primaryTeal} fondo={Colores.lightTeal} titulo="Control anual" detalle="Jueves 10:30 con la Dra. Vera" />
      <FilaFicha icono="receta" color={Colores.accentPurple} fondo={Colores.lightPurple} titulo="Amoxicilina" detalle="Cada 12 horas, por 7 días" />
    </View>
  );
}

/** Panel de la marca: título, ficha de ejemplo y la foto del perro y el gato apoyada abajo. */
function PanelMarca() {
  const { height } = useWindowDimensions();
  // La foto escala con el alto de la ventana para que la ficha y el título no se pisen en pantallas bajas
  const anchoFoto = Math.max(320, Math.min(560, height * 0.62));
  const altoFoto = (anchoFoto * 754) / 1100;
  // La ficha se apoya justo sobre la cabeza del perro; si la ventana es baja no entra sin tapar el título y se omite
  const conFicha = height - altoFoto * 0.9 - ALTO_FICHA >= ALTO_TITULARES;
  return (
    <LinearGradient colors={[Colores.primaryTeal, Colores.brandNavy]} start={{ x: 0, y: 0 }} end={{ x: 0.9, y: 1 }} style={estilos.panel}>
      <View style={estilos.textosPanel}>
        <Texto tamano={40} peso="extrabold" color={Colores.white} style={estilos.titular} accessibilityRole="header">
          Todo lo de tu mascota, en un solo lugar.
        </Texto>
        <Texto tamano={17} color="#FFFFFFD9" style={estilos.bajada}>
          Vacunas, turnos, recetas y estudios, compartidos con tu veterinario.
        </Texto>
      </View>
      <View style={estilos.escena} pointerEvents="none">
        <Image
          source={MASCOTAS} resizeMode="contain" accessibilityLabel="Un perro y un gato"
          style={{ width: anchoFoto, height: altoFoto }}
        />
        {conFicha ? (
          <View style={[estilos.fichaUbicada, { bottom: altoFoto * 0.9 }]}>
            <FichaDeEjemplo />
          </View>
        ) : null}
      </View>
    </LinearGradient>
  );
}

/**
 * En escritorio: panel de la marca a la izquierda y [children] (el formulario) a la derecha, con el logo arriba.
 * En el teléfono devuelve [children] solo.
 */
export function MarcoIngreso({ children }: { children: ReactNode }) {
  const escritorio = useEscritorio();
  if (!escritorio) return <>{children}</>;
  return (
    <View style={estilos.raiz}>
      <PanelMarca />
      <ScrollView style={estilos.ladoFormulario} contentContainerStyle={estilos.contenidoFormulario} keyboardShouldPersistTaps="handled">
        <View style={estilos.columna}>
          <Image source={LOGO} resizeMode="contain" accessibilityLabel="Logo de PetCare" style={estilos.logo} />
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, flexDirection: "row", backgroundColor: Colores.loginBg },
  panel: { flex: 1.15, overflow: "hidden", paddingHorizontal: 56, paddingTop: 64 },
  textosPanel: { maxWidth: 520 },
  titular: { lineHeight: 46, letterSpacing: -0.5 },
  bajada: { marginTop: 14, lineHeight: 25, maxWidth: 440 },
  escena: { flex: 1, justifyContent: "flex-end", alignItems: "flex-end", marginRight: -24 },
  fichaUbicada: { position: "absolute", left: 0 },
  ficha: { width: 280, backgroundColor: Colores.white, borderRadius: 20, padding: 16, ...sombra(4) },
  cabeceraFicha: { flexDirection: "row", alignItems: "center", paddingBottom: 12, marginBottom: 4, borderBottomWidth: 1, borderBottomColor: Colores.dividerLight },
  inicialFicha: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
  filaFicha: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  iconoFicha: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  ladoFormulario: { flex: 1 },
  contenidoFormulario: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40, paddingVertical: 48 },
  columna: { width: "100%", maxWidth: ANCHO_FORMULARIO_INGRESO },
  logo: { width: 150, height: (150 * 648) / 840, marginBottom: 28 },
});
