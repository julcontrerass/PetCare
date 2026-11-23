/*
 * Migrado de ui/dueno/RecordatoriosPantalla.kt (configurarContenido) + RecordatoriosAdapter.kt +
 * pantalla_mascota_recordatorios.xml + item_recordatorio.xml. El mismo contenido se usa a pantalla completa y dentro
 * de la pestaña "Recordatorios" de una mascota, donde se limita a los eventos de esa mascota.
 */
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { DuenoRepo } from "../../data/repositorio/duenoRepo";
import { RecordatoriosRepo, type RecordatorioManual } from "../../data/repositorio/recordatoriosRepo";
import { Fechas } from "../../util/fechas";
import { LocalDate } from "../../util/tiempo";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { diasHasta } from "../common/ComponentesDueno";
import { EditorRecordatorio } from "../common/EditorRecordatorio";
import { EstadoVacio } from "../common/EstadoVacio";
import { EstiloCategoria } from "../common/EstiloCategoria";
import { HojaInferior } from "../common/HojaInferior";
import { Icono } from "../common/Icono";
import { Colores, sombra } from "../common/tema";
import { Texto } from "../common/Texto";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { useDatos } from "../common/useDatos";
import { EtiquetaColor, FotoVetEvento } from "./ComponentesHome";
import { useEventosDialogos } from "./EventosDialogos";
import { EstadoDueno } from "./estadoDueno";
import { NavDueno } from "./navegacionDueno";

/** Qué se está viendo: los turnos que vienen, los que ya pasaron o los recordatorios hechos a mano. */
export type PestanaRecordatorios = "PROXIMOS" | "COMPLETADOS" | "MIOS";

export interface ItemRecordatorio {
  clave: string;
  titulo: string;
  mascota: string;
  fecha: string;
  faltan: string;
  icono: ReturnType<typeof EstiloCategoria.icono>;
  fondo: string;
  color: string;
  veterinarioId?: string | null;
  alTocar?: () => void;
}

function FilaRecordatorio({ item, ultimo }: { item: ItemRecordatorio; ultimo: boolean }) {
  const foco = useFoco();
  const urgente = item.faltan.startsWith("Hoy") || item.faltan.startsWith("Mañana");
  return (
    <View style={estilos.filaRec}>
      <View style={estilos.columnaLinea}>
        {!ultimo ? <View style={estilos.linea} /> : null}
        <View style={[estilos.icono, { backgroundColor: item.fondo }]}>
          <Icono nombre={item.icono} tamano={22} color={item.color} />
        </View>
      </View>
      <Pressable
        accessibilityRole={item.alTocar ? "button" : undefined} accessibilityLabel={`${item.titulo}, ${item.mascota}, ${item.fecha}, ${item.faltan}`}
        disabled={!item.alTocar} onPress={item.alTocar} {...foco.props}
        style={[estilos.tarjeta, item.alTocar ? cursorTocable : null, estiloFoco(foco.enfocado)]}
      >
        <View style={estilos.titulo}>
          <Texto tamano={16} negrita numberOfLines={1} style={{ flex: 1 }}>{item.titulo}</Texto>
          <FotoVetEvento veterinarioId={item.veterinarioId} tamano={30} />
          <EtiquetaColor
            texto={item.faltan} fondo={urgente ? Colores.lightOrange : Colores.lightGreen}
            color={urgente ? Colores.accentOrangeDark : Colores.successGreen} estilo={{ marginLeft: 8 }}
          />
        </View>
        <View style={estilos.mascota}>
          <Icono nombre="perro" tamano={16} color={Colores.tealDark} />
          <Texto tamano={13.5} negrita color={Colores.tealDark} style={{ marginLeft: 6, flexShrink: 1 }}>{item.mascota}</Texto>
        </View>
        <Texto variante="chico" style={{ marginTop: 2 }}>{item.fecha}</Texto>
      </Pressable>
    </View>
  );
}

