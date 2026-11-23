/*
 * Migrado de ui/veterinario/DetalleEventoVetActivity.kt (activity_detalle_evento_vet.xml, item_turno_detalle.xml).
 * Detalle del turno con sede, iniciar turno, completar, cancelar con confirmación, editar, informe y estudios previos
 * del dueño. Ruta: `/vet/evento/[id]`.
 */
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AgendaRepo, EstadosEvento } from "../../data/repositorio/agendaRepo";
import { InformesRepo, informeVacio, type InformeData } from "../../data/repositorio/informesRepo";
import { PacientesRepo, razaYSexo } from "../../data/repositorio/pacientesRepo";
import { PerfilVetRepo } from "../../data/repositorio/perfilVetRepo";
import type { EstudioTurnoDto } from "../../data/remoto/dtos";
import { Servicios } from "../../data/servicios";
import { signosTexto } from "../../model/clinica";
import { textoLugarSede } from "../../model/modelos";
import { TiposMascota } from "../../model/tiposMascota";
import { Fechas } from "../../util/fechas";
import { ArchivosUi } from "../common/ArchivosUi";
import { Avatar } from "../common/Avatar";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Icono } from "../common/Icono";
import { ImagenRemota } from "../common/ImagenRemota";
import { PantallaBase } from "../common/PantallaBase";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";
import { useDatos } from "../common/useDatos";
import { useSesionRequerida } from "../common/useSesionRequerida";
import { Tarjeta } from "../common/Tarjeta";
import { EditorTurnoVet } from "./EditorTurnoVet";
import { FilaInfo, FilaTurnoDetalle, SeccionTitulo, iconoDeEvento } from "./ElementosVet";
import { cerrarPantalla } from "./estadoVet";
import { NavVet } from "./navegacionVet";

/** Lo que el veterinario escribió en el informe, como texto de lectura (secciones con título). */
export function textoDeInforme(informe: InformeData): string {
  return ([
    ["Motivo", informe.motivo], ["Anamnesis", informe.anamnesis], ["Signos vitales", signosTexto(informe.signos)],
    ["Examen físico", informe.examenFisico], ["Diagnóstico", informe.diagnostico], ["Tratamiento", informe.tratamiento],
  ] as const)
    .filter(([, valor]) => valor.trim() !== "")
    .map(([titulo, valor]) => `${titulo}\n${valor}`)
    .join("\n\n");
}

