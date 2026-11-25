/*
 * Marco del ingreso en escritorio (web ancha): a la izquierda el panel de la marca, claro, con el logo, el título, la lista de
 * lo que hace PetCare y la foto de las mascotas abajo; a la derecha el formulario, centrado sobre fondo crema. En el teléfono devuelve el contenido tal
 * cual (la app conserva su diseño de siempre).
 */
import { useState, type ReactNode } from "react";
import { Image, ScrollView, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from "react-native";
import { Icono } from "../common/Icono";
import { Colores, sombra } from "../common/tema";
import { Texto } from "../common/Texto";
import { useEscritorio } from "../common/Web";

const LOGO = require("../../../assets/images/logo_petcare.png") as number;
const MASCOTAS = require("../../../assets/images/mascotas_inicio.png") as number;
/** Proporción de mascotas_inicio.png (1100 × 754). */
const PROPORCION_MASCOTAS = 1100 / 754;
/** La foto no pasa de este ancho; si el lugar que queda debajo de la lista es más bajo que ALTO_MINIMO_FOTO, no se dibuja. */
const ANCHO_MAXIMO_FOTO = 560;
const ALTO_MINIMO_FOTO = 150;
/** Por debajo de este alto de ventana el panel pasa a su forma compacta. */
const ALTO_PANEL_COMPLETO = 1000;

/** Ancho de la columna del formulario. */
const ANCHO_FORMULARIO_INGRESO = 400;

type Funcion = { icono: "historial" | "vacuna" | "turno" | "receta"; color: string; titulo: string; detalle: string };

/** Lo que hace PetCare, en el orden en que lo usa un dueño. */
const FUNCIONES: Funcion[] = [
  { icono: "historial", color: Colores.primaryTeal, titulo: "Historia clínica completa", detalle: "Consultas, estudios y la evolución del peso, siempre a mano." },
  { icono: "vacuna", color: Colores.successGreen, titulo: "Vacunas al día", detalle: "Te avisamos antes de cada dosis y cuando una vacuna vence." },
  { icono: "turno", color: Colores.accentOrangeDark, titulo: "Turnos con tu veterinario", detalle: "Elegí el lugar y el horario que te queden cómodos." },
  { icono: "receta", color: Colores.accentPurple, titulo: "Recetas y certificados", detalle: "En PDF para compartir, con un aviso en cada toma." },
];

/** Una función de la lista: ícono en un recuadro blanco, título y una línea de explicación. */
function FilaFuncion({ icono, color, titulo, detalle }: Funcion) {
  return (
    <View style={estilos.filaFuncion}>
      <View style={estilos.iconoFuncion}>
        <Icono nombre={icono} tamano={22} color={color} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Texto tamano={16} negrita color={Colores.brandNavy}>{titulo}</Texto>
        <Texto tamano={14} color={Colores.textGray} style={estilos.detalleFuncion}>{detalle}</Texto>
      </View>
    </View>
  );
}

/** Foto del perro y el gato apoyada abajo a la derecha, del tamaño que entre en el lugar que deja la lista. */
function FotoMascotas() {
  const [lugar, setLugar] = useState({ w: 0, h: 0 });
  const alMedir = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLugar((l) => (l.w === width && l.h === height ? l : { w: width, h: height }));
  };
  const ancho = Math.min(ANCHO_MAXIMO_FOTO, lugar.w, lugar.h * PROPORCION_MASCOTAS);
  const alto = ancho / PROPORCION_MASCOTAS;
  return (
    <View style={estilos.escena} onLayout={alMedir} pointerEvents="none">
      {alto >= ALTO_MINIMO_FOTO ? (
        <Image source={MASCOTAS} resizeMode="contain" accessibilityLabel="Un perro y un gato" style={{ width: ancho, height: alto }} />
      ) : null}
    </View>
  );
}

