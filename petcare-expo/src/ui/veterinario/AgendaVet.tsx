/*
 * Migrado de ui/veterinario/AgendaVetSeccion.kt (+ AgendaAdapter y AgendaFila) con seccion_vet_agenda.xml,
 * item_agenda_vet.xml e item_header_fecha.xml: los turnos próximos, completados y cancelados, agrupados por fecha.
 * Arriba, el próximo bloqueo de agenda (o "Bloquear horario"), que abre la hoja de bloqueos.
 */
import { useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { AgendaRepo, EstadosEvento, type EstadoEvento, type EventoVet } from "../../data/repositorio/agendaRepo";
import { PacientesRepo } from "../../data/repositorio/pacientesRepo";
import { PerfilVetRepo } from "../../data/repositorio/perfilVetRepo";
import { Fechas } from "../../util/fechas";
import type { LocalDate } from "../../util/tiempo";
import { Avatar } from "../common/Avatar";
import { Chip, type TonoChip } from "../common/Chip";
import { EstadoVacio } from "../common/EstadoVacio";
import { Icono } from "../common/Icono";
import { PantallaBase } from "../common/PantallaBase";
import { Tarjeta } from "../common/Tarjeta";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";
import { useDatos } from "../common/useDatos";
import { NavVet } from "./navegacionVet";
import { BloqueosRepo } from "../../data/repositorio/bloqueosRepo";
import { CuentaActual } from "../../data/cuentaActual";
import { Servicios } from "../../data/servicios";
import { turnosQuePisan } from "../../model/bloqueos";
import { AvisoBloqueo } from "../common/AvisoBloqueo";
import { HojaBloqueos } from "../common/HojaBloqueos";
import { PestanasVet } from "./PestanasVet";

export type AgendaFila = { tipo: "encabezado"; texto: string } | { tipo: "turno"; evento: EventoVet };

const TONO: Record<EstadoEvento, TonoChip> = { PENDIENTE: "aviso", COMPLETADO: "ok", CANCELADO: "peligro" };
const PESTANAS = ["Próximos", "Completados", "Cancelados"];
const SIN_TURNOS = ["No hay turnos próximos", "No hay turnos completados", "No hay turnos cancelados"];

/** Agrupa los turnos con un encabezado por fecha ("Hoy · 12 oct"). */
export function filasDeAgenda(eventos: EventoVet[]): AgendaFila[] {
  const filas: AgendaFila[] = [];
  let ultima: LocalDate | null = null;
  for (const e of eventos) {
    if (ultima === null || !e.fecha.equals(ultima)) {
      filas.push({ tipo: "encabezado", texto: Fechas.relativaConFecha(e.fecha) });
      ultima = e.fecha;
    }
    filas.push({ tipo: "turno", evento: e });
  }
  return filas;
}

function FilaTurno({ e }: { e: EventoVet }) {
  const lugar = PerfilVetRepo.sedes.length > 1 ? PerfilVetRepo.sede(e.sedeId) : null;
  return (
    <Tarjeta onPress={() => NavVet.detalleEvento(e.id)} relleno={12} estilo={{ marginBottom: 10 }} accessibilityLabel={`${e.hora} ${PacientesRepo.nombreDe(e.pacienteId)}`}>
      <View style={estilos.turno}>
        <View style={estilos.hora}>
          <Texto variante="etiqueta" tamano={15} color={Colores.tealDark}>{e.hora}</Texto>
        </View>
        <View style={{ flex: 1, minWidth: 0, marginHorizontal: 12 }}>
          <Texto variante="cuerpo" tamano={16} negrita numberOfLines={1}>{PacientesRepo.nombreDe(e.pacienteId)}</Texto>
          <Texto variante="chico" tamano={13} numberOfLines={2}>{`${e.tipo} · ${e.motivo}` + (lugar ? `\n${lugar.nombre}` : "")}</Texto>
          <Chip texto={EstadosEvento[e.estado].etiqueta} tono={TONO[e.estado]} estilo={{ marginTop: 6 }} />
        </View>
        <Avatar fotoPath={PacientesRepo.fotoDuenoDe(e.pacienteId)} tamano={36} estilo={{ marginLeft: 8, marginRight: 6 }} />
        <Icono nombre="chevronDerecha" tamano={22} color={Colores.textGray} />
      </View>
    </Tarjeta>
  );
}

export function AgendaVet() {
  useDatos();
  const [pestana, setPestana] = useState(0);
  const [bloqueos, setBloqueos] = useState(false);
  const yo = CuentaActual.usuarioId ?? "";
  const eventos = pestana === 1 ? AgendaRepo.porEstado("COMPLETADO") : pestana === 2 ? AgendaRepo.porEstado("CANCELADO") : AgendaRepo.proximos();
  const filas = filasDeAgenda(eventos);
  const cantidad = eventos.length;
  return (
    <PantallaBase
      titulo="Agenda" subtitulo={cantidad === 1 ? "1 turno" : `${cantidad} turnos`} alVolver={NavVet.irAInicio}
      scroll={false} bordes={["top"]}
    >
      <AvisoBloqueo bloqueos={BloqueosRepo.de(yo)} alTocar={() => setBloqueos(true)} />
      <PestanasVet etiquetas={PESTANAS} seleccionada={pestana} alElegir={setPestana} />
      {filas.length === 0 ? (
        <EstadoVacio icono="calendario" titulo={SIN_TURNOS[pestana]} mensaje="Los turnos agendados con vos aparecen acá" />
      ) : (
        <FlatList
          data={filas}
          keyExtractor={(f, i) => (f.tipo === "turno" ? f.evento.id : `h${i}`)}
          renderItem={({ item }) =>
            item.tipo === "encabezado" ? (
              <Texto variante="cuerpo" tamano={15} negrita style={{ paddingTop: 12, paddingBottom: 8 }}>{item.texto}</Texto>
            ) : (
              <FilaTurno e={item.evento} />
            )
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      )}
      <HojaBloqueos
        visible={bloqueos} veterinarioId={yo} veterinario={PerfilVetRepo.nombre}
        turnosEntre={(desde, hasta) => turnosQuePisan(AgendaRepo.eventos, desde, hasta)}
        alCambiar={() => {
          AgendaRepo.cargar().then(() => Servicios.avisarCambio()).catch(() => Servicios.avisarCambio());
        }}
        alCerrar={() => setBloqueos(false)}
      />
    </PantallaBase>
  );
}

export default AgendaVet;

const estilos = StyleSheet.create({
  turno: { flexDirection: "row", alignItems: "center" },
  hora: { width: 62, height: 46, borderRadius: 12, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
});
