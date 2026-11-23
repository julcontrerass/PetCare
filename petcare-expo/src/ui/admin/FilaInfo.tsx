/* PetInfoRow de los layouts sheet_admin_*: ícono, etiqueta y valor, con separador entre filas. */
import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Icono, type NombreIcono } from "../common/Icono";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";

export interface FilaInfoProps {
  icono: NombreIcono;
  etiqueta: string;
  /** Vacío o en blanco se ve como "Sin datos". */
  valor: string;
  /** Dibuja la línea divisoria arriba (todas menos la primera). */
  separador?: boolean;
}

export function FilaInfo({ icono, etiqueta, valor, separador }: FilaInfoProps) {
  return (
    <View>
      {separador ? <View style={estilos.divisor} /> : null}
      <View style={estilos.fila}>
        <View style={estilos.caja}>
          <Icono nombre={icono} tamano={20} color={Colores.tealDark} />
        </View>
        <View style={estilos.textos}>
          <Texto variante="chico" tamano={12}>{etiqueta}</Texto>
          <Texto variante="cuerpo" peso="medium" style={estilos.valor} selectable>{valor.trim() ? valor : "Sin datos"}</Texto>
        </View>
      </View>
    </View>
  );
}

/** Tarjeta que agrupa las filas de información (de las hojas, que son blancas: se ve sobre el fondo crema). */
export function TarjetaInfo({ children, estilo }: { children: ReactNode; estilo?: StyleProp<ViewStyle> }) {
  return <View style={[estilos.tarjeta, estilo]}>{children}</View>;
}

const estilos = StyleSheet.create({
  tarjeta: { backgroundColor: Colores.loginBg, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 4 },
  fila: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  caja: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
  textos: { flex: 1, minWidth: 0, marginLeft: 12 },
  valor: { marginTop: 1 },
  divisor: { height: 1, marginLeft: 50, backgroundColor: "#E6E6E0" },
});