/**
 * Panel de la marca: fondo claro con el título, la lista de lo que hace PetCare y la foto de las mascotas abajo.
 * En ventanas bajas (notebooks) el logo y el título se achican, la lista va en dos columnas y se omiten la bajada y la
 * línea final, para que la foto siempre entre.
 */
function PanelMarca() {
  const { height } = useWindowDimensions();
  const compacto = height < ALTO_PANEL_COMPLETO;
  return (
    <View style={[estilos.panel, compacto && estilos.panelCompacto]}>
      <View style={[estilos.contenidoPanel, compacto && estilos.contenidoCompacto]}>
        <Image
          source={LOGO} resizeMode="contain" accessibilityLabel="Logo de PetCare"
          style={[estilos.logo, compacto && estilos.logoCompacto]}
        />
        <Texto
          tamano={compacto ? 32 : 40} peso="extrabold" color={Colores.brandNavy}
          style={[estilos.titular, compacto && estilos.titularCompacto]} accessibilityRole="header"
        >
          Todo lo de tu mascota, en un solo lugar.
        </Texto>
        {compacto ? null : (
          <Texto tamano={17} color={Colores.textGray} style={estilos.bajada}>
            Tu veterinario carga cada consulta y vos lo tenés en el celular o en la compu.
          </Texto>
        )}
        <View style={[estilos.listaFunciones, compacto && estilos.listaCompacta]}>
          {FUNCIONES.map((f) => (
            <View key={f.icono} style={compacto ? estilos.celdaCompacta : null}>
              <FilaFuncion {...f} />
            </View>
          ))}
        </View>
        {compacto ? null : (
          <View style={estilos.pie}>
            <Icono nombre="veterinario" tamano={18} color={Colores.primaryTeal} />
            <Texto tamano={14} color={Colores.textGray} style={{ flex: 1 }}>
              ¿Sos veterinario/a? Con la misma cuenta manejás tu agenda y tus pacientes.
            </Texto>
          </View>
        )}
      </View>
      <FotoMascotas />
    </View>
  );
}

/**
 * En escritorio: panel de la marca a la izquierda y [children] (el formulario) a la derecha.
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
          {children}
        </View>
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1, flexDirection: "row", backgroundColor: Colores.loginBg },
  panel: { flex: 1.15, overflow: "hidden", backgroundColor: Colores.lightTeal, paddingHorizontal: 64, paddingTop: 56 },
  escena: { flex: 1, minHeight: 0, justifyContent: "flex-end", alignItems: "flex-end", marginTop: 16, marginRight: -24 },
  contenidoPanel: { maxWidth: 520 },
  logo: { width: 270, height: (270 * 648) / 840, marginBottom: 28, marginLeft: -12 },
  logoCompacto: { width: 180, height: (180 * 648) / 840, marginBottom: 14, marginLeft: -8 },
  titular: { lineHeight: 46, letterSpacing: -0.5 },
  titularCompacto: { lineHeight: 38 },
  bajada: { marginTop: 14, lineHeight: 25, maxWidth: 460 },
  listaFunciones: { marginTop: 36, gap: 22 },
  panelCompacto: { paddingTop: 32 },
  contenidoCompacto: { maxWidth: 640 },
  listaCompacta: { marginTop: 24, flexDirection: "row", flexWrap: "wrap", rowGap: 20, columnGap: 24 },
  celdaCompacta: { flexBasis: "45%", flexGrow: 1 },
  filaFuncion: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  iconoFuncion: { width: 44, height: 44, borderRadius: 12, backgroundColor: Colores.white, alignItems: "center", justifyContent: "center", ...sombra(1) },
  detalleFuncion: { marginTop: 2, lineHeight: 20 },
  pie: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 40, paddingTop: 20, borderTopWidth: 1, borderTopColor: Colores.white },
  ladoFormulario: { flex: 1 },
  contenidoFormulario: { flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 40, paddingVertical: 48 },
  columna: { width: "100%", maxWidth: ANCHO_FORMULARIO_INGRESO },
});
