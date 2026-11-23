/*
 * Migrado de ui/common/FiltroLineaTiempo.kt: buscador y filtros de una línea de tiempo (texto libre, tipo de evento y
 * rango de fechas).
 *
 * En Kotlin era una clase con una `vista` y un `admite`; acá son un hook con el estado y la regla (`useFiltroLineaTiempo`)
 * y el componente que lo dibuja (`<FiltroLineaTiempo filtro={f} tipos={...} />`):
 *
 *   const filtro = useFiltroLineaTiempo();
 *   <FiltroLineaTiempo filtro={filtro} tipos={["Consulta", "Vacuna"]} />
 *   const visibles = eventos.filter((e) => filtro.admite(e.titulo, e.tipo, e.fecha));
 *   if (visibles.length === 0) → filtro.activo ? "sin resultados" : "sin eventos"
 */
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Fechas } from "../../util/fechas";
import type { LocalDate } from "../../util/tiempo";
import { Campo } from "./Campo";
import { Icono } from "./Icono";
import { SelectorFecha } from "./SelectorFecha";
import { Colores, sombra } from "./tema";
import { Texto } from "./Texto";
import { cursorTocable, estiloFoco, useFoco } from "./Web";

/** Lo que el usuario tiene puesto en el filtro ([consulta] es el texto tal cual se escribió; se usa sin espacios en los bordes). */
export interface EstadoFiltro {
  consulta: string;
  tipo: string | null;
  desde: LocalDate | null;
  hasta: LocalDate | null;
}

export const FILTRO_VACIO: EstadoFiltro = { consulta: "", tipo: null, desde: null, hasta: null };

/** True si hay algún filtro puesto (para mostrar "sin resultados" en vez de "sin eventos"). */
export function filtroActivo(e: EstadoFiltro): boolean {
  return e.consulta.trim() !== "" || e.tipo !== null || e.desde !== null || e.hasta !== null;
}

/** Decide si una fila queda: [texto] es donde se busca, [tipoEvento] el tipo y [fecha] el día (null si no tiene). */
export function filtroAdmite(e: EstadoFiltro, texto: string, tipoEvento: string, fecha: LocalDate | null): boolean {
  if (e.tipo !== null && tipoEvento.toLowerCase() !== e.tipo.toLowerCase()) return false;
  if (e.desde !== null && (fecha === null || fecha.isBefore(e.desde))) return false;
  if (e.hasta !== null && (fecha === null || fecha.isAfter(e.hasta))) return false;
  const consulta = e.consulta.trim();
  return consulta === "" || texto.toLowerCase().includes(consulta.toLowerCase());
}

export interface FiltroControl {
  estado: EstadoFiltro;
  /** Cambia partes del filtro. */
  cambiar: (parcial: Partial<EstadoFiltro>) => void;
  /** Quita todos los filtros. */
  limpiar: () => void;
  activo: boolean;
  admite: (texto: string, tipoEvento: string, fecha: LocalDate | null) => boolean;
}

/** El estado y la regla del filtro; lo usa la pantalla que tiene la lista. */
export function useFiltroLineaTiempo(): FiltroControl {
  const [estado, setEstado] = useState<EstadoFiltro>(FILTRO_VACIO);
  const cambiar = useCallback((parcial: Partial<EstadoFiltro>) => setEstado((e) => ({ ...e, ...parcial })), []);
  const limpiar = useCallback(() => setEstado(FILTRO_VACIO), []);
  return {
    estado, cambiar, limpiar,
    activo: filtroActivo(estado),
    admite: (texto, tipoEvento, fecha) => filtroAdmite(estado, texto, tipoEvento, fecha),
  };
}

export interface FiltroLineaTiempoProps {
  filtro: FiltroControl;
  /** Los tipos de evento que se pueden elegir; con uno solo no se muestran los chips. */
  tipos: string[];
}

function Pildora({ texto, activa, alTocar, ancho }: { texto: string; activa: boolean; alTocar: () => void; ancho?: boolean }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: activa }}
      accessibilityLabel={texto}
      onPress={alTocar}
      {...foco.props}
      style={[estilos.pildora, activa ? estilos.pildoraActiva : estilos.pildoraInactiva, ancho ? null : sombra(1), cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Texto variante="etiqueta" tamano={14} color={activa ? Colores.white : Colores.textGray}>{texto}</Texto>
    </Pressable>
  );
}

