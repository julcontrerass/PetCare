/*
 * Migrado de ui/common/PanelAvisos.kt (+ layout/panel_avisos.xml).
 *
 * Panel de notificaciones del dueño y del veterinario: sube desde abajo, agrupa los avisos por día (hoy, ayer, esta
 * semana, anteriores), resalta los que no se leyeron y se puede vaciar de una vez.
 */
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { TipoNotificacion } from "../../model/modelos";
import { LocalDate, type LocalDateTime } from "../../util/tiempo";
import { DialogoCentral } from "./DialogoCentral";
import { HojaInferior } from "./HojaInferior";
import { Boton } from "./Boton";
import { Icono } from "./Icono";
import { TarjetaAviso } from "./TarjetaAviso";
import { TarjetaPermiso } from "./TarjetaPermiso";
import { Colores } from "./tema";
import { Texto } from "./Texto";
import { cursorTocable, estiloFoco, useFoco } from "./Web";

/** Un aviso listo para mostrar; [origen] guarda el objeto original para que quien llama sepa cuál borrar. */
export interface ItemAviso {
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  creada: LocalDateTime;
  sinLeer: boolean;
  origen?: unknown;
}

/** Texto del grupo de fecha en el que cae un aviso. */
export function grupo(fecha: LocalDate, hoy: LocalDate = LocalDate.now()): string {
  if (fecha.equals(hoy)) return "HOY";
  if (fecha.equals(hoy.minusDays(1))) return "AYER";
  if (!fecha.isBefore(hoy.minusDays(6))) return "ESTA SEMANA";
  return "ANTERIORES";
}

/** Texto de la bajada del título según cuántos avisos quedan sin leer. */
export function resumen(total: number, sinLeer: number): string {
  if (total === 0) return "Estás al día";
  if (sinLeer === 0) return "Todo leído";
  if (sinLeer === 1) return "1 sin leer";
  return `${sinLeer} sin leer`;
}

export interface PanelAvisosProps {
  visible: boolean;
  alCerrar: () => void;
  /** Los avisos a mostrar; se toma una copia cada vez que el panel se abre (los más nuevos van primero). */
  avisos: ItemAviso[];
  /** Se llama cuando se borra un aviso (ya se sacó de la lista del panel). */
  alBorrar: (item: ItemAviso) => void;
  /** Se llama cuando se confirma "Borrar todas". */
  alBorrarTodas: () => void;
}