function Segmento({ texto, activo, alTocar }: { texto: string; activo: boolean; alTocar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={texto} accessibilityState={{ selected: activo }} onPress={alTocar} {...foco.props}
      style={[estilos.segmento, activo ? estilos.segmentoActivo : null, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Texto tamano={14} peso="medium" color={activo ? Colores.white : Colores.textGray}>{texto}</Texto>
    </Pressable>
  );
}

/** Turnos próximos o completados (de una mascota si se da su nombre). */
export function itemsDeEventos(proximos: boolean, mascota: string | null): ItemRecordatorio[] {
  return DuenoRepo.eventosOrdenados(proximos, mascota).map((e) => {
    let faltan = "Completado";
    if (proximos) {
      const dias = diasHasta(e.fecha);
      faltan = dias <= 0 ? `Hoy - ${e.hora}` : dias === 1 ? `Mañana - ${e.hora}` : `Falta ${dias} días`;
    }
    return {
      clave: e.id, titulo: e.categoria, mascota: e.mascota,
      fecha: `${e.fecha.dayOfMonth} ${Fechas.mesCorto(e.fecha.monthValue)} ${e.fecha.year}`, faltan,
      icono: EstiloCategoria.icono(e.categoria), fondo: EstiloCategoria.fondo(e.categoria), color: EstiloCategoria.colorIcono(e.categoria),
      veterinarioId: e.veterinarioId,
    };
  });
}

export function RecordatoriosContenido({ global, mascota }: { global: boolean; mascota: string | null }) {
  useDatos();
  const [pestana, setPestana] = useState<PestanaRecordatorios>("PROXIMOS");
  const [version, setVersion] = useState(0);
  const [editor, setEditor] = useState<{ existente: RecordatorioManual | null } | null>(null);
  const [opciones, setOpciones] = useState<RecordatorioManual | null>(null);
  const eventos = useEventosDialogos();
  useFocusEffect(useCallback(() => { setPestana("PROXIMOS"); }, []));
  const refrescar = () => setVersion((v) => v + 1);
  void version;

  const itemsManuales = (): ItemRecordatorio[] => {
    const hoy = LocalDate.now();
    const id = mascota ? DuenoRepo.buscarMascota(mascota)?.id ?? null : null;
    const todos = RecordatoriosRepo.lista.filter((r) => DuenoRepo.mascotas.some((m) => m.id === r.mascotaId) && (id == null || r.mascotaId === id));
    const proximos = todos.filter((r) => !r.fecha.isBefore(hoy));
    const pasados = todos.filter((r) => r.fecha.isBefore(hoy));
    return [...proximos, ...pasados.reverse()].map((r) => {
      const nombre = DuenoRepo.mascotas.find((m) => m.id === r.mascotaId)?.nombre ?? "";
      const autor = r.esMio ? "" : ` · De ${DuenoRepo.perfilDeVeterinario(r.creadoPor)?.nombre ?? "tu veterinario"}`;
      const dias = diasHasta(r.fecha);
      const hora = r.hora ? ` - ${r.hora}` : "";
      const faltan = dias < 0 ? "Pasó" : dias === 0 ? `Hoy${hora}` : dias === 1 ? `Mañana${hora}` : `Falta ${dias} días`;
      return {
        clave: r.id, titulo: r.titulo, mascota: nombre + autor + (r.nota.trim() ? ` · ${r.nota}` : ""),
        fecha: Fechas.corta(r.fecha) + (r.hora ? ` · ${r.hora} hs` : ""), faltan,
        icono: EstiloCategoria.icono(r.tipo), fondo: EstiloCategoria.fondo(r.tipo), color: EstiloCategoria.colorIcono(r.tipo),
        alTocar: r.esMio ? () => setOpciones(r) : undefined,
      };
    });
  };

  const lista = pestana === "MIOS" ? itemsManuales() : itemsDeEventos(pestana === "PROXIMOS", mascota);

  /** Crea un recordatorio propio, o un turno si se está viendo otra solapa. */
  const agregar = (dia: LocalDate) => {
    if (pestana === "MIOS") setEditor({ existente: null });
    else NavDueno.irANuevoEvento(dia);
  };

  const titulos: Record<PestanaRecordatorios, [string, string]> = {
    PROXIMOS: ["No hay recordatorios próximos", "Creá uno para no olvidarte de vacunas y controles"],
    COMPLETADOS: ["Todavía no hay recordatorios completados", "Acá vas a ver los turnos que ya pasaron"],
    MIOS: ["No tenés recordatorios propios", "Creá uno para acordarte de una vacuna, un baño o lo que necesites"],
  };

  const elegibles = DuenoRepo.mascotasActivas.filter((m) => mascota == null || m.nombre === mascota).map((m) => ({ id: m.id, nombre: m.nombre }));

  return (
    <View style={estilos.raiz}>
      <View style={estilos.segmentos}>
        <Segmento texto="Próximos" activo={pestana === "PROXIMOS"} alTocar={() => setPestana("PROXIMOS")} />
        <Segmento texto="Completados" activo={pestana === "COMPLETADOS"} alTocar={() => setPestana("COMPLETADOS")} />
        <Segmento texto="Míos" activo={pestana === "MIOS"} alTocar={() => setPestana("MIOS")} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={estilos.scroll} showsVerticalScrollIndicator={false}>
        {lista.length === 0 ? (
          <EstadoVacio
            icono="notificacion" titulo={titulos[pestana][0]} mensaje={titulos[pestana][1]}
            textoBoton={pestana !== "COMPLETADOS" ? "+ Crear recordatorio" : undefined}
            alBoton={pestana !== "COMPLETADOS" ? () => agregar(LocalDate.now()) : undefined}
            estilo={{ marginTop: 16 }}
          />
        ) : (
          lista.map((item, i) => <FilaRecordatorio key={item.clave} item={item} ultimo={i === lista.length - 1} />)
        )}
      </ScrollView>
      {!global ? (
        <Pressable
          accessibilityRole="button" accessibilityLabel="Agendar turno" onPress={() => agregar(EstadoDueno.diaSeleccionado)}
          style={[estilos.fab, cursorTocable]}
        >
          <Icono nombre="mas" tamano={26} color={Colores.white} />
        </Pressable>
      ) : null}
      <Boton titulo="Editar evento" variante="secundario" alto={52} estilo={estilos.editar} onPress={() => eventos.elegirParaEditar(mascota)} />

      {editor ? (
        <EditorRecordatorio
          visible mascotas={editor.existente ? DuenoRepo.mascotas.map((m) => ({ id: m.id, nombre: m.nombre })) : elegibles}
          existente={editor.existente} alCerrar={() => setEditor(null)} alGuardar={refrescar}
        />
      ) : null}
      {opciones ? (
        <HojaInferior visible alCerrar={() => setOpciones(null)}>
          <Texto tamano={20} negrita accessibilityRole="header">{opciones.titulo}</Texto>
          <View style={{ marginTop: 16, gap: 10 }}>
            <Boton titulo="Editar" variante="secundario" alto={50} onPress={() => { const r = opciones; setOpciones(null); setEditor({ existente: r }); }} />
            <Boton
              titulo="Eliminar" variante="secundario" alto={50}
              onPress={() => {
                const r = opciones;
                setOpciones(null);
                Avisos.confirmar({
                  titulo: "¿Eliminar el recordatorio?", mensaje: `"${r.titulo}" se borra y ya no te va a avisar.`, textoAceptar: "Eliminar",
                  alAceptar: () => { RecordatoriosRepo.borrar(r); refrescar(); },
                });
              }}
            />
            <Boton titulo="Cancelar" variante="texto" alto={50} onPress={() => setOpciones(null)} />
          </View>
        </HojaInferior>
      ) : null}
      {eventos.dialogos}
    </View>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  segmentos: { flexDirection: "row", height: 48, padding: 4, marginTop: 4, backgroundColor: Colores.white, borderRadius: 22, ...sombra(1) },
  segmento: { flex: 1, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  segmentoActivo: { backgroundColor: Colores.primaryTeal },
  scroll: { paddingTop: 12, paddingBottom: 90 },
  filaRec: { flexDirection: "row", paddingBottom: 4 },
  columnaLinea: { width: 44, alignItems: "center" },
  linea: { position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: Colores.dividerColor },
  icono: { marginTop: 14, width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tarjeta: { flex: 1, marginLeft: 14, marginVertical: 6, padding: 14, backgroundColor: Colores.white, borderRadius: 18, ...sombra(1) },
  titulo: { flexDirection: "row", alignItems: "center" },
  mascota: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  fab: { position: "absolute", right: 0, bottom: 76, width: 56, height: 56, borderRadius: 28, backgroundColor: Colores.primaryTeal, alignItems: "center", justifyContent: "center", ...sombra(3) },
  editar: { marginTop: 8, marginBottom: 8, borderColor: Colores.primaryTeal, borderWidth: 1.5 },
});
