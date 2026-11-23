/*
 * Migrado de ui/common/GraficoPesoView.kt: línea con la evolución del peso de una mascota, un punto por cada vez que
 * se la pesó. Dibujado con react-native-svg (en Android era un `View` con `onDraw`).
 */
import { useState } from "react";
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, G, Line, Path, Text as TextoSvg } from "react-native-svg";
import { numeroTexto } from "../../model/clinica";
import { Fechas } from "../../util/fechas";
import { diasEntre, type LocalDate } from "../../util/tiempo";
import { Fuentes } from "./tema";

/** Una medición: el día y el peso en kg. */
export type PuntoPeso = readonly [LocalDate, number];

const ALTO = 170;
const TEAL = "rgb(13,148,136)";
const GUIA = "rgb(226,232,240)";
const GRIS = "rgb(100,116,139)";
const NAVY = "rgb(15,23,42)";
const TAMANO_TEXTO = 11;
// Nunito no se mide en el SVG: se estima el ancho de cada carácter para centrar los rótulos
const ANCHO_CARACTER = 6.4;

export interface RotuloPeso {
  texto: string;
  x: number;
  y: number;
}

export interface GeometriaPeso {
  /** Posición de cada punto, en el orden de las fechas. */
  puntos: { x: number; y: number }[];
  /** Los rótulos de kg: el primero, el último y los extremos, para que no se amontone. */
  rotulos: RotuloPeso[];
  izquierda: number;
  derecha: number;
  arriba: number;
  abajo: number;
}

/** Calcula dónde va cada punto y cada rótulo en un lienzo de [ancho] x [alto]; los puntos se ordenan por fecha. */
export function geometriaPeso(datos: readonly PuntoPeso[], ancho: number, alto: number): GeometriaPeso {
  const puntos = [...datos].sort((a, b) => a[0].compareTo(b[0]));
  const izquierda = 12;
  const derecha = ancho - 12;
  const arriba = 26;
  const abajo = alto - 26;
  if (puntos.length === 0) return { puntos: [], rotulos: [], izquierda, derecha, arriba, abajo };

  const pesos = puntos.map((p) => p[1]);
  const minimo = Math.min(...pesos);
  const maximo = Math.max(...pesos);
  const rango = maximo - minimo > 0 ? maximo - minimo : 1;
  const primera = puntos[0][0];
  const dias = Math.max(diasEntre(primera, puntos[puntos.length - 1][0]), 1);

  const x = (f: LocalDate) =>
    puntos.length === 1 ? (izquierda + derecha) / 2 : izquierda + (derecha - izquierda) * (diasEntre(primera, f) / dias);
  const y = (p: number) => abajo - (abajo - arriba) * ((p - minimo) / rango);

  const posiciones = puntos.map(([f, p]) => ({ x: x(f), y: y(p) }));
  const rotulos: RotuloPeso[] = [];
  puntos.forEach(([, peso], i) => {
    if (!(i === 0 || i === puntos.length - 1 || peso === minimo || peso === maximo)) return;
    const texto = `${numeroTexto(peso)} kg`;
    const anchoTexto = texto.length * ANCHO_CARACTER;
    const { x: cx, y: cy } = posiciones[i];
    const tx = Math.min(Math.max(cx - anchoTexto / 2, izquierda), Math.max(derecha - anchoTexto, izquierda));
    rotulos.push({ texto, x: tx, y: cy - 10 < arriba - 6 ? cy + 20 : cy - 10 });
  });
  return { puntos: posiciones, rotulos, izquierda, derecha, arriba, abajo };
}

export interface GraficoPesoViewProps {
  puntos: readonly PuntoPeso[];
  estilo?: StyleProp<ViewStyle>;
}

/** Línea con la evolución del peso: fechas de la primera y la última medición abajo y los kg de los puntos principales. */
export function GraficoPesoView({ puntos, estilo }: GraficoPesoViewProps) {
  const [ancho, setAncho] = useState(0);
  const alMedir = (e: LayoutChangeEvent) => setAncho(e.nativeEvent.layout.width);
  const ordenados = [...puntos].sort((a, b) => a[0].compareTo(b[0]));
  const g = geometriaPeso(ordenados, ancho, ALTO);
  const camino = g.puntos.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const ultima = ordenados.length > 1 ? Fechas.corta(ordenados[ordenados.length - 1][0]) : null;

  const etiqueta =
    ordenados.length === 0
      ? "Evolución del peso"
      : `Evolución del peso: ${ordenados.map(([f, p]) => `${numeroTexto(p)} kg el ${Fechas.corta(f)}`).join(", ")}`;

  return (
    <View onLayout={alMedir} style={[{ height: ALTO, alignSelf: "stretch" }, estilo]} accessible accessibilityRole="image" accessibilityLabel={etiqueta}>
      {ancho > 0 && ordenados.length > 0 ? (
        <Svg width={ancho} height={ALTO}>
          <Line x1={g.izquierda} y1={g.abajo} x2={g.derecha} y2={g.abajo} stroke={GUIA} strokeWidth={1} />
          <Line x1={g.izquierda} y1={g.arriba} x2={g.derecha} y2={g.arriba} stroke={GUIA} strokeWidth={1} />
          {ordenados.length > 1 ? (
            <Path d={camino} stroke={TEAL} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
          {g.puntos.map((p, i) => (
            <G key={i}>
              <Circle cx={p.x} cy={p.y} r={5} fill={TEAL} />
              <Circle cx={p.x} cy={p.y} r={2.5} fill="#FFFFFF" />
            </G>
          ))}
          {g.rotulos.map((r, i) => (
            <TextoSvg key={i} x={r.x} y={r.y} fontSize={TAMANO_TEXTO} fontFamily={Fuentes.bold} fill={NAVY}>{r.texto}</TextoSvg>
          ))}
          <TextoSvg x={g.izquierda} y={ALTO - 6} fontSize={TAMANO_TEXTO} fontFamily={Fuentes.regular} fill={GRIS}>
            {Fechas.corta(ordenados[0][0])}
          </TextoSvg>
          {ultima ? (
            <TextoSvg x={g.derecha} y={ALTO - 6} fontSize={TAMANO_TEXTO} fontFamily={Fuentes.regular} fill={GRIS} textAnchor="end">
              {ultima}
            </TextoSvg>
          ) : null}
        </Svg>
      ) : null}
    </View>
  );
}
