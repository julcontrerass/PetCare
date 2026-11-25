/*
 * Migrado de ui/dueno/MascotasPantalla.kt + pantalla_mis_mascotas.xml + item_mascota.xml: lista de mascotas con
 * filtro por tipo (Todas, Perros, Gatos, Otras, Históricas).
 */
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { DuenoRepo } from "../../data/repositorio/duenoRepo";
import type { Mascota } from "../../model/modelos";
import { Fechas } from "../../util/fechas";
import { ChipEstadoMascota, EstadoVacio } from "../common/ComponentesDueno";
import { Icono } from "../common/Icono";
import { ImagenRemota } from "../common/ImagenRemota";
import { Grilla } from "../common/Grilla";
import { PantallaBase } from "../common/PantallaBase";
import { Colores, sombra } from "../common/tema";
import { Texto } from "../common/Texto";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { useDatos } from "../common/useDatos";
import { useSesionRequerida } from "../common/useSesionRequerida";
import { BotonAgregar } from "./ComponentesHome";
import { NavDueno } from "./navegacionDueno";

export type FiltroMascotas = "TODAS" | "PERROS" | "GATOS" | "OTRAS" | "HISTORICAS";

const FILTROS: { clave: FiltroMascotas; texto: string }[] = [
  { clave: "TODAS", texto: "Todas" },
  { clave: "PERROS", texto: "Perros" },
  { clave: "GATOS", texto: "Gatos" },
  { clave: "OTRAS", texto: "Otras" },
  { clave: "HISTORICAS", texto: "Históricas" },
];

/** Las inactivas y las fallecidas solo se ven en "Históricas"; el resto de las solapas muestra las activas. */
export function filtroAdmite(filtro: FiltroMascotas, mascota: Mascota): boolean {
  if (filtro === "HISTORICAS") return mascota.estado !== "ACTIVA";
  if (mascota.estado !== "ACTIVA") return false;
  const tipo = mascota.tipo.trim().toLowerCase();
  switch (filtro) {
    case "TODAS": return true;
    case "PERROS": return tipo === "perro";
    case "GATOS": return tipo === "gato";
    default: return tipo !== "perro" && tipo !== "gato";
  }
}

/** "Vacuna · 15 Oct" del próximo evento de la mascota, o null si no tiene ninguno. */
export function proximoEventoTexto(nombreMascota: string): string | null {
  const evento = DuenoRepo.proximoEvento(nombreMascota);
  if (!evento) return null;
  return `${evento.categoria} · ${evento.fecha.dayOfMonth} ${Fechas.mesCorto(evento.fecha.monthValue)}`;
}

function MiniChip({ texto }: { texto: string | null | undefined }) {
  if (!texto) return null;
  return (
    <View style={estilos.miniChip}>
      <Texto tamano={11.5} negrita color={Colores.tealDark}>{texto}</Texto>
    </View>
  );
}

