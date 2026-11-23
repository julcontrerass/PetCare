/*
 * Migrado de ui/dueno/CalendarioPantalla.kt + pantalla_calendario.xml: calendario mensual con los turnos del día elegido.
 * Es una sección sin pestaña marcada en la barra inferior.
 */
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { DuenoRepo } from "../../data/repositorio/duenoRepo";
import { Fechas } from "../../util/fechas";
import { LocalDate, YearMonth } from "../../util/tiempo";
import { EstadoVacio } from "../common/EstadoVacio";
import { Icono } from "../common/Icono";
import { PantallaBase } from "../common/PantallaBase";
import { Colores, sombra } from "../common/tema";
import { Texto } from "../common/Texto";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { useDatos } from "../common/useDatos";
import { useSesionRequerida } from "../common/useSesionRequerida";
import { BotonAgregar, EtiquetaColor, FilaEvento } from "./ComponentesHome";
import { EstadoDueno } from "./estadoDueno";
import { useEventosDialogos } from "./EventosDialogos";
import { NavDueno } from "./navegacionDueno";

const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

function BotonMes({ icono, etiqueta, alTocar }: { icono: "chevronIzquierda" | "chevronDerecha"; etiqueta: string; alTocar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={etiqueta} onPress={alTocar} {...foco.props}
      style={[estilos.botonMes, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Icono nombre={icono} tamano={20} color={Colores.primaryTeal} />
    </Pressable>
  );
}

function CasilleroDia({ fecha, alTocar }: { fecha: LocalDate; alTocar: () => void }) {
  const hoy = LocalDate.now();
  const seleccionado = fecha.equals(EstadoDueno.diaSeleccionado);
  const esHoy = fecha.equals(hoy);
  const esPasado = fecha.isBefore(hoy);
  const hayEventos = DuenoRepo.eventosDelDia(fecha).length > 0;
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={Fechas.larga(fecha)} accessibilityState={{ selected: seleccionado }}
      onPress={alTocar} {...foco.props} style={[estilos.casillero, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <View style={[estilos.dia, seleccionado ? estilos.diaSeleccionado : esHoy ? estilos.diaHoy : null]}>
        <Texto
          tamano={14} negrita={seleccionado || esHoy}
          color={seleccionado ? Colores.white : esHoy ? Colores.primaryTeal : esPasado ? Colores.textGray : Colores.brandNavy}
          style={!seleccionado && !esHoy && esPasado ? { opacity: 0.6 } : null}
        >
          {String(fecha.dayOfMonth)}
        </Texto>
      </View>
      {hayEventos ? <View style={[estilos.punto, { backgroundColor: esPasado ? Colores.primaryTeal : Colores.accentOrange }]} /> : null}
    </Pressable>
  );
}

export default function CalendarioPantalla() {
  useSesionRequerida();
  useDatos();
  const [, redibujar] = useState(0);
  const eventosUi = useEventosDialogos();
  const cambiar = () => redibujar((n) => n + 1);

  const mes: YearMonth = EstadoDueno.mesCalendario;
  const dia = EstadoDueno.diaSeleccionado;
  const turnosDelMes = DuenoRepo.cantidadDelMes(mes);
  const vacios = mes.atDay(1).dayOfWeek - 1;
  const celdas: (LocalDate | null)[] = [
    ...Array.from({ length: vacios }, () => null),
    ...Array.from({ length: mes.lengthOfMonth() }, (_, i) => mes.atDay(i + 1)),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);
  const semanas: (LocalDate | null)[][] = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));

  const eventos = DuenoRepo.eventosDelDia(dia);
  const prefijo = dia.equals(LocalDate.now()) ? "Turnos de hoy · " : "Turnos del ";

  return (
    <PantallaBase
      bordes={["top"]} titulo="Calendario" alVolver={() => NavDueno.irAHome()}
      subtitulo={turnosDelMes === 0 ? "Sin turnos este mes" : turnosDelMes === 1 ? "1 turno este mes" : `${turnosDelMes} turnos este mes`}
      derecha={<BotonAgregar etiqueta="Agregar evento" onPress={() => NavDueno.irANuevoEvento(EstadoDueno.diaSeleccionado)} />}
    >
      <View style={estilos.tarjeta}>
        <View style={estilos.cabeceraMes}>
          <BotonMes icono="chevronIzquierda" etiqueta="Mes anterior" alTocar={() => { EstadoDueno.mesCalendario = mes.minusMonths(1); cambiar(); }} />
          <Texto tamano={17} negrita centrado style={{ flex: 1 }} accessibilityRole="header">{Fechas.mesAnio(mes)}</Texto>
          <Pressable
            accessibilityRole="button" accessibilityLabel="Hoy" style={[estilos.hoy, cursorTocable]}
            onPress={() => { EstadoDueno.diaSeleccionado = LocalDate.now(); EstadoDueno.mesCalendario = YearMonth.now(); cambiar(); }}
          >
            <Texto tamano={12.5} negrita color={Colores.primaryTeal}>Hoy</Texto>
          </Pressable>
          <BotonMes icono="chevronDerecha" etiqueta="Mes siguiente" alTocar={() => { EstadoDueno.mesCalendario = mes.plusMonths(1); cambiar(); }} />
        </View>
        <View style={estilos.semana}>
          {DIAS.map((d) => (
            <View key={d} style={estilos.encabezadoDia}>
              <Texto tamano={12} negrita color={Colores.textGray}>{d}</Texto>
            </View>
          ))}
        </View>
        {semanas.map((semana, i) => (
          <View key={i} style={estilos.semana}>
            {semana.map((f, j) =>
              f ? (
                <CasilleroDia key={j} fecha={f} alTocar={() => { EstadoDueno.diaSeleccionado = f; cambiar(); }} />
              ) : (
                <View key={j} style={estilos.casillero} />
              ),
            )}
          </View>
        ))}
      </View>

      <View style={estilos.tituloDia}>
        <Texto tamano={18} negrita style={{ flex: 1 }}>{`${prefijo}${dia.dayOfMonth} de ${Fechas.nombreMes(dia.monthValue).toLowerCase()}`}</Texto>
        {eventos.length > 0 ? (
          <EtiquetaColor texto={eventos.length === 1 ? "1 turno" : `${eventos.length} turnos`} fondo={Colores.lightGreen} color={Colores.successGreen} />
        ) : null}
      </View>
      <View style={{ marginTop: 2 }}>
        {eventos.map((e) => (
          <FilaEvento
            key={e.id} evento={e} chevron titulo={e.categoria === DuenoRepo.CATEGORIA_VACUNA ? "Vacunación" : e.categoria}
            subtitulo={e.mascota + (e.veterinario ? ` · ${e.veterinario}` : "")}
            chip={{ texto: e.hora, fondo: "#EEF2F1", color: Colores.tealDark }}
            onPress={() => eventosUi.mostrarDetalle(e, cambiar)}
          />
        ))}
        {eventos.length === 0 ? (
          <EstadoVacio
            icono="calendario" titulo="Sin turnos este día" mensaje="Agendá un control o una vacuna para tus mascotas"
            textoBoton="+ Agendar turno" alBoton={() => NavDueno.irANuevoEvento(EstadoDueno.diaSeleccionado)} estilo={{ marginTop: 12 }}
          />
        ) : null}
      </View>
      {eventosUi.dialogos}
    </PantallaBase>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { marginTop: 4, padding: 14, backgroundColor: Colores.white, borderRadius: 18, ...sombra(1) },
  cabeceraMes: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  botonMes: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
  hoy: { backgroundColor: Colores.lightGreen, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, marginRight: 8 },
  semana: { flexDirection: "row" },
  encabezadoDia: { flex: 1, alignItems: "center", paddingVertical: 6 },
  casillero: { flex: 1, height: 48, alignItems: "center" },
  dia: { width: 38, height: 38, borderRadius: 19, marginTop: 2, alignItems: "center", justifyContent: "center" },
  diaSeleccionado: { backgroundColor: Colores.primaryTeal },
  diaHoy: { borderWidth: 2, borderColor: Colores.primaryTeal },
  punto: { position: "absolute", bottom: 1, width: 6, height: 6, borderRadius: 3 },
  tituloDia: { flexDirection: "row", alignItems: "center", marginTop: 22 },
});
