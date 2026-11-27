/*
 * Buscador y fila de filtros de las listas del panel del administrador (veterinarios, dueños, veterinarias).
 */
import { ScrollView, StyleSheet } from "react-native";
import { Campo } from "../common/Campo";
import { Chip } from "../common/Chip";

export function BuscadorAdmin({ placeholder, valor, alCambiar }: { placeholder: string; valor: string; alCambiar: (t: string) => void }) {
  return (
    <Campo
      forma="pildora"
      icono="buscar"
      placeholder={placeholder}
      value={valor}
      onChangeText={alCambiar}
      returnKeyType="search"
      autoCorrect={false}
      estilo={estilos.buscador}
    />
  );
}

export interface FiltrosAdminProps {
  opciones: { estado: string | null; texto: string }[];
  elegido: string | null;
  alElegir: (estado: string | null) => void;
  cantidad: (estado: string | null) => number;
}

/** Chips de estado con la cantidad de cada uno; `null` es "Todos". */
export function FiltrosAdmin({ opciones, elegido, alElegir, cantidad }: FiltrosAdminProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={estilos.filtros}
      contentContainerStyle={estilos.filtrosContenido}
    >
      {opciones.map((o) => (
        <Chip
          key={o.estado ?? "todos"}
          texto={`${o.texto} (${cantidad(o.estado)})`}
          tono={elegido === o.estado ? "seleccionado" : "sinSeleccionar"}
          onPress={() => alElegir(o.estado)}
        />
      ))}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  buscador: { marginTop: 14 },
  filtros: { flexGrow: 0, marginTop: 10 },
  filtrosContenido: { gap: 8, paddingVertical: 2 },
});