function BotonFecha({
  etiqueta, fecha, alTocar, alQuitar,
}: { etiqueta: string; fecha: LocalDate | null; alTocar: () => void; alQuitar: () => void }) {
  const foco = useFoco();
  const activa = fecha !== null;
  const color = activa ? Colores.white : Colores.textGray;
  return (
    <View style={[estilos.botonFecha, activa ? estilos.pildoraActiva : estilos.pildoraBlanca]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${etiqueta}: ${fecha ? Fechas.corta(fecha) : "sin elegir"}`}
        onPress={alTocar}
        {...foco.props}
        style={[estilos.textoFecha, cursorTocable, estiloFoco(foco.enfocado)]}
      >
        <Texto variante="chico" tamano={13} color={color} centrado>
          {`${etiqueta}: ${fecha ? Fechas.corta(fecha) : "—"}`}
        </Texto>
      </Pressable>
      {fecha ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Quitar la fecha" onPress={alQuitar} hitSlop={8} style={[estilos.quitar, cursorTocable]}>
          <Icono nombre="cerrar" tamano={14} color={Colores.white} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Buscador, chips de tipo y rango de fechas; se pone arriba de la lista. */
export function FiltroLineaTiempo({ filtro, tipos }: FiltroLineaTiempoProps) {
  const { estado, cambiar, limpiar } = filtro;
  const [eligiendo, setEligiendo] = useState<"desde" | "hasta" | null>(null);
  const focoLimpiar = useFoco();

  return (
    <View style={estilos.raiz}>
      <Campo
        forma="pildora" icono="buscar" placeholder="Buscar en el historial" value={estado.consulta}
        onChangeText={(t) => cambiar({ consulta: t })}
        accessibilityLabel="Buscar en el historial" returnKeyType="search" autoCorrect={false}
      />

      {tipos.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.tipos} contentContainerStyle={estilos.tiposContenido}>
          {([null, ...tipos] as (string | null)[]).map((t) => (
            <View key={t ?? "todos"} style={estilos.chipMargen}>
              <Pildora texto={t ?? "Todos"} activa={estado.tipo === t} alTocar={() => cambiar({ tipo: t })} />
            </View>
          ))}
        </ScrollView>
      ) : null}

      <View style={estilos.fechas}>
        <BotonFecha etiqueta="Desde" fecha={estado.desde} alTocar={() => setEligiendo("desde")} alQuitar={() => cambiar({ desde: null })} />
        <BotonFecha etiqueta="Hasta" fecha={estado.hasta} alTocar={() => setEligiendo("hasta")} alQuitar={() => cambiar({ hasta: null })} />
        {filtro.activo ? (
          <Pressable
            accessibilityRole="button" accessibilityLabel="Limpiar" onPress={limpiar} {...focoLimpiar.props}
            style={[estilos.limpiar, cursorTocable, estiloFoco(focoLimpiar.enfocado)]}
          >
            <Texto variante="chico" tamano={13} color={Colores.primaryTeal}>Limpiar</Texto>
          </Pressable>
        ) : null}
      </View>

      <SelectorFecha
        visible={eligiendo !== null}
        valor={eligiendo === "desde" ? estado.desde : eligiendo === "hasta" ? estado.hasta : null}
        titulo={eligiendo === "hasta" ? "Hasta" : "Desde"}
        alElegir={(f) => cambiar(eligiendo === "hasta" ? { hasta: f } : { desde: f })}
        alCerrar={() => setEligiendo(null)}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { paddingHorizontal: 0, paddingTop: 8, paddingBottom: 4 },
  tipos: { marginTop: 10, flexGrow: 0 },
  tiposContenido: { paddingBottom: 4 },
  chipMargen: { marginRight: 8 },
  pildora: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 22 },
  pildoraActiva: { backgroundColor: Colores.primaryTeal, borderRadius: 20 },
  pildoraInactiva: { backgroundColor: Colores.white },
  pildoraBlanca: { backgroundColor: Colores.white, borderRadius: 22 },
  fechas: { flexDirection: "row", alignItems: "center", paddingTop: 6, paddingBottom: 2 },
  botonFecha: { flex: 1, marginRight: 8, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  textoFecha: { flex: 1, paddingHorizontal: 10, paddingVertical: 9 },
  quitar: { paddingRight: 8, paddingVertical: 8 },
  limpiar: { padding: 8 },
});
