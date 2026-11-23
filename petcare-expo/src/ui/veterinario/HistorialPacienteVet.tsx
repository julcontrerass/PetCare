/*
 * Migrado de ui/veterinario/HistorialPacienteFragment.kt + HistorialVetAdapter.kt (fragment_historial_paciente.xml,
 * item_historial_vet.xml). Pestaña "Historial clínico": los turnos y consultas del paciente con buscador y filtros.
 */
import { Pressable, StyleSheet, View } from "react-native";
import { AgendaRepo } from "../../data/repositorio/agendaRepo";
import type { Paciente } from "../../data/repositorio/pacientesRepo";
import { Fechas } from "../../util/fechas";
import { EstadoVacio } from "../common/EstadoVacio";
import { FiltroLineaTiempo, useFiltroLineaTiempo } from "../common/FiltroLineaTiempo";
import { Icono, type NombreIcono } from "../common/Icono";
import { Texto } from "../common/Texto";
import { Colores, sombra } from "../common/tema";
import { useDatos } from "../common/useDatos";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { dosDigitos, iconoDeEvento, SeccionTitulo } from "./ElementosVet";
import { NavVet } from "./navegacionVet";

/** Un evento de la lista (HistorialVetUIItem.Event). */
export interface EventoHistorialVet {
  dia: string;
  mes: string;
  titulo: string;
  doctor: string;
  notas: string;
  icono: NombreIcono;
  eventoId: string | null;
}

export function FilaHistorialVet({ item }: { item: EventoHistorialVet }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={`${item.titulo}, ${item.dia} ${item.mes}`}
      onPress={() => item.eventoId && NavVet.detalleEvento(item.eventoId)}
      {...foco.props} style={[estilos.fila, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <View style={estilos.fecha}>
        <Texto variante="titulo" tamano={20} color={Colores.tealDark}>{item.dia}</Texto>
        <Texto variante="etiqueta" tamano={11} color={Colores.tealDark}>{item.mes}</Texto>
      </View>
      <View style={{ flex: 1, marginHorizontal: 12 }}>
        <Texto variante="titulo" tamano={15.5}>{item.titulo}</Texto>
        <Texto variante="cuerpo" tamano={13} color={Colores.tealDark}>{item.doctor}</Texto>
        {item.notas.trim() !== "" ? <Texto variante="chico" tamano={12.5} style={{ marginTop: 3 }}>{item.notas}</Texto> : null}
      </View>
      <View style={estilos.icono}><Icono nombre={item.icono} tamano={20} color={Colores.primaryTeal} /></View>
    </Pressable>
  );
}

export function HistorialPacienteVet({ paciente }: { paciente: Paciente }) {
  useDatos();
  const eventos = AgendaRepo.deMascota(paciente.id);
  const filtro = useFiltroLineaTiempo();
  const tipos = [...new Set(eventos.map((e) => e.tipo))].sort();
  const items: EventoHistorialVet[] = eventos
    .filter((e) => filtro.admite([e.tipo, e.motivo, e.veterinario, e.notas].join(" "), e.tipo, e.fecha))
    .map((e) => ({
      dia: dosDigitos(e.fecha.dayOfMonth),
      mes: Fechas.mesCorto(e.fecha),
      titulo: e.motivo,
      doctor: e.veterinario + (e.estado === "COMPLETADO" ? "" : ` · ${e.estado === "PENDIENTE" ? "Pendiente" : "Cancelado"}`),
      notas: e.notas,
      icono: iconoDeEvento(e.tipo),
      eventoId: e.id,
    }));
  const porFiltro = eventos.length > 0 && filtro.activo;
  return (
    <View>
      <SeccionTitulo texto="Eventos clínicos" estilo={{ marginTop: 0 }} />
      <FiltroLineaTiempo filtro={filtro} tipos={tipos} />
      {items.length === 0 ? (
        <EstadoVacio
          icono="documento" titulo={porFiltro ? "Sin resultados" : "Sin eventos clínicos"}
          mensaje={porFiltro ? "Ningún evento coincide con la búsqueda o los filtros" : "Los turnos y consultas de este paciente aparecen acá"}
        />
      ) : (
        items.map((item, i) => <FilaHistorialVet key={item.eventoId ?? i} item={item} />)
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center", backgroundColor: Colores.white, borderRadius: 18, padding: 12, marginTop: 10, ...sombra(1) },
  fecha: { width: 54, paddingVertical: 6, borderRadius: 14, backgroundColor: Colores.lightTeal, alignItems: "center" },
  icono: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
});
