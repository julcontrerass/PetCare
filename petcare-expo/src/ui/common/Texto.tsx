import type { ReactNode } from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import { Colores, Fuentes } from "./tema";
import { Diseno } from "./Diseno";

export type VarianteTexto = "titulo" | "subtitulo" | "cuerpo" | "chico" | "etiqueta" | "boton";
export type PesoTexto = keyof typeof Fuentes;

const VARIANTES: Record<VarianteTexto, { fontSize: number; peso: PesoTexto; color: string; lineHeight: number }> = {
  /** Títulos de pantalla (24sp bold navy, como tvTitle). */
  titulo: { fontSize: 24, peso: "bold", color: Colores.brandNavy, lineHeight: 30 },
  /** Texto secundario debajo de un título (15sp gris). */
  subtitulo: { fontSize: 15, peso: "regular", color: Colores.textGray, lineHeight: 21 },
  /** Texto normal (15sp navy). */
  cuerpo: { fontSize: 15, peso: "regular", color: Colores.brandNavy, lineHeight: 21 },
  /** Texto chico (12.5sp gris). */
  chico: { fontSize: 12.5, peso: "regular", color: Colores.textGray, lineHeight: 17 },
  /** Etiqueta de formulario (VetFormLabel: 13sp bold navy). */
  etiqueta: { fontSize: 13, peso: "bold", color: Colores.brandNavy, lineHeight: 18 },
  /** Texto de botones (15sp bold). */
  boton: { fontSize: 15, peso: "bold", color: Colores.white, lineHeight: 20 },
};

export interface TextoProps extends TextProps {
  variante?: VarianteTexto;
  /** Color del texto; el de la variante por defecto. */
  color?: string;
  /** Pone el peso en negrita (700). Para otros pesos, `peso`. No usar `fontWeight` en el estilo: Nunito se elige por peso. */
  negrita?: boolean;
  peso?: PesoTexto;
  /** Tamaño en sp; el de la variante por defecto. */
  tamano?: number;
  centrado?: boolean;
  children?: ReactNode;
}

/** Texto de la app con Nunito. Respeta el tamaño de letra del sistema hasta 1.15x (Responsive.ESCALA_LETRA_MAXIMA). */
export function Texto({ variante = "cuerpo", color, negrita, peso, tamano, centrado, style, children, ...resto }: TextoProps) {
  const v = VARIANTES[variante];
  const base: TextStyle = {
    fontFamily: Fuentes[peso ?? (negrita ? "bold" : v.peso)],
    fontSize: tamano ?? v.fontSize,
    lineHeight: tamano ? Math.round(tamano * 1.35) : v.lineHeight,
    color: color ?? v.color,
    ...(centrado ? { textAlign: "center" } : null),
  };
  return (
    <Text maxFontSizeMultiplier={Diseno.ESCALA_LETRA_MAXIMA} {...resto} style={[base, style]}>
      {children}
    </Text>
  );
}
