/*
 * Migrado de `DetalleEventoVetActivity.mostrarFormulario` (el AlertDialog "Editar turno"). Edición de un turno propio:
 * tipo, lugar de atención, motivo, fecha, hora y notas. Los selectores de fecha y hora se abren dentro de la hoja.
 */
import { useEffect, useState } from "react";
import { View } from "react-native";
import { AgendaRepo, type EventoVet } from "../../data/repositorio/agendaRepo";
import { DisponibilidadVet } from "../../data/repositorio/disponibilidadVet";
import { PerfilVetRepo } from "../../data/repositorio/perfilVetRepo";
import { textoLugarSede } from "../../model/modelos";
import { Fechas } from "../../util/fechas";
import type { LocalDate } from "../../util/tiempo";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Campo } from "../common/Campo";
import { HojaInferior } from "../common/HojaInferior";
import { Texto } from "../common/Texto";
import { CampoSeleccion, CampoTocable, EtiquetaForm } from "./ElementosVet";
import { SelectorFechaVet, SelectorHoraVet } from "./SelectoresVet";

export interface EditorTurnoVetProps {
  visible: boolean;
  evento: EventoVet;
  alCerrar: () => void;
  /** Se llama después de guardar, para que la pantalla se dibuje de nuevo. */
  alGuardar: () => void;
}

export function EditorTurnoVet({ visible, evento, alCerrar, alGuardar }: EditorTurnoVetProps) {
  const tipos = AgendaRepo.tipos(evento.tipo);
  const sedes = PerfilVetRepo.sedes.slice();
  const [tipoIdx, setTipoIdx] = useState(0);
  const [sedeIdx, setSedeIdx] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [fecha, setFecha] = useState<LocalDate>(evento.fecha);
  const [hora, setHora] = useState(evento.hora);
  const [notas, setNotas] = useState("");
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);
  const [errorHora, setErrorHora] = useState<string | null>(null);
  const [selFecha, setSelFecha] = useState(false);
  const [selHora, setSelHora] = useState(false);

  // Cada vez que se abre se parte de los datos actuales del turno
  useEffect(() => {
    if (!visible) return;
    setTipoIdx(Math.max(0, AgendaRepo.tipos(evento.tipo).indexOf(evento.tipo)));
    setSedeIdx(Math.max(0, PerfilVetRepo.sedes.findIndex((s) => s.id === evento.sedeId)));
    setMotivo(evento.motivo);
    setFecha(evento.fecha);
    setHora(evento.hora);
    setNotas(evento.notas);
    setErrorMotivo(null);
    setErrorHora(null);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const tipo = tipos[tipoIdx] ?? evento.tipo;
  const sede = sedes[sedeIdx] ?? null;
  const duracion = () => PerfilVetRepo.duracionDe(tipo);

  const guardar = () => {
    if (motivo.trim() === "") {
      setErrorMotivo("Requerido");
      return;
    }
    // Si no se movió el turno no se revalida (puede ser de hoy y ya estar en curso)
    const sedeNueva = sede && sede.id.trim() ? sede.id : evento.sedeId;
    const cambioHorario = !fecha.equals(evento.fecha) || hora !== evento.hora || tipo !== evento.tipo || sedeNueva !== evento.sedeId;
    const problema = hora.trim() === "" ? "Elegí un horario" : cambioHorario ? DisponibilidadVet.validar(fecha, hora, duracion(), evento.id, sede) : null;
    if (problema !== null) {
      setErrorHora(problema);
      Avisos.mostrar(problema);
      return;
    }
    evento.tipo = tipo;
    evento.duracionMin = PerfilVetRepo.duracionDe(evento.tipo);
    evento.motivo = motivo.trim();
    evento.fecha = fecha;
    evento.hora = hora;
    if (sede && sede.id.trim()) evento.sedeId = sede.id;
    evento.notas = notas.trim();
    AgendaRepo.guardar(evento);
    alGuardar();
    alCerrar();
  };

  return (
    <HojaInferior visible={visible} alCerrar={alCerrar}>
      <Texto variante="titulo" tamano={21} accessibilityRole="header">Editar turno</Texto>
      <EtiquetaForm texto="Tipo de evento" />
      <CampoSeleccion titulo="Tipo de evento" opciones={tipos} indice={tipoIdx} alElegir={setTipoIdx} />
      {sedes.length > 0 ? (
        <View>
          <EtiquetaForm texto="Lugar de atención" />
          <CampoSeleccion titulo="Lugar de atención" opciones={sedes.map(textoLugarSede)} indice={sedeIdx} alElegir={setSedeIdx} />
        </View>
      ) : null}
      <EtiquetaForm texto="Motivo" />
      <Campo
        placeholder="Motivo" accessibilityLabel="Motivo" value={motivo} error={errorMotivo} autoCapitalize="sentences"
        onChangeText={(t) => { setMotivo(t); setErrorMotivo(null); }}
      />
      <EtiquetaForm texto="Fecha" />
      <CampoTocable valor={Fechas.corta(fecha)} accesibilidad="Fecha" icono="calendario" alTocar={() => setSelFecha(true)} />
      <EtiquetaForm texto="Hora" />
      <CampoTocable valor={hora} marcador="Hora" accesibilidad="Hora" icono="reloj" error={errorHora} alTocar={() => setSelHora(true)} />
      <EtiquetaForm texto="Notas" />
      <Campo multilinea placeholder="Notas" accessibilityLabel="Notas" value={notas} onChangeText={setNotas} autoCapitalize="sentences" numberOfLines={3} />
      <Boton titulo="Guardar" alto={50} estilo={{ marginTop: 18 }} onPress={guardar} />
      <Boton titulo="Cancelar" variante="secundario" alto={50} estilo={{ marginTop: 8 }} onPress={alCerrar} />

      <SelectorFechaVet
        visible={selFecha} inicial={fecha} sede={sede} alCerrar={() => setSelFecha(false)}
        alElegir={(nueva) => {
          setFecha(nueva);
          if (hora.trim() !== "" && DisponibilidadVet.validar(nueva, hora, duracion(), evento.id, sede) !== null) {
            setHora("");
            Avisos.mostrar("Elegí otro horario para ese día");
          }
        }}
      />
      <SelectorHoraVet
        visible={selHora} fecha={fecha} horaActual={hora.trim() === "" ? null : hora} ignorarId={evento.id} duracionMin={duracion()} sede={sede}
        alCerrar={() => setSelHora(false)} alElegir={(h) => { setHora(h); setErrorHora(null); }}
      />
    </HojaInferior>
  );
}
