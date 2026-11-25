/**
 * Reparte tarjetas en columnas en el formato de escritorio. En el teléfono devuelve los hijos tal cual, uno debajo del
 * otro, así esas pantallas no cambian. Cada fila reparte el ancho en partes iguales (la última se completa con huecos).
 */
import { Children, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { SEPARACION_GRILLA, useEscritorio } from "./Web";

export interface GrillaProps {
  /** Columnas en escritorio; 2 por defecto. */
  columnas?: number;
  /** Separación vertical entre filas en escritorio (los hijos suelen traer su propio margen abajo). */
  separacionFilas?: number;
  estilo?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

export function Grilla({ columnas = 2, separacionFilas = 0, estilo, children }: GrillaProps) {
  const escritorio = useEscritorio();
  const hijos = Children.toArray(children);
  if (!escritorio || columnas <= 1) return <>{children}</>;
  const filas: ReactNode[][] = [];
  for (let i = 0; i < hijos.length; i += columnas) filas.push(hijos.slice(i, i + columnas));
  return (
    <View style={estilo}>
      {filas.map((fila, f) => (
        <View key={f} style={[estilos.fila, f > 0 ? { marginTop: separacionFilas } : null]}>
          {Array.from({ length: columnas }, (_, c) => (
            <View key={c} style={estilos.celda}>{fila[c] ?? null}</View>
          ))}
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "stretch", gap: SEPARACION_GRILLA },
  celda: { flex: 1, minWidth: 0 },
});
