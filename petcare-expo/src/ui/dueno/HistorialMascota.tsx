/*
 * Migrado de DetalleMascotaPantalla.kt (pestaña "Historial") + HistorialAdapter.kt + pantalla_mascota_historial.xml +
 * item_historial_clinico.xml: línea de tiempo de los turnos de la mascota, con buscador y filtros.
 */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { DuenoRepo } from "../../data/repositorio/duenoRepo";
import type { Mascota } from "../../model/modelos";
import { Fechas } from "../../util/fechas";
import { Boton } from "../common/Boton";
import { EstiloCategoria } from "../common/EstiloCategoria";
import { FiltroLineaTiempo, useFiltroLineaTiempo } from "../common/FiltroLineaTiempo";
import { Icono, type NombreIcono } from "../common/Icono";
import { Colores, sombra } from "../common/tema";
import { Texto } from "../common/Texto";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { FotoVetEvento } from "./ComponentesHome";
import { EstadoDueno } from "./estadoDueno";
import { useEventosDialogos } from "./EventosDialogos";
import { NavDueno } from "./navegacionDueno";

interface ItemHistorial {
  clave: string;
  titulo: string;
  subtitulo: string;
  icono: NombreIcono;
  fondo: string;
  veterinarioId?: string | null;
  alTocar?: () => void;
}

function FilaHistorial({ item, ultimo }: { item: ItemHistorial; ultimo: boolean }) {
  const foco = useFoco();
  return (
    <View style={estilos.fila}>
      <View style={estilos.columna}>
        {!ultimo ? <View style={estilos.linea} /> : null}
        <View style={[estilos.icono, { backgroundColor: item.fondo }]}>
          <Icono nombre={item.icono} tamano={22} color={Colores.primaryTeal} />
        </View>
      </View>
      <Pressable
        accessibilityRole={item.alTocar ? "button" : undefined} accessibilityLabel={`${item.titulo}. ${item.subtitulo}`}
        disabled={!item.alTocar} onPress={item.alTocar} {...foco.props}
        style={[estilos.tarjeta, item.alTocar ? cursorTocable : null, estiloFoco(foco.enfocado)]}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <Texto tamano={16} negrita>{item.titulo}</Texto>
          <Texto variante="chico" tamano={13} style={{ marginTop: 3 }}>{item.subtitulo}</Texto>
        </View>
        <FotoVetEvento veterinarioId={item.veterinarioId} tamano={34} />
        {item.alTocar ? <Icono nombre="chevronDerecha" tamano={22} color={Colores.textGray} /> : null}
      </Pressable>
    </View>
  );
}

export function HistorialMascota({ mascota }: { mascota: Mascota }) {
  const filtro = useFiltroLineaTiempo();
  const [, redibujar] = useState(0);
  const eventosUi = useEventosDialogos();
  const cambiar = () => redibujar((n) => n + 1);

  // Buscador y filtros por tipo de evento y fechas, arriba de la línea de tiempo
  const categorias = [...new Set(DuenoRepo.eventosDeMascota(mascota.nombre).map((e) => e.categoria))].sort();
  const todos = [...DuenoRepo.eventosDeMascota(mascota.nombre)].sort((a, b) => b.fecha.compareTo(a.fecha));
  const visibles = todos.filter((e) =>
    filtro.admite([e.categoria, e.veterinario, e.observaciones, e.mascota].join(" "), e.categoria, e.fecha),
  );
  let items: ItemHistorial[] = visibles.map((e) => ({
    clave: e.id, titulo: e.categoria, subtitulo: Fechas.corta(e.fecha) + (e.veterinario ? ` · ${e.veterinario}` : ""),
    icono: EstiloCategoria.icono(e.categoria), fondo: EstiloCategoria.fondo(e.categoria), veterinarioId: e.veterinarioId,
    alTocar: () => eventosUi.mostrarDetalle(e, cambiar),
  }));
  if (items.length === 0) {
    items = [
      todos.length > 0 && filtro.activo
        ? { clave: "vacio", titulo: "Sin resultados", subtitulo: "Ningún evento coincide con la búsqueda o los filtros", icono: "buscar", fondo: Colores.iconTealBg }
        : { clave: "vacio", titulo: "Sin eventos clínicos", subtitulo: `No hay turnos registrados para ${mascota.nombre}`, icono: "calendario", fondo: Colores.iconTealBg },
    ];
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={estilos.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <FiltroLineaTiempo filtro={filtro} tipos={categorias} />
        <View style={{ marginTop: 8 }}>
          {items.map((it, i) => <FilaHistorial key={it.clave} item={it} ultimo={i === items.length - 1} />)}
        </View>
      </ScrollView>
      <Pressable
        accessibilityRole="button" accessibilityLabel="Agendar turno" onPress={() => NavDueno.irANuevoEvento(EstadoDueno.diaSeleccionado)}
        style={[estilos.fab, cursorTocable]}
      >
        <Icono nombre="mas" tamano={26} color={Colores.white} />
      </Pressable>
      <Boton
        titulo="Editar evento" variante="secundario" alto={52} estilo={{ marginVertical: 8, borderColor: Colores.primaryTeal, borderWidth: 1.5 }}
        onPress={() => eventosUi.elegirParaEditar(mascota.nombre)}
      />
      {eventosUi.dialogos}
    </View>
  );
}

const estilos = StyleSheet.create({
  scroll: { paddingTop: 4, paddingBottom: 90 },
  fila: { flexDirection: "row", paddingBottom: 4 },
  columna: { width: 44, alignItems: "center" },
  linea: { position: "absolute", top: 0, bottom: 0, width: 2, backgroundColor: Colores.dividerColor },
  icono: { marginTop: 14, width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tarjeta: { flex: 1, flexDirection: "row", alignItems: "center", marginLeft: 14, marginVertical: 6, padding: 14, backgroundColor: Colores.white, borderRadius: 18, ...sombra(1) },
  fab: { position: "absolute", right: 0, bottom: 76, width: 56, height: 56, borderRadius: 28, backgroundColor: Colores.primaryTeal, alignItems: "center", justifyContent: "center", ...sombra(3) },
});
