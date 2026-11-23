/*
 * Reemplazo del TabLayout de Material de la agenda y de la lista de pacientes (tab_background_selector,
 * tab_indicator, TextAppearance.PetCare.Tab). Componente propio de la carpeta del veterinario.
 */
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Colores } from "../common/tema";
import { Texto } from "../common/Texto";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";

function Pestana({ texto, elegida, alTocar, fija }: { texto: string; elegida: boolean; alTocar: () => void; fija: boolean }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={texto}
      accessibilityState={{ selected: elegida }}
      onPress={alTocar}
      {...foco.props}
      style={[
        estilos.pestana, fija ? { flex: 1 } : { paddingHorizontal: 16 },
        elegida ? estilos.elegida : estilos.libre, cursorTocable, estiloFoco(foco.enfocado),
      ]}
    >
      <Texto variante="etiqueta" tamano={13} peso="medium" color={elegida ? Colores.primaryTeal : Colores.textGray} numberOfLines={1}>{texto}</Texto>
      {elegida ? <View style={estilos.indicador} /> : null}
    </Pressable>
  );
}

export interface PestanasVetProps {
  etiquetas: string[];
  seleccionada: number;
  alElegir: (indice: number) => void;
  /** Con true (`tabMode="scrollable"`) las pestañas se desplazan; si no, se reparten el ancho. */
  desplazable?: boolean;
}

export function PestanasVet({ etiquetas, seleccionada, alElegir, desplazable = false }: PestanasVetProps) {
  const pestanas = etiquetas.map((t, i) => (
    <Pestana key={t} texto={t} elegida={i === seleccionada} alTocar={() => alElegir(i)} fija={!desplazable} />
  ));
  if (desplazable) {
    return (
      <View style={estilos.caja}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.fila}>{pestanas}</ScrollView>
      </View>
    );
  }
  return <View style={[estilos.caja, estilos.fila]}>{pestanas}</View>;
}

const estilos = StyleSheet.create({
  caja: { height: 60, marginTop: 8 },
  fila: { flexDirection: "row", gap: 6, alignItems: "stretch" },
  pestana: { height: 60, borderRadius: 12, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  elegida: { backgroundColor: Colores.lightTeal, borderWidth: 1, borderColor: Colores.primaryTeal },
  libre: { backgroundColor: Colores.lightGray },
  indicador: { position: "absolute", bottom: 0, left: 20, right: 20, height: 3, borderRadius: 2, backgroundColor: Colores.primaryTeal },
});
