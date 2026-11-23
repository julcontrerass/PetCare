import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Fechas } from "../../util/fechas";
import { LocalDate, YearMonth } from "../../util/tiempo";
import { Colores } from "./tema";
import { BotonIcono } from "./BotonIcono";
import { Boton } from "./Boton";
import { DialogoCentral } from "./DialogoCentral";
import { Texto } from "./Texto";
import { cursorTocable, estiloFoco, useFoco } from "./Web";

const SEMANA = ["L", "M", "X", "J", "V", "S", "D"];

export interface SelectorFechaProps {
  visible: boolean;
  /** Fecha seleccionada; el calendario abre en su mes (o en el de hoy). */
  valor?: LocalDate | null;
  /** Primer día elegible: los anteriores se ven apagados y no se pueden tocar; tampoco se retrocede de su mes. */
  minima?: LocalDate;
  /** Último día elegible. */
  maxima?: LocalDate;
  /** Si devuelve false el día se ve como bloqueado (círculo negro, bg_dia_bloqueado) y no se puede elegir. */
  diaHabilitado?: (fecha: LocalDate) => boolean;
  /** Se llama al tocar un día bloqueado por [diaHabilitado] (por ejemplo para mostrar "No atendés los lunes"). */
  alTocarBloqueado?: (fecha: LocalDate) => void;
  /** "Elegí la fecha" por defecto. */
  titulo?: string;
  /** Línea chica debajo del título (por ejemplo los días de atención). */
  subtitulo?: string;
  /** Texto de la leyenda del día bloqueado; "No disponible" por defecto (el veterinario usa "No atiende"). */
  leyendaBloqueado?: string;
  /** Se llama al tocar un día habilitado; después se llama a [alCerrar]. */
  alElegir: (fecha: LocalDate) => void;
  alCerrar: () => void;
}

function Dia({ fecha, estado, alTocar }: { fecha: LocalDate; estado: "normal" | "pasado" | "bloqueado" | "elegido" | "hoy"; alTocar: () => void }) {
  const foco = useFoco();
  const apagado = estado === "pasado";
  const color = estado === "elegido" || estado === "bloqueado" ? Colores.white : apagado ? Colores.dividerColor : Colores.brandNavy;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={Fechas.larga(fecha)}
      accessibilityState={{ disabled: apagado || estado === "bloqueado", selected: estado === "elegido" }}
      disabled={apagado}
      onPress={alTocar}
      {...foco.props}
      style={[estilos.celda, cursorTocable]}
    >
      <View
        style={[
          estilos.circulo,
          estado === "elegido" ? { backgroundColor: Colores.primaryTeal } : null,
          estado === "bloqueado" ? { backgroundColor: Colores.black } : null,
          estado === "hoy" ? { borderWidth: 2, borderColor: Colores.primaryTeal } : null,
          estiloFoco(foco.enfocado),
        ]}
      >
        <Texto variante="etiqueta" tamano={14} color={color} peso={apagado ? "regular" : "bold"}>{String(fecha.dayOfMonth)}</Texto>
      </View>
    </Pressable>
  );
}

