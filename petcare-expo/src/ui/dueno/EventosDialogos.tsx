/*
 * Migrado de ui/dueno/EventosDialogos.kt + sheet_turno.xml + sheet_elegir_turno.xml + item_turno_detalle.xml +
 * item_turno_editable.xml: ficha, edición y cancelación de un turno. La usan el calendario y las pestañas de la mascota.
 *
 * En Kotlin eran métodos de `host.dialogosEventos`; acá es un hook que devuelve las funciones y el elemento que hay
 * que dibujar: `const ev = useEventosDialogos(); ... ev.mostrarDetalle(e, alCambiar) ... {ev.dialogos}`.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { DetalleTurno, DuenoRepo } from "../../data/repositorio/duenoRepo";
import { posologia } from "../../model/clinica";
import { signosTexto } from "../../model/clinica";
import type { EventoMascota } from "../../model/modelos";
import { textoLugarSede } from "../../model/modelos";
import { Fechas } from "../../util/fechas";
import { LocalDate } from "../../util/tiempo";
import { ArchivosUi } from "../common/ArchivosUi";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { crearDatosPaciente, crearProfesional } from "../common/Documentos";
import { DocumentosPdf } from "../common/DocumentosPdf";
import { EstiloCategoria } from "../common/EstiloCategoria";
import { HojaInferior } from "../common/HojaInferior";
import { Icono, type NombreIcono } from "../common/Icono";
import { ImagenRemota } from "../common/ImagenRemota";
import { Colores, sombra } from "../common/tema";
import { Texto } from "../common/Texto";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { EtiquetaColor } from "./ComponentesHome";
import { NavDueno } from "./navegacionDueno";

function FilaDetalle({ icono, titulo, valor, alTocar }: { icono: NombreIcono; titulo: string; valor: string; alTocar?: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole={alTocar ? "button" : undefined} accessibilityLabel={`${titulo}. ${valor}`} disabled={!alTocar} onPress={alTocar}
      {...foco.props} style={[estilos.filaDetalle, alTocar ? cursorTocable : null, estiloFoco(foco.enfocado)]}
    >
      <View style={estilos.iconoTeal}>
        <Icono nombre={icono} tamano={22} color={Colores.primaryTeal} />
      </View>
      <View style={estilos.textosFila}>
        <Texto variante="chico" tamano={12}>{titulo}</Texto>
        <Texto tamano={15} color={Colores.black}>{valor}</Texto>
      </View>
      {alTocar ? <Texto tamano={14} negrita color={Colores.primaryTeal} style={{ marginLeft: 8 }}>Ver</Texto> : null}
    </Pressable>
  );
}

function FilaDato({ icono, color, fondo, etiqueta, valor, children }: {
  icono: NombreIcono; color: string; fondo: string; etiqueta: string; valor: string; children?: ReactNode;
}) {
  return (
    <View style={estilos.filaDetalle}>
      {children ?? (
        <View style={[estilos.iconoRedondo, { backgroundColor: fondo }]}>
          <Icono nombre={icono} tamano={22} color={color} />
        </View>
      )}
      <View style={estilos.textosFila}>
        <Texto variante="chico" tamano={12}>{etiqueta}</Texto>
        <Texto tamano={15} color={Colores.black}>{valor}</Texto>
      </View>
    </View>
  );
}

/** Arma la receta de la consulta con la matrícula del veterinario y abre el selector para compartirla. */
async function compartirReceta(d: DetalleTurno): Promise<void> {
  const primera = d.receta[0];
  if (!primera) return;
  const mascota = DuenoRepo.mascotas.find((m) => m.id === primera.mascotaId);
  if (!mascota) return;
  const eventoReceta = DuenoRepo.eventos.find((e) => e.id === primera.turnoId) ?? null;
  const perfilVet = eventoReceta ? DuenoRepo.perfilDeVeterinario(eventoReceta.veterinarioId) : null;
  const vet = perfilVet?.veterinarios ?? null;
  // El encabezado lleva el lugar donde fue el turno
  const lugar = eventoReceta ? DuenoRepo.sedeDe(eventoReceta) : null;
  const profesional = crearProfesional({
    nombre: perfilVet?.nombre ?? "Veterinario",
    matricula: vet?.matricula ?? "",
    clinica: lugar?.nombre ?? vet?.clinica ?? "",
    direccion: lugar?.direccion ?? vet?.direccion_clinica ?? "",
    telefono: perfilVet?.telefono ?? "",
  });
  const paciente = crearDatosPaciente({
    nombre: mascota.nombre, especie: mascota.tipo, raza: mascota.raza, sexo: mascota.sexo ?? "",
    edad: mascota.edadTexto() ?? "", peso: mascota.tienePesoValido ? mascota.peso : "", propietario: DuenoRepo.perfil.nombre,
  });
  try {
    const archivo = await DocumentosPdf.receta(profesional, paciente, LocalDate.now(), d.receta);
    await DocumentosPdf.compartir(archivo, `Receta de ${mascota.nombre}`);
  } catch (e) {
    Avisos.error(e instanceof Error ? e.message : "No se pudo armar la receta");
  }
}

