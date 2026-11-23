/*
 * Reemplazo del TimePickerDialog de 24 horas que usaban el registro del veterinario y EditorSede: se elige la hora
 * y los minutos (de 5 en 5) y devuelve "HH:mm". (El SelectorHora del kit es para grillas de turnos fijos.)
 */
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Colores } from "../common/tema";
import { Boton } from "../common/Boton";
import { DialogoCentral } from "../common/DialogoCentral";
import { Texto } from "../common/Texto";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";

const HORAS = Array.from({ length: 24 }, (_, i) => i);
const MINUTOS = Array.from({ length: 12 }, (_, i) => i * 5);
const dos = (n: number) => String(n).padStart(2, "0");

function Celda({ texto, elegida, alTocar }: { texto: string; elegida: boolean; alTocar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityState={{ selected: elegida }}
      onPress={alTocar}
      {...foco.props}
      style={[estilos.celda, elegida ? estilos.elegida : estilos.libre, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Texto variante="etiqueta" tamano={14} color={elegida ? Colores.white : Colores.brandNavy}>{texto}</Texto>
    </Pressable>
  );
}

export interface SelectorHoraLibreProps {
  visible: boolean;
  /** Hora actual "HH:mm". */
  valor: string;
  titulo?: string;
  alElegir: (hora: string) => void;
  alCerrar: () => void;
}

export function SelectorHoraLibre({ visible, valor, titulo = "Elegí la hora", alElegir, alCerrar }: SelectorHoraLibreProps) {
  const [h, setH] = useState(() => Number(valor.split(":")[0]) || 0);
  const [m, setM] = useState(() => Number(valor.split(":")[1]) || 0);
  useEffect(() => {
    if (!visible) return;
    setH(Number(valor.split(":")[0]) || 0);
    setM(Number(valor.split(":")[1]) || 0);
  }, [visible, valor]);
  return (
    <DialogoCentral visible={visible} alCerrar={alCerrar} anchoMaximo={380}>
      <Texto variante="titulo" tamano={20} accessibilityRole="header">{titulo}</Texto>
      <Texto variante="etiqueta" style={estilos.seccion}>Hora</Texto>
      <View style={estilos.grilla}>
        {HORAS.map((x) => <Celda key={x} texto={dos(x)} elegida={x === h} alTocar={() => setH(x)} />)}
      </View>
      <Texto variante="etiqueta" style={estilos.seccion}>Minutos</Texto>
      <View style={estilos.grilla}>
        {MINUTOS.map((x) => <Celda key={x} texto={dos(x)} elegida={x === m} alTocar={() => setM(x)} />)}
      </View>
      <View style={estilos.botones}>
        <Boton titulo="Cancelar" variante="secundario" alto={46} estilo={{ flex: 1 }} onPress={alCerrar} />
        <Boton
          titulo="Aceptar"
          alto={46}
          estilo={{ flex: 1 }}
          onPress={() => {
            alElegir(`${dos(h)}:${dos(m)}`);
            alCerrar();
          }}
        />
      </View>
    </DialogoCentral>
  );
}

const estilos = StyleSheet.create({
  seccion: { marginTop: 14, marginBottom: 6 },
  grilla: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  celda: { width: 44, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  libre: { backgroundColor: Colores.white, borderWidth: 1, borderColor: Colores.loginFieldStroke },
  elegida: { backgroundColor: Colores.primaryTeal },
  botones: { flexDirection: "row", gap: 8, marginTop: 18 },
});