export default function DetalleEventoVetPantalla() {
  useSesionRequerida();
  useDatos();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const evento = AgendaRepo.porId(typeof id === "string" ? id : null);
  const [, redibujar] = useState(0);
  const [editando, setEditando] = useState(false);
  const [informe, setInforme] = useState<InformeData | null>(null);
  const [estudios, setEstudios] = useState<EstudioTurnoDto[]>([]);

  useEffect(() => {
    if (evento === null) {
      Avisos.mostrar("No se encontró el turno");
      cerrarPantalla();
    }
  }, [evento === null]); // eslint-disable-line react-hooks/exhaustive-deps

  const pacienteId = evento?.pacienteId ?? null;
  const eventoId = evento?.id ?? null;
  // El informe se escribe en otra pantalla: al volver se pide de nuevo para mostrar lo último
  useFocusEffect(
    useCallback(() => {
      if (pacienteId === null || eventoId === null) return;
      let vigente = true;
      setInforme(InformesRepo.obtener(pacienteId, eventoId));
      InformesRepo.cargar(pacienteId, eventoId).then((i) => vigente && setInforme(i)).catch(() => {});
      Servicios.fuente.estudiosDeTurno(eventoId).then((e) => vigente && setEstudios(e)).catch(() => {});
      return () => {
        vigente = false;
      };
    }, [pacienteId, eventoId]),
  );

  if (evento === null) return <PantallaBase titulo="Detalle del turno" alVolver={cerrarPantalla}>{null}</PantallaBase>;

  const p = PacientesRepo.porId(evento.pacienteId);
  const pendiente = evento.estado === "PENDIENTE";
  const actual = informe ?? InformesRepo.obtener(evento.pacienteId, evento.id);
  const lugar = PerfilVetRepo.sedes.length > 1 ? PerfilVetRepo.sede(evento.sedeId) : null;
  const textoInforme = textoDeInforme(actual);

  return (
    <PantallaBase
      titulo="Detalle del turno" alVolver={cerrarPantalla}
      pie={
        <View>
          {pendiente ? (
            <>
              <Boton
                titulo={!informeVacio(actual) ? "Continuar informe" : "Iniciar turno"} alto={50}
                onPress={() => NavVet.detallePaciente(evento.pacienteId, evento.id)}
              />
              <Boton
                titulo="Marcar como completado" variante="secundario" alto={46} estilo={{ marginTop: 6 }}
                onPress={() => {
                  AgendaRepo.cambiarEstado(evento, "COMPLETADO");
                  Avisos.mostrar("Turno marcado como completado");
                  redibujar((n) => n + 1);
                }}
              />
            </>
          ) : null}
          <View style={{ flexDirection: "row", marginTop: 6 }}>
            <Boton titulo="Editar" variante="secundario" alto={46} estilo={{ flex: 1 }} onPress={() => setEditando(true)} />
            {pendiente ? (
              <Boton
                titulo="Cancelar" variante="peligro" alto={46} estilo={{ flex: 1, marginLeft: 8 }}
                onPress={() =>
                  Avisos.confirmar({
                    titulo: "¿Cancelar este turno?",
                    mensaje:
                      `Vas a cancelar el turno de ${PacientesRepo.nombreDe(evento.pacienteId)} del ` +
                      `${Fechas.corta(evento.fecha)} a las ${evento.hora} hs. El dueño va a recibir un aviso.`,
                    textoAceptar: "Cancelar turno",
                    alAceptar: () => {
                      AgendaRepo.cambiarEstado(evento, "CANCELADO");
                      Avisos.mostrar("Turno cancelado");
                      redibujar((n) => n + 1);
                    },
                  })
                }
              />
            ) : null}
          </View>
        </View>
      }
    >
      <View style={estilos.hero}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={estilos.cajaTipo}><Icono nombre={iconoDeEvento(evento.tipo)} tamano={28} color={Colores.white} /></View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Texto variante="titulo" tamano={21} color={Colores.white} accessibilityRole="header">{evento.motivo}</Texto>
            <View style={{ flexDirection: "row", marginTop: 6 }}>
              <View style={estilos.chip}><Texto variante="etiqueta" tamano={10.5} color={Colores.white}>{evento.tipo}</Texto></View>
              <View style={[estilos.chip, { marginLeft: 8 }]}>
                <Texto variante="etiqueta" tamano={10.5} color={Colores.white}>{EstadosEvento[evento.estado].etiqueta}</Texto>
              </View>
            </View>
          </View>
        </View>
        <View style={estilos.linea} />
        <View style={{ flexDirection: "row", marginTop: 14 }}>
          <View style={estilos.dato}>
            <Icono nombre="calendario" tamano={20} color={Colores.white} />
            <Texto variante="etiqueta" tamano={15} color={Colores.white} style={{ marginLeft: 8 }}>{Fechas.relativa(evento.fecha)}</Texto>
          </View>
          <View style={estilos.dato}>
            <Icono nombre="reloj" tamano={20} color={Colores.white} />
            <Texto variante="etiqueta" tamano={15} color={Colores.white} style={{ marginLeft: 8 }}>{`${evento.hora} hs`}</Texto>
          </View>
        </View>
      </View>

      <SeccionTitulo texto="Paciente" />
      <Tarjeta
        relleno={14} estilo={{ marginTop: 10 }} accessibilityLabel={`Ver la ficha de ${p?.nombre ?? "la mascota"}`}
        onPress={() => NavVet.detallePaciente(evento.pacienteId)}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <ImagenRemota
            fotoPath={p?.fotoPath} estilo={{ width: 60, height: 60, borderRadius: 16, backgroundColor: Colores.lightTeal }}
            respaldo={<Icono nombre="perro" tamano={30} color={Colores.primaryTeal} />}
          />
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Texto variante="titulo" tamano={17}>{p?.nombre ?? "Mascota"}</Texto>
            <Texto variante="chico" tamano={13.5}>{p ? razaYSexo(p) : ""}</Texto>
            <Texto variante="chico" tamano={13} color={Colores.tealDark} style={{ marginTop: 2 }}>{`Propietario/a: ${p?.propietario ?? "Sin datos"}`}</Texto>
          </View>
          <Avatar nombre={p?.propietario} fotoPath={p?.fotoDueno} tamano={40} estilo={{ marginLeft: 8 }} />
          <Icono nombre="chevronDerecha" tamano={22} color={Colores.textGray} />
        </View>
      </Tarjeta>

      <SeccionTitulo texto="Detalles" />
      <View style={[estilos.tarjetaDatos, { marginTop: 10 }]}>
        <FilaInfo
          icono="medico" etiqueta="Veterinario" valor={evento.veterinario + (lugar ? `\n${textoLugarSede(lugar)}` : "")}
        />
        <FilaInfo icono="calendario" etiqueta="Fecha y hora" valor={`${Fechas.corta(evento.fecha)} · ${evento.hora} hs`} conDivisor={false} />
      </View>

      {estudios.length > 0 ? (
        <View>
          <SeccionTitulo texto="Estudios previos del dueño" />
          <View style={[estilos.tarjetaDatos, { marginTop: 10, padding: 14, paddingTop: 0 }]}>
            {estudios.map((e, i) => (
              <FilaTurnoDetalle
                key={e.id} icono="documento" titulo={`${e.tipo} · ${e.extension.toUpperCase()}`} valor={e.nombre} accion="Ver"
                primera={false}
                alTocar={() => void ArchivosUi.abrir("archivos", e.storage_path, e.extension)}
              />
            ))}
          </View>
        </View>
      ) : null}

      {!informeVacio(actual) ? (
        <View>
          <SeccionTitulo texto="Informe de la consulta" />
          <View style={[estilos.tarjetaDatos, { marginTop: 10, padding: 16 }]}>
            <Texto variante="cuerpo" tamano={14.5} selectable>{textoInforme}</Texto>
          </View>
        </View>
      ) : null}

      <SeccionTitulo texto="Notas" />
      <View style={[estilos.tarjetaDatos, { marginTop: 10, padding: 16 }]}>
        <Texto variante="cuerpo" tamano={14.5}>{evento.notas.trim() === "" ? "Sin notas" : evento.notas}</Texto>
      </View>
      <View style={{ height: 8 }} />

      <EditorTurnoVet
        visible={editando} evento={evento} alCerrar={() => setEditando(false)}
        alGuardar={() => {
          Avisos.mostrar("Turno actualizado");
          redibujar((n) => n + 1);
        }}
      />
    </PantallaBase>
  );
}

const estilos = StyleSheet.create({
  hero: { backgroundColor: Colores.primaryTeal, borderRadius: 24, padding: 18 },
  cajaTipo: { width: 56, height: 56, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  chip: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  linea: { height: 1, marginTop: 16, backgroundColor: "rgba(255,255,255,0.2)" },
  dato: { flex: 1, flexDirection: "row", alignItems: "center" },
  tarjetaDatos: { backgroundColor: Colores.white, borderRadius: 18, paddingHorizontal: 14 },
});