function DetalleClinico({ d }: { d: DetalleTurno }) {
  const abrirArchivo = (ruta: string, extension: string) => () => { void ArchivosUi.abrir("archivos", ruta, extension); };
  return (
    <View>
      {d.motivo.trim() ? <FilaDetalle icono="lista" titulo="Motivo de la consulta" valor={d.motivo} /> : null}
      {d.anamnesis.trim() ? <FilaDetalle icono="lista" titulo="Lo que contaste en la consulta" valor={d.anamnesis} /> : null}
      {signosTexto(d.signos) ? <FilaDetalle icono="pulso" titulo="Signos vitales" valor={signosTexto(d.signos)} /> : null}
      {d.examenFisico.trim() ? <FilaDetalle icono="medico" titulo="Examen físico" valor={d.examenFisico} /> : null}
      {d.diagnostico.trim() ? <FilaDetalle icono="medico" titulo="Diagnóstico" valor={d.diagnostico} /> : null}
      {d.tratamiento.trim() ? <FilaDetalle icono="vacuna" titulo="Tratamiento indicado" valor={d.tratamiento} /> : null}
      {d.receta.map((m) => (
        <FilaDetalle
          key={m.id} icono="vacuna" titulo="Receta"
          valor={m.medicamento + (posologia(m).trim() ? `\n${posologia(m)}` : "") + (m.indicaciones.trim() ? `\n${m.indicaciones}` : "")}
        />
      ))}
      {d.receta.length > 0 ? (
        <FilaDetalle icono="documento" titulo="Receta en PDF" valor="Compartir o guardar la receta de la consulta" alTocar={() => { void compartirReceta(d); }} />
      ) : null}
      {d.registros.length > 0 ? <FilaDetalle icono="pulso" titulo="Cargado en el carnet de salud" valor={d.registros.join("\n")} /> : null}
      {d.estudios.map((e, i) => (
        <FilaDetalle key={`e${i}`} icono="documento" titulo={`${e.tipo.trim() || "Estudio"} que adjuntaste`} valor={e.nombre} alTocar={abrirArchivo(e.ruta, e.extension)} />
      ))}
      {d.archivos.map((a, i) => (
        <FilaDetalle key={`a${i}`} icono="documento" titulo="Archivo adjunto" valor={a.nombre} alTocar={abrirArchivo(a.ruta, a.extension)} />
      ))}
    </View>
  );
}

