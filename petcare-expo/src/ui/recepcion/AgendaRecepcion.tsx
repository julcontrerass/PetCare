/*
 * Agenda de la recepción, como la del veterinario (AgendaVet): próximos, completados y cancelados, agrupados por
 * fecha, con el filtro por veterinario cuando trabaja para más de uno. Con un veterinario elegido (o si es uno solo),
 * arriba está su próximo bloqueo de agenda, que abre la hoja para bloquear horarios.
 */
import { useState } from "react";
import { FlatList } from "react-native";
import { RecepcionAgendaRepo, type TurnoRecepcion } from "../../data/repositorio/recepcionAgendaRepo";
import { Fechas } from "../../util/fechas";
import type { LocalDate } from "../../util/tiempo";
import { EstadoVacio } from "../common/EstadoVacio";
import { PantallaBase } from "../common/PantallaBase";
import { Texto } from "../common/Texto";
import { useDatos } from "../common/useDatos";
import { PestanasVet } from "../veterinario/PestanasVet";
import { EditorTurnoRecepcion } from "./EditorTurnoRecepcion";
import { FiltroVeterinarios, SinVeterinarios, TarjetaTurno, TurnoHoja } from "./ElementosRecepcion";
import { NavRecepcion } from "./navegacionRecepcion";
import { BloqueosRepo } from "../../data/repositorio/bloqueosRepo";
import { Servicios } from "../../data/servicios";
import { turnosQuePisan } from "../../model/bloqueos";
import { AvisoBloqueo } from "../common/AvisoBloqueo";
import { HojaBloqueos } from "../common/HojaBloqueos";

const PESTANAS = ["Próximos", "Completados", "Cancelados"];
const SIN_TURNOS = ["No hay turnos próximos", "No hay turnos completados", "No hay turnos cancelados"];

type Fila = { tipo: "encabezado"; texto: string } | { tipo: "turno"; turno: TurnoRecepcion };

/** Un encabezado por fecha ("Hoy · 12 oct"), como en la agenda del veterinario. */
function filasPorFecha(turnos: TurnoRecepcion[]): Fila[] {
  const filas: Fila[] = [];
  let ultima: LocalDate | null = null;
  for (const t of turnos) {
    if (ultima === null || !t.fecha.equals(ultima)) {
      filas.push({ tipo: "encabezado", texto: Fechas.relativaConFecha(t.fecha) });
      ultima = t.fecha;
    }
    filas.push({ tipo: "turno", turno: t });
  }
  return filas;
}

export function AgendaRecepcion() {
  useDatos();
  const [pestana, setPestana] = useState(0);
  const [vet, setVet] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [moviendo, setMoviendo] = useState<TurnoRecepcion | null>(null);
  const turnos =
    pestana === 1 ? RecepcionAgendaRepo.porEstado("COMPLETADO", vet)
      : pestana === 2 ? RecepcionAgendaRepo.porEstado("CANCELADO", vet)
        : RecepcionAgendaRepo.proximos(vet);
  const filas = filasPorFecha(turnos);
  const sinVets = RecepcionAgendaRepo.veterinarios.length === 0;
  const [bloqueos, setBloqueos] = useState(false);
  // Los bloqueos son de un veterinario: el elegido en el filtro, o el único
  const vetBloqueos = vet != null
    ? RecepcionAgendaRepo.veterinarios.find((v) => v.id === vet) ?? null
    : RecepcionAgendaRepo.veterinarios.length === 1 ? RecepcionAgendaRepo.veterinarios[0] : null;

  return (
    <PantallaBase
      titulo="Agenda" subtitulo={turnos.length === 1 ? "1 turno" : `${turnos.length} turnos`} alVolver={NavRecepcion.irAHoy}
      scroll={false} bordes={["top"]}
    >
      {sinVets ? (
        <SinVeterinarios />
      ) : (
        <>
          <FiltroVeterinarios elegido={vet} alElegir={setVet} />
          {vetBloqueos ? <AvisoBloqueo bloqueos={BloqueosRepo.de(vetBloqueos.id)} alTocar={() => setBloqueos(true)} /> : null}
          <PestanasVet etiquetas={PESTANAS} seleccionada={pestana} alElegir={setPestana} />
          {filas.length === 0 ? (
            <EstadoVacio
              icono="calendario" titulo={SIN_TURNOS[pestana]} mensaje="Los turnos de tus veterinarios aparecen acá"
              textoBoton={pestana === 0 ? "Sacar un turno" : undefined} alBoton={pestana === 0 ? () => NavRecepcion.nuevoTurno(vet) : undefined}
            />
          ) : (
            <FlatList
              data={filas}
              keyExtractor={(f, i) => (f.tipo === "turno" ? f.turno.id : `h${i}`)}
              renderItem={({ item }) =>
                item.tipo === "encabezado" ? (
                  <Texto variante="cuerpo" tamano={15} negrita style={{ paddingTop: 12, paddingBottom: 8 }}>{item.texto}</Texto>
                ) : (
                  <TarjetaTurno turno={item.turno} alTocar={() => setAbierto(item.turno.id)} />
                )
              }
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
            />
          )}
        </>
      )}
      {abierto ? (
        <TurnoHoja turnoId={abierto} alCerrar={() => setAbierto(null)} alMover={(t) => { setAbierto(null); setMoviendo(t); }} />
      ) : null}
      {moviendo ? <EditorTurnoRecepcion turno={moviendo} alCerrar={() => setMoviendo(null)} /> : null}
      {vetBloqueos ? (
        <HojaBloqueos
          visible={bloqueos} veterinarioId={vetBloqueos.id} veterinario={vetBloqueos.nombre}
          turnosEntre={(desde, hasta) => turnosQuePisan(RecepcionAgendaRepo.proximos(vetBloqueos.id), desde, hasta)}
          alCambiar={() => {
            RecepcionAgendaRepo.cargar().then(() => Servicios.avisarCambio()).catch(() => Servicios.avisarCambio());
          }}
          alCerrar={() => setBloqueos(false)}
        />
      ) : null}
    </PantallaBase>
  );
}

export default AgendaRecepcion;
