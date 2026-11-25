/*
 * Sacar un turno nuevo (pantalla `turno-nuevo`) o mover uno existente (hoja) en nombre de un veterinario. Los días
 * y horarios que se ofrecen salen de los lugares de atención de ese veterinario y de su agenda completa; el
 * servidor vuelve a validar todo al guardar (horario libre, tipo de animal, lugar).
 */
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { RecepcionAgendaRepo, type TurnoRecepcion } from "../../data/repositorio/recepcionAgendaRepo";
import { DuenoRepo } from "../../data/repositorio/duenoRepo";
import { textoLugarSede, type VeterinarioAcceso } from "../../model/modelos";
import { Errores } from "../../util/errores";
import { Fechas } from "../../util/fechas";
import { LocalDate } from "../../util/tiempo";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Campo } from "../common/Campo";
import { EstadoVacio } from "../common/EstadoVacio";
import { HojaInferior } from "../common/HojaInferior";
import { HojaLista } from "../common/HojaLista";
import { PantallaBase } from "../common/PantallaBase";
import { SelectorFecha } from "../common/SelectorFecha";
import { SelectorHora } from "../common/SelectorHora";
import { Texto } from "../common/Texto";
import { useDatos } from "../common/useDatos";
import { CampoSeleccion, CampoTocable, EtiquetaForm } from "../veterinario/ElementosVet";
import { NavRecepcion } from "./navegacionRecepcion";