/** Ficha del turno en una hoja inferior, con las acciones editar y cancelar. */
export function HojaDetalleTurno({ evento, alCerrar, alCambiar }: { evento: EventoMascota; alCerrar: () => void; alCambiar: () => void }) {
  const [detalle, setDetalle] = useState<DetalleTurno | null>(null);
  useEffect(() => {
    let vigente = true;
    // Lo que el veterinario dejó en la consulta (informe, vacunas y archivos) se pide al abrir la hoja
    DuenoRepo.detalleDelTurno(evento).then((d) => { if (vigente) setDetalle(d); }, () => {});
    return () => { vigente = false; };
  }, [evento]);

  const estilo = EstiloCategoria.turno(evento.categoria);
  const proximo = DuenoRepo.esEditable(evento);
  const sede = DuenoRepo.sedeDe(evento);
  const lugar = sede && (DuenoRepo.buscarVeterinario(evento.veterinario)?.sedes.length ?? 0) > 1 ? sede : null;
  const perfilVet = DuenoRepo.perfilDeVeterinario(evento.veterinarioId);

  const cancelar = () => {
    alCerrar();
    const conVet = evento.veterinario ? ` con ${evento.veterinario}` : "";
    Avisos.confirmar({
      titulo: "¿Cancelar este turno?",
      mensaje:
        `Vas a cancelar el turno de ${evento.mascota} (${evento.categoria}) del ${Fechas.corta(evento.fecha)} a las ${evento.hora} hs${conVet}.` +
        (evento.veterinario ? " Se le avisa al veterinario." : ""),
      textoAceptar: "Cancelar turno",
      alAceptar: () => {
        DuenoRepo.cancelarEvento(evento);
        Avisos.mostrar("Turno cancelado");
        alCambiar();
      },
    });
  };

  return (
    <HojaInferior visible alCerrar={alCerrar}>
      <View style={estilos.cabecera}>
        <View style={[estilos.iconoGrande, { backgroundColor: estilo.fondo }]}>
          <Icono nombre={estilo.icono} tamano={28} color={estilo.color} />
        </View>
        <View style={estilos.textosFila}>
          <Texto tamano={20} negrita color={Colores.black} accessibilityRole="header">{evento.categoria}</Texto>
          <Texto variante="subtitulo" tamano={14}>{evento.mascota}</Texto>
        </View>
        <EtiquetaColor
          texto={proximo ? "Próximo" : "Realizado"} fondo={proximo ? Colores.lightOrange : Colores.lightGreen}
          color={proximo ? Colores.accentOrange : Colores.successGreen} estilo={estilos.estado}
        />
      </View>
      <View style={estilos.divisor} />
      <FilaDato icono="calendario" color={Colores.primaryTeal} fondo={Colores.lightTeal} etiqueta="Fecha" valor={Fechas.larga(evento.fecha)} />
      <FilaDato icono="reloj" color={Colores.accentPurple} fondo={Colores.lightPurple} etiqueta="Hora" valor={`${evento.hora} hs`} />
      <FilaDato
        icono="medico" color={Colores.accentOrange} fondo={Colores.lightOrange} etiqueta="Veterinario"
        valor={(evento.veterinario || "Sin asignar") + (lugar ? `\n${textoLugarSede(lugar)}` : "")}
      >
        {perfilVet?.foto_path ? (
          <ImagenRemota fotoPath={perfilVet.foto_path} accessibilityLabel="Foto del veterinario" estilo={estilos.iconoRedondo} />
        ) : undefined}
      </FilaDato>
      {evento.observaciones ? (
        <FilaDato icono="lista" color={Colores.primaryTeal} fondo={Colores.lightTeal} etiqueta="Observaciones" valor={evento.observaciones} />
      ) : null}
      {detalle ? <DetalleClinico d={detalle} /> : null}
      {proximo ? (
        <View style={estilos.botones}>
          <Boton titulo="Editar" variante="secundario" icono="editar" alto={52} estilo={{ flex: 1 }} onPress={() => { alCerrar(); NavDueno.irAEditarEvento(evento); }} />
          <Boton titulo="Cancelar turno" variante="secundario" icono="cancelar" alto={52} estilo={{ flex: 1 }} onPress={cancelar} />
        </View>
      ) : null}
    </HojaInferior>
  );
}

/** Botón "Editar evento": los turnos próximos en tarjetas, para elegir cuál editar. */
export function HojaElegirTurno({ editables, alCerrar }: { editables: EventoMascota[]; alCerrar: () => void }) {
  return (
    <HojaInferior visible alCerrar={alCerrar} pie={<Boton titulo="Cancelar" variante="secundario" alto={50} onPress={alCerrar} />}>
      <Texto tamano={21} negrita accessibilityRole="header">¿Qué turno querés editar?</Texto>
      <Texto variante="subtitulo" tamano={13.5} style={{ marginTop: 4 }}>
        {editables.length === 1
          ? "Tenés 1 turno próximo. Solo se pueden editar los turnos próximos."
          : `Tenés ${editables.length} turnos próximos. Solo se pueden editar los próximos.`}
      </Texto>
      <View style={{ marginTop: 16 }}>
        {editables.map((e) => <TarjetaEditable key={e.id} evento={e} alTocar={() => { alCerrar(); NavDueno.irAEditarEvento(e); }} />)}
      </View>
    </HojaInferior>
  );
}

