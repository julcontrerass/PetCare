import { Pressable, StyleSheet, View } from "react-native";
import { Colores } from "./tema";
import { Boton } from "./Boton";
import { DialogoCentral } from "./DialogoCentral";
import { Texto } from "./Texto";
import { cursorTocable, estiloFoco, useFoco } from "./Web";

export interface SelectorHoraProps {
  visible: boolean;
  /** Horarios "HH:mm" que se muestran (los libres y, si se quiere, también los ocupados). */
  horarios: string[];
  /** Horario seleccionado. */
  valor?: string | null;
  /** Horarios de [horarios] que no se pueden tomar: se ven tachados (bg_slot_ocupado) y no eligen. */
  ocupados?: string[];
  /** Se llama al tocar un horario ocupado (por ejemplo "Ese horario no está disponible"). */
  alTocarOcupado?: (hora: string) => void;
  /** "Elegí el horario" por defecto. */
  titulo?: string;
  subtitulo?: string;
  /** Se llama al tocar un horario libre; después se llama a [alCerrar]. */
  alElegir: (hora: string) => void;
  alCerrar: () => void;
}

function Hora({ hora, estado, alTocar }: { hora: string; estado: "libre" | "ocupado" | "elegido"; alTocar: () => void }) {
  const foco = useFoco();
  return (
    <View style={estilos.celda}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={estado === "ocupado" ? `${hora}, no disponible` : hora}
        accessibilityState={{ selected: estado === "elegido", disabled: estado === "ocupado" }}
        onPress={alTocar}
        {...foco.props}
        style={[
          estilos.hora,
          estado === "elegido" ? estilos.elegida : estado === "ocupado" ? estilos.ocupada : estilos.libre,
          cursorTocable,
          estiloFoco(foco.enfocado),
        ]}
      >
        <Texto
          variante="etiqueta" tamano={14}
          color={estado === "elegido" ? Colores.white : estado === "ocupado" ? Colores.textGray : Colores.brandNavy}
          style={estado === "ocupado" ? estilos.tachado : null}
        >
          {hora}
        </Texto>
      </Pressable>
    </View>
  );
}

/** Grilla de 3 columnas con los horarios "HH:mm" para elegir uno. Port de SelectorHoraVet. */
export function SelectorHora({ visible, horarios, valor, ocupados = [], alTocarOcupado, titulo = "Elegí el horario", subtitulo, alElegir, alCerrar }: SelectorHoraProps) {
  const hayLibres = horarios.some((h) => !ocupados.includes(h));
  const filas: string[][] = [];
  for (let i = 0; i < horarios.length; i += 3) filas.push(horarios.slice(i, i + 3));
  return (
    <DialogoCentral visible={visible} alCerrar={alCerrar} anchoMaximo={380}>
      <Texto variante="titulo" tamano={20} accessibilityRole="header">{titulo}</Texto>
      {subtitulo ? <Texto variante="chico" style={estilos.subtitulo}>{subtitulo}</Texto> : null}
      <View style={estilos.grilla}>
        {filas.map((fila, i) => (
          <View key={i} style={estilos.fila}>
            {fila.map((h) => {
              const ocupado = ocupados.includes(h);
              return (
                <Hora
                  key={h}
                  hora={h}
                  estado={ocupado ? "ocupado" : h === valor ? "elegido" : "libre"}
                  alTocar={() => {
                    if (ocupado) {
                      alTocarOcupado?.(h);
                      return;
                    }
                    alElegir(h);
                    alCerrar();
                  }}
                />
              );
            })}
            {Array.from({ length: 3 - fila.length }, (_, k) => <View key={`v${k}`} style={estilos.celda} />)}
          </View>
        ))}
      </View>
      {!hayLibres ? (
        <Texto variante="subtitulo" tamano={13.5} color={Colores.dangerRed} style={estilos.vacio}>No quedan horarios libres para este día</Texto>
      ) : null}
      {ocupados.length > 0 ? (
        <View style={estilos.leyenda}>
          <View style={estilos.muestra} />
          <Texto variante="chico" style={estilos.textoLeyenda}>Ocupado o ya pasó</Texto>
        </View>
      ) : null}
      <Boton titulo="Cancelar" variante="texto" alto={44} onPress={alCerrar} estilo={estilos.cancelar} />
    </DialogoCentral>
  );
}

const estilos = StyleSheet.create({
  subtitulo: { marginTop: 2 },
  grilla: { marginTop: 12 },
  fila: { flexDirection: "row" },
  celda: { flex: 1, padding: 4 },
  hora: { height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  libre: { backgroundColor: Colores.white, borderWidth: 1, borderColor: Colores.loginFieldStroke },
  elegida: { backgroundColor: Colores.primaryTeal },
  ocupada: { backgroundColor: Colores.lightGray },
  tachado: { textDecorationLine: "line-through" },
  vacio: { marginTop: 8 },
  leyenda: { flexDirection: "row", alignItems: "center", marginTop: 12 },
  muestra: { width: 14, height: 14, borderRadius: 4, backgroundColor: Colores.lightGray },
  textoLeyenda: { marginLeft: 6 },
  cancelar: { alignSelf: "flex-end", marginTop: 6, minWidth: 100 },
});