function FormularioTurno({ turno, vetInicial, mascotaInicial, alListo, alCancelar }: {
  /** El turno que se mueve; null para uno nuevo. */
  turno: TurnoRecepcion | null;
  vetInicial: string | null;
  mascotaInicial: string | null;
  alListo: () => void;
  alCancelar: () => void;
}) {
  const vets = RecepcionAgendaRepo.veterinarios;
  const [vetIdx, setVetIdx] = useState(() => Math.max(0, vets.findIndex((v) => v.id === (turno?.vetId ?? vetInicial))));
  const vet: VeterinarioAcceso | null = vets[vetIdx] ?? null;
  const [mascotaId, setMascotaId] = useState<string | null>(turno?.mascotaId ?? mascotaInicial);
  const tipos = vet ? RecepcionAgendaRepo.tipos(vet, turno?.tipo ?? null) : [];
  const [tipoIdx, setTipoIdx] = useState(() => Math.max(0, tipos.indexOf(turno?.tipo ?? "Consulta")));
  const [sedeIdx, setSedeIdx] = useState(() => Math.max(0, vet?.sedes.findIndex((s) => s.id === turno?.sedeId) ?? 0));
  const [fecha, setFecha] = useState<LocalDate | null>(turno?.fecha ?? null);
  const [hora, setHora] = useState<string | null>(turno?.hora ?? null);
  const [motivo, setMotivo] = useState(turno && turno.motivo !== turno.tipo ? turno.motivo : "");
  const [notas, setNotas] = useState(turno?.notas ?? "");
  const [hojaPaciente, setHojaPaciente] = useState(false);
  const [selFecha, setSelFecha] = useState(false);
  const [selHora, setSelHora] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errores, setErrores] = useState<{ paciente?: string; fecha?: string; hora?: string }>({});

  if (!vet) return <EstadoVacio icono="veterinario" titulo="No hay veterinarios" mensaje="Todavía no trabajás para ningún veterinario." />;

  const tipo = tipos[tipoIdx] ?? "Consulta";
  const sede = vet.sedes[sedeIdx] ?? null;
  const duracion = vet.duracionDe(tipo);
  const paciente = mascotaId ? RecepcionAgendaRepo.paciente(mascotaId) : null;
  const pacientes = RecepcionAgendaRepo.pacientes(vet.id);
  const { horas, ocupadas } = fecha ? RecepcionAgendaRepo.horarios(vet, fecha, duracion, sede?.id ?? null, turno?.id ?? null) : { horas: [], ocupadas: [] };

  /** Al cambiar algo que mueve los horarios posibles, la hora elegida se descarta si ya no entra. */
  const revisarHora = (nuevaFecha: LocalDate | null, nuevaDuracion: number, nuevaSede: string | null) => {
    if (!nuevaFecha || !hora) return;
    const r = RecepcionAgendaRepo.horarios(vet, nuevaFecha, nuevaDuracion, nuevaSede, turno?.id ?? null);
    if (!r.horas.includes(hora) || r.ocupadas.includes(hora)) setHora(null);
  };

  const guardar = async () => {
    const e: typeof errores = {};
    if (!mascotaId) e.paciente = "Elegí el paciente";
    if (!fecha) e.fecha = "Elegí el día";
    if (!hora) e.hora = "Elegí el horario";
    setErrores(e);
    if (Object.keys(e).length > 0 || !mascotaId || !fecha || !hora) return;
    if (paciente && !vet.atiende(paciente.tipo)) {
      Avisos.mostrar(`${vet.nombre} no atiende ese tipo de mascota`);
      return;
    }
    setGuardando(true);
    const datos = { vetId: vet.id, mascotaId, tipo, motivo, fecha, hora, sedeId: sede?.id ?? null, notas };
    try {
      if (turno) await RecepcionAgendaRepo.mover(turno, datos);
      else await RecepcionAgendaRepo.sacarTurno(datos);
      Avisos.mostrar(turno ? "Turno movido. Le avisamos al dueño" : "Turno agendado. Le avisamos al dueño", "exito");
      alListo();
    } catch (err) {
      Avisos.error(Errores.mensaje(err));
      setGuardando(false);
    }
  };

  return (
    <View>
      {vets.length > 1 ? (
        <>
          <EtiquetaForm texto="Veterinario" primera />
          {turno ? (
            <CampoTocable valor={vet.nombre} accesibilidad="Veterinario" deshabilitado alTocar={() => {}} />
          ) : (
            <CampoSeleccion
              titulo="Veterinario" opciones={vets.map((v) => v.nombre)} indice={vetIdx}
              alElegir={(i) => { setVetIdx(i); setMascotaId(null); setTipoIdx(0); setSedeIdx(0); setFecha(null); setHora(null); }}
            />
          )}
        </>
      ) : null}

      <EtiquetaForm texto="Paciente" primera={vets.length < 2} />
      <CampoTocable
        valor={paciente ? `${paciente.nombre} · ${paciente.dueno}` : ""} marcador="Elegí el paciente" accesibilidad="Paciente"
        icono="perro" error={errores.paciente} deshabilitado={turno != null}
        alTocar={() => setHojaPaciente(true)}
      />

      <EtiquetaForm texto="Servicio" />
      <CampoSeleccion
        titulo="Servicio" opciones={tipos} indice={tipoIdx}
        alElegir={(i) => { setTipoIdx(i); revisarHora(fecha, vet.duracionDe(tipos[i]), sede?.id ?? null); }}
      />

      {vet.sedes.length > 1 ? (
        <>
          <EtiquetaForm texto="Lugar de atención" />
          <CampoSeleccion
            titulo="Lugar de atención" opciones={vet.sedes.map(textoLugarSede)} indice={sedeIdx}
            alElegir={(i) => {
              setSedeIdx(i);
              // Otro lugar puede atender otros días
              if (fecha && !DuenoRepo.trabajaEl(vet, fecha, vet.sedes[i])) { setFecha(null); setHora(null); }
              else revisarHora(fecha, duracion, vet.sedes[i]?.id ?? null);
            }}
          />
        </>
      ) : null}

      <EtiquetaForm texto="Día" />
      <CampoTocable
        valor={fecha ? `${Fechas.relativa(fecha)} · ${Fechas.corta(fecha)}` : ""} marcador="Elegí el día" accesibilidad="Día"
        icono="calendario" error={errores.fecha} alTocar={() => setSelFecha(true)}
      />
      <EtiquetaForm texto="Horario" />
      <CampoTocable
        valor={hora ? `${hora} a ${DuenoRepo.horaFin(hora, duracion)} (${duracion} min)` : ""} marcador="Elegí el horario"
        accesibilidad="Horario" icono="reloj" error={errores.hora} deshabilitado={!fecha}
        alTocar={() => (fecha ? setSelHora(true) : setErrores((e) => ({ ...e, fecha: "Primero elegí el día" })))}
      />

      <EtiquetaForm texto="Motivo (opcional)" />
      <Campo placeholder={tipo} accessibilityLabel="Motivo" value={motivo} onChangeText={setMotivo} autoCapitalize="sentences" />
      <EtiquetaForm texto="Notas (opcional)" />
      <Campo multilinea placeholder="Notas para el veterinario" accessibilityLabel="Notas" value={notas} onChangeText={setNotas} autoCapitalize="sentences" numberOfLines={3} />

      <Boton titulo={turno ? "Guardar cambios" : "Agendar turno"} alto={52} estilo={{ marginTop: 20 }} cargando={guardando} onPress={() => void guardar()} />
      <Boton titulo="Cancelar" variante="secundario" alto={50} estilo={{ marginTop: 8 }} deshabilitado={guardando} onPress={alCancelar} />

      <HojaLista
        visible={hojaPaciente} alCerrar={() => setHojaPaciente(false)} titulo="Elegí el paciente"
        subtitulo={pacientes.length === 0 ? `${vet.nombre} todavía no tiene pacientes que le hayan dado acceso` : `Pacientes de ${vet.nombre}`}
        filas={pacientes.map((p) => ({
          titulo: p.nombre, subtitulo: `${p.tipo} · ${p.dueno}`, icono: "perro" as const, fotoPath: p.fotoPath,
          alTocar: () => { setMascotaId(p.id); setErrores((e) => ({ ...e, paciente: undefined })); setHojaPaciente(false); },
        }))}
      />
      <SelectorFecha
        visible={selFecha} valor={fecha} minima={LocalDate.now()}
        diaHabilitado={(d) => DuenoRepo.trabajaEl(vet, d, sede)}
        alTocarBloqueado={() => Avisos.mostrar(`${vet.nombre} no atiende ese día` + (vet.sedes.length > 1 ? " en ese lugar" : ""))}
        leyendaBloqueado="No atiende"
        alElegir={(d) => { setFecha(d); setErrores((e) => ({ ...e, fecha: undefined })); revisarHora(d, duracion, sede?.id ?? null); }}
        alCerrar={() => setSelFecha(false)}
      />
      <SelectorHora
        visible={selHora} horarios={horas} valor={hora} ocupados={ocupadas}
        subtitulo={horas.length === 0 ? "No atiende ese día" : `${tipo}: ${duracion} min`}
        alTocarOcupado={(h) => Avisos.mostrar(fecha && DuenoRepo.horaPasada(fecha, h) ? "Ese horario ya pasó" : "Ese horario ya está ocupado")}
        alElegir={(h) => { setHora(h); setErrores((e) => ({ ...e, hora: undefined })); }}
        alCerrar={() => setSelHora(false)}
      />
    </View>
  );
}