function TarjetaEditable({ evento, alTocar }: { evento: EventoMascota; alTocar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={`${evento.categoria}, ${evento.fecha.dayOfMonth} ${Fechas.mesCorto(evento.fecha.monthValue)}, ${evento.hora} hs`}
      onPress={alTocar} {...foco.props} style={[estilos.editable, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <View style={[estilos.iconoEditable, { backgroundColor: EstiloCategoria.fondo(evento.categoria) }]}>
        <Icono nombre={EstiloCategoria.icono(evento.categoria)} tamano={24} color={EstiloCategoria.colorIcono(evento.categoria)} />
      </View>
      <View style={estilos.textosFila}>
        <Texto tamano={15.5} negrita numberOfLines={1}>{evento.categoria}</Texto>
        <Texto variante="chico" numberOfLines={1} style={{ marginTop: 2 }}>{`${evento.mascota} · ${evento.veterinario.trim() || "Sin veterinario asignado"}`}</Texto>
      </View>
      <View style={{ alignItems: "center", marginLeft: 10 }}>
        <EtiquetaColor texto={`${evento.fecha.dayOfMonth} ${Fechas.mesCorto(evento.fecha.monthValue).toUpperCase()}`} fondo={Colores.lightGreen} color={Colores.primaryTeal} estilo={{ paddingHorizontal: 10, paddingVertical: 4 }} />
        <Texto variante="chico" style={{ marginTop: 4 }}>{`${evento.hora} hs`}</Texto>
      </View>
    </Pressable>
  );
}

export interface EventosDialogos {
  mostrarDetalle(evento: EventoMascota, alCambiar?: () => void): void;
  /** Edita el turno con el asistente de horarios (días y horas del veterinario, sin los ya reservados). */
  editar(evento: EventoMascota): void;
  elegirParaEditar(mascota: string | null | undefined): void;
  /** Hay que dibujarlo en la pantalla que usa el hook. */
  dialogos: ReactNode;
}

export function useEventosDialogos(): EventosDialogos {
  const [detalle, setDetalle] = useState<{ evento: EventoMascota; alCambiar: () => void } | null>(null);
  const [editables, setEditables] = useState<EventoMascota[] | null>(null);
  return {
    mostrarDetalle: (evento, alCambiar = () => {}) => setDetalle({ evento, alCambiar }),
    editar: (evento) => NavDueno.irAEditarEvento(evento),
    elegirParaEditar: (mascota) => {
      const lista = DuenoRepo.eventosEditables(mascota ?? null);
      if (lista.length === 0) {
        Avisos.aviso("No tenés turnos próximos para editar. Los turnos completados no se pueden modificar.");
        return;
      }
      setEditables(lista);
    },
    dialogos: (
      <>
        {detalle ? <HojaDetalleTurno evento={detalle.evento} alCambiar={detalle.alCambiar} alCerrar={() => setDetalle(null)} /> : null}
        {editables ? <HojaElegirTurno editables={editables} alCerrar={() => setEditables(null)} /> : null}
      </>
    ),
  };
}

const estilos = StyleSheet.create({
  cabecera: { flexDirection: "row", alignItems: "center", paddingTop: 8 },
  iconoGrande: { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center", marginRight: 16 },
  estado: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16 },
  divisor: { height: 1, marginTop: 20, backgroundColor: Colores.dividerLight },
  filaDetalle: { flexDirection: "row", alignItems: "center", marginTop: 14, minHeight: 40 },
  iconoTeal: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
  iconoRedondo: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  textosFila: { flex: 1, minWidth: 0, marginLeft: 14 },
  botones: { flexDirection: "row", gap: 16, marginTop: 24 },
  editable: { flexDirection: "row", alignItems: "center", padding: 14, marginBottom: 12, marginHorizontal: 2, backgroundColor: Colores.white, borderRadius: 18, ...sombra(1) },
  iconoEditable: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