function BorrarTodas({ alTocar }: { alTocar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Borrar todas"
      onPress={alTocar}
      {...foco.props}
      style={[estilos.borrarTodas, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Texto variante="etiqueta" tamano={14} color={Colores.primaryTeal}>Borrar todas</Texto>
    </Pressable>
  );
}

function PanelAvisosComponente({ visible, alCerrar, avisos, alBorrar, alBorrarTodas }: PanelAvisosProps) {
  const [restantes, setRestantes] = useState<ItemAviso[]>([]);
  const [confirmando, setConfirmando] = useState(false);

  useEffect(() => {
    if (visible) {
      setRestantes([...avisos].sort((a, b) => b.creada.compareTo(a.creada)));
      setConfirmando(false);
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const sinLeer = restantes.filter((i) => i.sinLeer).length;
  const hoy = LocalDate.now();

  const borrar = (item: ItemAviso) => {
    setRestantes((actuales) => {
      if (!actuales.includes(item)) return actuales;
      return actuales.filter((i) => i !== item);
    });
    alBorrar(item);
  };

  const confirmarBorrarTodas = () => {
    setConfirmando(false);
    setRestantes([]);
    alBorrarTodas();
  };

  const filas: React.ReactNode[] = [];
  let grupoActual: string | null = null;
  restantes.forEach((item, i) => {
    const g = grupo(item.creada.toLocalDate(), hoy);
    if (g !== grupoActual) {
      filas.push(
        <Texto key={`g-${g}`} variante="etiqueta" tamano={12} color={Colores.textGray} accessibilityRole="header" style={estilos.grupo}>
          {g}
        </Texto>,
      );
      grupoActual = g;
    }
    filas.push(
      <TarjetaAviso
        key={`a-${i}-${item.creada.toString()}-${item.titulo}`}
        tipo={item.tipo} titulo={item.titulo} mensaje={item.mensaje} creada={item.creada} sinLeer={item.sinLeer}
        alBorrar={() => borrar(item)}
      />,
    );
  });

  return (
    <>
      <HojaInferior visible={visible} alCerrar={alCerrar} alturaMaxima={0.92}>
        <View style={estilos.cabecera}>
          <View style={estilos.titulos}>
            <Texto variante="titulo" accessibilityRole="header">Notificaciones</Texto>
            <Texto
              variante="subtitulo" tamano={14} peso={sinLeer > 0 ? "bold" : "regular"}
              color={sinLeer > 0 ? Colores.primaryTeal : Colores.textAviso} style={estilos.resumen}
            >
              {resumen(restantes.length, sinLeer)}
            </Texto>
          </View>
          {restantes.length > 0 ? <BorrarTodas alTocar={() => setConfirmando(true)} /> : null}
        </View>

        <View style={estilos.lista}>
          <TarjetaPermiso />
          {filas}
        </View>

        {restantes.length === 0 ? (
          <View style={estilos.vacio}>
            <View style={estilos.circuloVacio}>
              <Icono nombre="notificacion" tamano={32} color={Colores.primaryTeal} />
            </View>
            <Texto variante="titulo" tamano={18} style={estilos.tituloVacio}>Estás al día</Texto>
            <Texto variante="subtitulo" tamano={14} centrado color={Colores.textAviso} style={estilos.mensajeVacio}>
              Cuando tengas turnos, avisos o solicitudes, los vas a ver acá.
            </Texto>
          </View>
        ) : null}
      </HojaInferior>

      <DialogoCentral visible={visible && confirmando} alCerrar={() => setConfirmando(false)} estilo={estilos.cartel}>
        <View style={estilos.iconoCartel}>
          <Icono nombre="cancelar" tamano={32} color={Colores.dangerRed} />
        </View>
        <Texto variante="titulo" tamano={20} centrado accessibilityRole="header" style={estilos.tituloCartel}>
          Borrar todas las notificaciones
        </Texto>
        <Texto variante="subtitulo" centrado style={estilos.mensajeCartel}>Esta acción no se puede deshacer.</Texto>
        <View style={estilos.botonesCartel}>
          <Boton titulo="Cancelar" variante="secundario" alto={50} onPress={() => setConfirmando(false)} estilo={estilos.botonCartel} />
          <Boton titulo="Borrar" variante="peligro" alto={50} onPress={confirmarBorrarTodas} estilo={estilos.botonCartel} />
        </View>
      </DialogoCentral>
    </>
  );
}

/**
 * Hoja con las notificaciones. `PanelAvisos.grupo(fecha, hoy)` y `PanelAvisos.resumen(total, sinLeer)` son las
 * funciones puras.
 */
export const PanelAvisos = Object.assign(PanelAvisosComponente, { grupo, resumen });

const estilos = StyleSheet.create({
  cabecera: { flexDirection: "row", alignItems: "center", paddingTop: 6, paddingBottom: 4 },
  titulos: { flex: 1 },
  resumen: { marginTop: 2 },
  borrarTodas: { minHeight: 48, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  lista: { paddingTop: 8, paddingBottom: 12 },
  grupo: { paddingLeft: 4, paddingTop: 10, paddingBottom: 8, letterSpacing: 1 },
  vacio: { alignItems: "center", paddingHorizontal: 10, paddingTop: 20, paddingBottom: 26 },
  circuloVacio: { width: 72, height: 72, borderRadius: 36, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
  tituloVacio: { marginTop: 16 },
  mensajeVacio: { marginTop: 4 },
  cartel: { alignItems: "center", paddingHorizontal: 24, paddingTop: 28, paddingBottom: 22 },
  iconoCartel: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", backgroundColor: Colores.lightRed },
  tituloCartel: { marginTop: 18 },
  mensajeCartel: { marginTop: 8 },
  botonesCartel: { flexDirection: "row", marginTop: 22, alignSelf: "stretch" },
  botonCartel: { flex: 1, marginHorizontal: 4 },
});