/** Mover un turno: la misma ficha, en una hoja sobre la lista. */
export function EditorTurnoRecepcion({ turno, alCerrar }: { turno: TurnoRecepcion; alCerrar: () => void }) {
  return (
    <HojaInferior visible alCerrar={alCerrar}>
      <Texto variante="titulo" tamano={21} accessibilityRole="header" style={{ marginBottom: 12 }}>Mover turno</Texto>
      <FormularioTurno turno={turno} vetInicial={null} mascotaInicial={null} alListo={alCerrar} alCancelar={alCerrar} />
    </HojaInferior>
  );
}

/** Pantalla "Nuevo turno" (ruta `/recepcion/turno-nuevo`, con `vet` y `mascota` opcionales). */
export function TurnoNuevoRecepcion() {
  useDatos();
  const { vet, mascota } = useLocalSearchParams<{ vet?: string; mascota?: string }>();
  return (
    <PantallaBase titulo="Nuevo turno" alVolver={NavRecepcion.irAAgenda} formulario>
      <FormularioTurno
        turno={null} vetInicial={vet ?? null} mascotaInicial={mascota ?? null}
        alListo={NavRecepcion.irAAgenda} alCancelar={NavRecepcion.irAAgenda}
      />
    </PantallaBase>
  );
}

export default TurnoNuevoRecepcion;