function TarjetaMascota({ mascota }: { mascota: Mascota }) {
  const foco = useFoco();
  const proximo = proximoEventoTexto(mascota.nombre);
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={`${mascota.nombre}, ${mascota.tipo}`}
      onPress={() => NavDueno.irADetalleMascota(mascota)} {...foco.props}
      style={[estilos.tarjeta, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <View style={estilos.fila}>
        <ImagenRemota
          fotoUri={mascota.fotoUri} fotoPath={mascota.fotoPath} estilo={estilos.foto}
          respaldo={<Texto tamano={32} negrita color={Colores.primaryTeal}>{mascota.inicial}</Texto>}
        />
        <View style={estilos.textos}>
          <Texto tamano={18} negrita numberOfLines={1}>{mascota.nombre}</Texto>
          <Texto variante="chico" tamano={13.5} numberOfLines={1} style={{ marginTop: 1 }}>
            {mascota.raza ? `${mascota.tipo} · ${mascota.raza}` : mascota.tipo}
          </Texto>
          <View style={estilos.chips}>
            <MiniChip texto={mascota.edadTexto()} />
            <MiniChip texto={mascota.tienePesoValido ? mascota.peso : null} />
            <MiniChip texto={mascota.sexo} />
            <MiniChip texto={mascota.compartida ? "Compartida" : null} />
          </View>
        </View>
        <Icono nombre="chevronDerecha" tamano={22} color={Colores.textGray} />
      </View>
      <View style={estilos.divisor} />
      <View style={estilos.pie}>
        <ChipEstadoMascota nombreMascota={mascota.nombre} />
        <View style={estilos.proximo}>
          <Icono nombre="calendario" tamano={16} color={Colores.textGray} />
          <Texto variante="chico" tamano={12} numberOfLines={1} style={{ marginLeft: 6, flexShrink: 1 }}>
            {proximo ? `Próx.: ${proximo}` : "Sin eventos próximos"}
          </Texto>
        </View>
      </View>
    </Pressable>
  );
}

function Pildora({ texto, activa, alTocar }: { texto: string; activa: boolean; alTocar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={texto} accessibilityState={{ selected: activa }} onPress={alTocar} {...foco.props}
      style={[estilos.pildora, activa ? estilos.pildoraActiva : null, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Texto tamano={14} negrita color={activa ? Colores.white : Colores.textGray}>{texto}</Texto>
    </Pressable>
  );
}

export default function MascotasPantalla() {
  useSesionRequerida();
  useDatos();
  const [filtro, setFiltro] = useState<FiltroMascotas>("TODAS");
  // Al entrar a la sección el filtro vuelve a "Todas"
  useFocusEffect(useCallback(() => { setFiltro("TODAS"); }, []));

  const todas = DuenoRepo.mascotas;
  const visibles = todas.filter((m) => filtroAdmite(filtro, m));
  const activas = todas.filter((m) => m.estado === "ACTIVA").length;
  const historicas = todas.length - activas;
  const cuenta = (activas === 1 ? "1 mascota" : `${activas} mascotas`) + (historicas > 0 ? ` · ${historicas} en el historial` : "");
  const hist = filtro === "HISTORICAS";

  return (
    <PantallaBase
      bordes={["top"]} titulo="Mis mascotas" subtitulo={cuenta} alVolver={() => NavDueno.irAHome()}
      derecha={<BotonAgregar etiqueta="Agregar mascota" onPress={() => NavDueno.irANuevaMascota()} />}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.filtros} contentContainerStyle={estilos.filtrosContenido}>
        {FILTROS.map((f) => <Pildora key={f.clave} texto={f.texto} activa={f.clave === filtro} alTocar={() => setFiltro(f.clave)} />)}
      </ScrollView>
      <View style={{ marginTop: 8 }}>
        <Grilla columnas={2}>{visibles.map((m) => <TarjetaMascota key={m.id} mascota={m} />)}</Grilla>
        {visibles.length === 0 ? (
          <EstadoVacio
            icono="perro"
            titulo={hist ? "No tenés mascotas históricas" : "No hay mascotas en esta categoría"}
            mensaje={hist ? "Acá aparecen las que pasaron a estar inactivas o fallecidas" : "Probá con otro filtro o agregá una nueva mascota"}
            estilo={{ marginBottom: 14 }}
          />
        ) : null}
        <Pressable
          accessibilityRole="button" accessibilityLabel="Agregar mascota" onPress={() => NavDueno.irANuevaMascota()}
          style={[estilos.agregar, cursorTocable]}
        >
          <Icono nombre="mas" tamano={22} color={Colores.primaryTeal} />
          <Texto tamano={15} negrita color={Colores.primaryTeal} style={{ marginLeft: 8 }}>Agregar mascota</Texto>
        </Pressable>
      </View>
    </PantallaBase>
  );
}

const estilos = StyleSheet.create({
  filtros: { marginHorizontal: -20, marginTop: 10, flexGrow: 0 },
  filtrosContenido: { paddingHorizontal: 20, paddingVertical: 4 },
  pildora: { backgroundColor: Colores.white, borderRadius: 22, paddingHorizontal: 18, paddingVertical: 9, marginRight: 10, ...sombra(1) },
  pildoraActiva: { backgroundColor: Colores.primaryTeal },
  tarjeta: { backgroundColor: Colores.white, borderRadius: 18, padding: 14, marginBottom: 14, ...sombra(1) },
  fila: { flexDirection: "row", alignItems: "center" },
  foto: { width: 84, height: 84, borderRadius: 18, backgroundColor: Colores.lightTeal },
  textos: { flex: 1, minWidth: 0, marginLeft: 14 },
  chips: { flexDirection: "row", flexWrap: "wrap", marginTop: 8, rowGap: 6 },
  miniChip: { backgroundColor: "#EEF2F1", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 3, marginRight: 6 },
  divisor: { height: 1, marginTop: 12, backgroundColor: Colores.dividerLight },
  pie: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 },
  proximo: { flexDirection: "row", alignItems: "center", flexShrink: 1, marginLeft: 10, maxWidth: 210 },
  agregar: {
    height: 64, borderRadius: 18, borderWidth: 2, borderStyle: "dashed", borderColor: "#9FC7C2", backgroundColor: "rgba(255,255,255,0.5)",
    flexDirection: "row", alignItems: "center", justifyContent: "center",
  },
});