/** Calendario mensual en un modal para elegir una fecha. Port de SelectorFechaVet, sin lógica propia de disponibilidad. */
export function SelectorFecha({
  visible, valor, minima, maxima, diaHabilitado, alTocarBloqueado, titulo = "Elegí la fecha", subtitulo,
  leyendaBloqueado = "No disponible", alElegir, alCerrar,
}: SelectorFechaProps) {
  const [mes, setMes] = useState<YearMonth>(() => (valor ?? LocalDate.now()).yearMonth());
  useEffect(() => {
    if (visible) setMes((valor ?? LocalDate.now()).yearMonth());
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const hoy = LocalDate.now();
  const puedeRetroceder = !minima || mes.isAfter(minima.yearMonth());
  const puedeAvanzar = !maxima || mes.isBefore(maxima.yearMonth());
  const desfase = mes.atDay(1).dayOfWeek - 1;
  const celdas: (LocalDate | null)[] = [
    ...Array<null>(desfase).fill(null),
    ...Array.from({ length: mes.lengthOfMonth() }, (_, i) => mes.atDay(i + 1)),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);
  const semanas = Array.from({ length: celdas.length / 7 }, (_, i) => celdas.slice(i * 7, i * 7 + 7));

  const elegir = (f: LocalDate) => {
    alElegir(f);
    alCerrar();
  };

  return (
    <DialogoCentral visible={visible} alCerrar={alCerrar} anchoMaximo={380}>
      <Texto variante="titulo" tamano={20} accessibilityRole="header">{titulo}</Texto>
      {subtitulo ? <Texto variante="chico" style={estilos.subtitulo}>{subtitulo}</Texto> : null}

      <View style={estilos.navegacion}>
        <View style={!puedeRetroceder ? estilos.apagado : null}>
          <BotonIcono
            icono="chevronIzquierda" fondo="suave" color={Colores.tealDark} tamano={20}
            accessibilityLabel="Mes anterior" onPress={() => puedeRetroceder && setMes(mes.minusMonths(1))}
          />
        </View>
        <Texto variante="etiqueta" tamano={17} centrado style={estilos.mes} accessibilityLiveRegion="polite">{Fechas.mesAnio(mes)}</Texto>
        <View style={!puedeAvanzar ? estilos.apagado : null}>
          <BotonIcono
            icono="chevronDerecha" fondo="suave" color={Colores.tealDark} tamano={20}
            accessibilityLabel="Mes siguiente" onPress={() => puedeAvanzar && setMes(mes.plusMonths(1))}
          />
        </View>
      </View>

      <View style={estilos.semana}>
        {SEMANA.map((l, i) => (
          <View key={`${l}${i}`} style={estilos.celdaSemana}>
            <Texto variante="chico" tamano={12} negrita>{l}</Texto>
          </View>
        ))}
      </View>
      {semanas.map((fila, i) => (
        <View key={i} style={estilos.semana}>
          {fila.map((f, j) => {
            if (!f) return <View key={j} style={estilos.celda} />;
            const fuera = (!!minima && f.isBefore(minima)) || (!!maxima && f.isAfter(maxima));
            const bloqueado = !fuera && diaHabilitado ? !diaHabilitado(f) : false;
            const estado = fuera ? "pasado" : bloqueado ? "bloqueado" : f.equals(valor) ? "elegido" : f.equals(hoy) ? "hoy" : "normal";
            return (
              <Dia
                key={j}
                fecha={f}
                estado={estado}
                // Los bloqueados no eligen: solo avisan (como en Android)
                alTocar={() => (bloqueado ? alTocarBloqueado?.(f) : elegir(f))}
              />
            );
          })}
        </View>
      ))}

      <View style={estilos.leyendas}>
        {diaHabilitado ? (
          <>
            <View style={[estilos.muestra, { backgroundColor: Colores.black }]} />
            <Texto variante="chico" style={estilos.leyenda}>{leyendaBloqueado}</Texto>
          </>
        ) : null}
        <View style={[estilos.muestra, estilos.muestraHoy, diaHabilitado ? { marginLeft: 16 } : null]} />
        <Texto variante="chico" style={estilos.leyenda}>Hoy</Texto>
      </View>
      <Boton titulo="Cancelar" variante="texto" alto={44} onPress={alCerrar} estilo={estilos.cancelar} />
    </DialogoCentral>
  );
}

const estilos = StyleSheet.create({
  subtitulo: { marginTop: 2 },
  navegacion: { flexDirection: "row", alignItems: "center", marginTop: 14 },
  mes: { flex: 1 },
  apagado: { opacity: 0.35 },
  semana: { flexDirection: "row", marginTop: 2 },
  celdaSemana: { flex: 1, alignItems: "center", paddingVertical: 6 },
  celda: { flex: 1, height: 44, alignItems: "center", justifyContent: "center" },
  circulo: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  leyendas: { flexDirection: "row", alignItems: "center", marginTop: 14 },
  muestra: { width: 14, height: 14, borderRadius: 7 },
  muestraHoy: { borderWidth: 2, borderColor: Colores.primaryTeal },
  leyenda: { marginLeft: 6 },
  cancelar: { alignSelf: "flex-end", marginTop: 6, minWidth: 100 },
});
