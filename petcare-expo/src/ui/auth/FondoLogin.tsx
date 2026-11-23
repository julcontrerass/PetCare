/*
 * Migrado de ui/auth/FondoLoginView.java. Dibuja el fondo del login (assets/images/fondo_login.png) ajustado al ancho:
 * la parte superior (manchas y huellas) queda arriba y la inferior (mascotas) abajo. El tramo central de la imagen es
 * liso, así que se rellena con el color crema y el fondo no se agranda en pantallas altas.
 */
import { useState } from "react";
import { Image, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Colores } from "../common/tema";

const FRACCION_SUPERIOR = 0.35;
const DESPLAZAMIENTO_INFERIOR = 70;
const MIN_ALTO_MASCOTAS = 720;
/** Tamaño de fondo_login.png. */
const ANCHO_IMAGEN = 1024;
const ALTO_IMAGEN = 1536;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FONDO = require("../../../assets/images/fondo_login.png") as number;

export function FondoLogin() {
  const [medida, setMedida] = useState({ w: 0, h: 0 });
  const alMedir = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setMedida((m) => (m.w === width && m.h === height ? m : { w: width, h: height }));
  };
  const { w, h } = medida;
  const alto = Math.round(ALTO_IMAGEN * (w / ANCHO_IMAGEN));
  const corteSuperior = Math.round(alto * FRACCION_SUPERIOR);
  const topInferior = h + DESPLAZAMIENTO_INFERIOR - alto;
  const inicioInferior = topInferior + corteSuperior;
  // En pantallas bajas las mascotas quedarían detrás del formulario: se dibuja solo la parte de arriba
  const hayInferior = h >= MIN_ALTO_MASCOTAS && inicioInferior < h;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={alMedir}
      style={estilos.raiz}
    >
      {w > 0 && h > 0 ? (
        <>
          <View style={{ position: "absolute", top: 0, left: 0, width: w, height: corteSuperior, overflow: "hidden" }}>
            <Image source={FONDO} resizeMode="stretch" style={{ width: w, height: alto }} />
          </View>
          {hayInferior ? (
            <View style={{ position: "absolute", top: inicioInferior, left: 0, width: w, height: h - inicioInferior, overflow: "hidden" }}>
              <Image source={FONDO} resizeMode="stretch" style={{ position: "absolute", top: -corteSuperior, width: w, height: alto }} />
            </View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { ...StyleSheet.absoluteFill, backgroundColor: Colores.loginBg, pointerEvents: "none" },
});
