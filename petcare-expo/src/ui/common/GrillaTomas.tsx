/*
 * Grilla de un tratamiento: una fila por día y un cuadro por toma, con su hora. Verde = dada, rojo = no se dio y ya
 * pasó, resaltado = toca ahora, gris = más adelante. El dueño la toca para tildar; el veterinario solo la mira (ve qué
 * tomas faltaron).
 */
import { Pressable, StyleSheet, View } from "react-native";
import { claveDeToma, MINUTOS_ATRASO, tomasPorDia } from "../../model/tomas";
import { Fechas } from "../../util/fechas";
import { LocalDate, LocalDateTime } from "../../util/tiempo";
import { Icono } from "./Icono";
import { Colores } from "./tema";
import { Texto } from "./Texto";
import { cursorTocable, estiloFoco, useFoco } from "./Web";

export type EstadoToma = "dada" | "atrasada" | "ahora" | "futura";

/** Una toma sin tildar ya está atrasada si pasaron más de MINUTOS_ATRASO desde su hora. */
export function estadoDeToma(t: LocalDateTime, dada: boolean, ahora: LocalDateTime): EstadoToma {
  if (dada) return "dada";
  if (t.plusMinutes(MINUTOS_ATRASO).isBefore(ahora)) return "atrasada";
  return t.isAfter(ahora.plusMinutes(60)) ? "futura" : "ahora";
}

function Cuadro({ momento, estado, alTocar }: { momento: LocalDateTime; estado: EstadoToma; alTocar?: () => void }) {
  const foco = useFoco();
  const colores = {
    dada: { fondo: Colores.successGreen, borde: Colores.successGreen, texto: Colores.white },
    atrasada: { fondo: Colores.lightRed, borde: Colores.dangerRed, texto: Colores.dangerRed },
    ahora: { fondo: Colores.lightTeal, borde: Colores.primaryTeal, texto: Colores.primaryTeal },
    futura: { fondo: Colores.white, borde: Colores.dividerLight, texto: Colores.textGray },
  }[estado];
  const nombre = { dada: "dada", atrasada: "no se dio", ahora: "toca ahora", futura: "más adelante" }[estado];
  const contenido = (
    <>
      {estado === "dada" ? <Icono nombre="check" tamano={14} color={colores.texto} /> : null}
      <Texto tamano={12} negrita color={colores.texto}>{momento.horaTexto()}</Texto>
    </>
  );
  const estilo = [estilos.cuadro, { backgroundColor: colores.fondo, borderColor: colores.borde }];
  // Las de más adelante no se pueden tildar todavía
  if (!alTocar || estado === "futura") {
    return <View accessible accessibilityLabel={`${momento.horaTexto()}, ${nombre}`} style={estilo}>{contenido}</View>;
  }
  return (
    <Pressable
      accessibilityRole="checkbox" accessibilityState={{ checked: estado === "dada" }}
      accessibilityLabel={`${momento.horaTexto()}, ${nombre}`} onPress={alTocar} hitSlop={4}
      {...foco.props} style={[...estilo, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      {contenido}
    </Pressable>
  );
}

function textoDia(dia: LocalDate, hoy: LocalDate): string {
  if (dia.equals(hoy)) return "Hoy";
  if (dia.equals(hoy.minusDays(1))) return "Ayer";
  if (dia.equals(hoy.plusDays(1))) return "Mañana";
  return `${Fechas.diaSemana(dia).slice(0, 3)} ${dia.dayOfMonth}/${dia.monthValue}`;
}

/** [alTocar]: el dueño tilda o destilda; sin él, solo se mira. */
export function GrillaTomas({ momentos, dadas, ahora = LocalDateTime.now(), alTocar }: {
  momentos: LocalDateTime[];
  dadas: ReadonlySet<string>;
  ahora?: LocalDateTime;
  alTocar?: (momento: LocalDateTime, estado: EstadoToma) => void;
}) {
  const hoy = ahora.toLocalDate();
  return (
    <View style={estilos.grilla}>
      {tomasPorDia(momentos).map(({ dia, tomas }, i) => (
        <View key={dia.toString()} style={estilos.fila}>
          <Texto variante="chico" tamano={12} negrita={dia.equals(hoy)} style={estilos.dia}>
            {`Día ${i + 1} · ${textoDia(dia, hoy)}`}
          </Texto>
          <View style={estilos.cuadros}>
            {tomas.map((t) => {
              const estado = estadoDeToma(t, dadas.has(claveDeToma(t)), ahora);
              return <Cuadro key={t.toString()} momento={t} estado={estado} alTocar={alTocar ? () => alTocar(t, estado) : undefined} />;
            })}
          </View>
        </View>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  grilla: { marginTop: 10, gap: 6 },
  fila: { flexDirection: "row", alignItems: "center", gap: 8 },
  dia: { width: 104 },
  cuadros: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  cuadro: {
    minWidth: 58, height: 34, borderRadius: 10, borderWidth: 1.5, flexDirection: "row", alignItems: "center",
    justifyContent: "center", gap: 3, paddingHorizontal: 6,
  },
});
