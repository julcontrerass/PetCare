/*
 * Migrado de ui/dueno/BarraInferior.kt + view_nav_bar.xml + view_menu_mas_popup.xml: barra inferior del dueño
 * (Inicio, Mascotas, "+" central, Recordatorios, Más) y el menú "Más" que se abre sobre ella.
 */
import { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { DuenoRepo } from "../../data/repositorio/duenoRepo";
import { Icono, type NombreIcono } from "../common/Icono";
import { useMargenes } from "../common/Margenes";
import { Colores, sombra } from "../common/tema";
import { Texto } from "../common/Texto";
import { ANCHO_COLUMNA, cursorTocable, estiloFoco, useFoco, useTeclaEscape } from "../common/Web";
import { EstadoDueno } from "./estadoDueno";
import { MenuMas, pestanaDeRuta, useMenuMasAbierto, type PestanaDueno } from "./menuMas";
import { NavDueno } from "./navegacionDueno";

export const ALTO_BARRA = 80;

interface Pestana {
  clave: PestanaDueno;
  texto: string;
  icono: NombreIcono;
  ir: () => void;
}

const PESTANAS: Pestana[] = [
  { clave: "inicio", texto: "Home", icono: "inicio", ir: () => NavDueno.irAHome() },
  { clave: "mascotas", texto: "Mascotas", icono: "perro", ir: () => NavDueno.irAMascotas() },
  { clave: "recordatorios", texto: "Recordatorios", icono: "notificacion", ir: () => NavDueno.irARecordatorios() },
];

function ItemPestana({ p, activa, alTocar }: { p: Pestana | { clave: "mas"; texto: string; icono: NombreIcono }; activa: boolean; alTocar: () => void }) {
  const foco = useFoco();
  const color = activa ? Colores.primaryTeal : Colores.textGray;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={p.texto}
      accessibilityState={{ selected: activa }}
      onPress={alTocar}
      {...foco.props}
      style={[estilos.item, activa ? estilos.itemActivo : null, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Icono nombre={p.icono} tamano={24} color={color} />
      <Texto tamano={11} color={color} numberOfLines={1} style={estilos.textoItem}>{p.texto}</Texto>
    </Pressable>
  );
}

export interface BarraInferiorProps {
  /** Nombre de la ruta visible dentro de las pestañas (`index`, `mascotas`, ... o una oculta). */
  ruta?: string;
}

const PresionableAnimado = Animated.createAnimatedComponent(Pressable);

/** La barra: la pestaña activa se pinta de teal; con el menú "Más" abierto se marca "Más". */
export function BarraInferior({ ruta }: BarraInferiorProps) {
  const margenes = useMargenes();
  const menu = useMenuMasAbierto();
  const actual = pestanaDeRuta(ruta);
  const escalaFab = useRef(new Animated.Value(1)).current;
  // Como en Android: el botón crece un poco y vuelve (100 ms cada tramo)
  const rebotarFab = () => {
    Animated.sequence([
      Animated.timing(escalaFab, { toValue: 1.2, duration: 100, useNativeDriver: true }),
      Animated.timing(escalaFab, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };
  return (
    <View style={estilos.exterior}>
      <View style={[estilos.barra, { height: ALTO_BARRA + margenes.bottom, paddingBottom: margenes.bottom }]}>
        <ItemPestana
          p={PESTANAS[0]} activa={!menu && actual === "inicio"}
          alTocar={() => { if (actual === "inicio" && !menu) return; MenuMas.cerrar(); PESTANAS[0].ir(); }}
        />
        <ItemPestana
          p={PESTANAS[1]} activa={!menu && actual === "mascotas"}
          alTocar={() => { if (actual === "mascotas" && !menu) return; MenuMas.cerrar(); PESTANAS[1].ir(); }}
        />
        <View style={estilos.hueco} />
        <ItemPestana
          p={PESTANAS[2]} activa={!menu && actual === "recordatorios"}
          alTocar={() => { if (actual === "recordatorios" && !menu) return; MenuMas.cerrar(); PESTANAS[2].ir(); }}
        />
        <ItemPestana p={{ clave: "mas", texto: "Más", icono: "masOpciones" }} activa={menu} alTocar={() => MenuMas.alternar()} />
        <PresionableAnimado
          accessibilityRole="button"
          accessibilityLabel="Agendar evento"
          onPress={() => {
            rebotarFab();
            MenuMas.cerrar();
            NavDueno.irANuevoEvento(EstadoDueno.diaSeleccionado);
          }}
          style={[estilos.fab, { bottom: 16 + margenes.bottom, transform: [{ scale: escalaFab }] }, cursorTocable]}
        >
          <Icono nombre="mas" tamano={28} color={Colores.white} />
        </PresionableAnimado>
      </View>
    </View>
  );
}

interface OpcionMenu {
  clave: string;
  texto: string;
  icono: NombreIcono;
  restaurar: boolean;
  accion: () => void;
}

const OPCIONES: OpcionMenu[] = [
  { clave: "perfil", texto: "Mi perfil", icono: "persona", restaurar: false, accion: () => NavDueno.irAPerfil() },
  { clave: "veterinarios", texto: "Veterinarios autorizados", icono: "botiquin", restaurar: false, accion: () => NavDueno.irAVeterinarios() },
  { clave: "solicitudes", texto: "Solicitudes de acceso", icono: "llave", restaurar: false, accion: () => NavDueno.irASolicitudes() },
  { clave: "salud", texto: "Vacunas y documentos", icono: "vacuna", restaurar: true, accion: () => NavDueno.abrirCarnet() },
  { clave: "calendario", texto: "Calendario", icono: "calendario", restaurar: false, accion: () => NavDueno.irACalendario() },
  { clave: "notificaciones", texto: "Notificaciones", icono: "notificacion", restaurar: true, accion: () => NavDueno.mostrarNotificaciones() },
];

function FilaMenu({ icono, texto, color, fondo, punto, alTocar, clave }: {
  icono: NombreIcono; texto: string; color?: string; fondo?: string; punto?: boolean; alTocar: () => void; clave: string;
}) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityLabel={texto}
      testID={`mas-${clave}`}
      onPress={alTocar}
      {...foco.props}
      style={({ pressed }) => [estilos.fila, pressed ? { backgroundColor: "#F2F4F4" } : null, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <View style={[estilos.cajaIcono, fondo ? { backgroundColor: fondo } : null]}>
        <Icono nombre={icono} tamano={20} color={color ?? Colores.primaryTeal} />
      </View>
      <Texto peso="medium" color={color ?? Colores.brandNavy} style={estilos.textoFila}>{texto}</Texto>
      {punto ? <View accessibilityLabel="Hay notificaciones sin leer" style={estilos.punto} /> : null}
    </Pressable>
  );
}

/** Menú "Más": velo oscuro sobre la pantalla (sin tapar la barra) y la tarjeta abajo a la derecha. */
export function MenuMasOverlay() {
  const abierto = useMenuMasAbierto();
  const margenes = useMargenes();
  useTeclaEscape(abierto, () => MenuMas.cerrar());
  if (!abierto) return null;
  const elegir = (o: OpcionMenu) => {
    MenuMas.cerrar();
    o.accion();
  };
  return (
    <View style={[estilos.velo, { bottom: ALTO_BARRA + margenes.bottom }]} pointerEvents="box-none">
      <Pressable accessibilityLabel="Cerrar menú" style={StyleSheet.absoluteFill} onPress={() => MenuMas.cerrar()} />
      <View style={estilos.columnaMenu} pointerEvents="box-none">
        <View style={estilos.tarjeta} accessibilityViewIsModal>
          {OPCIONES.map((o) => (
            <FilaMenu
              key={o.clave} clave={o.clave} icono={o.icono} texto={o.texto}
              punto={o.clave === "notificaciones" && DuenoRepo.hayNotificacionesSinLeer}
              alTocar={() => elegir(o)}
            />
          ))}
          <View style={estilos.divisor} />
          <FilaMenu
            clave="cerrar-sesion" icono="salir" texto="Cerrar sesión" color={Colores.dangerRed} fondo={Colores.lightRed}
            alTocar={() => { MenuMas.cerrar(); NavDueno.cerrarSesion(); }}
          />
        </View>
      </View>
    </View>
  );
}

/** Cierra el menú si la ruta cambia (el `resaltar` de Android cerraba el menú al mostrar otra sección). */
export function useCerrarMenuAlCambiar(ruta: string | undefined): void {
  useEffect(() => { MenuMas.cerrar(); }, [ruta]);
}

const estilos = StyleSheet.create({
  exterior: { width: "100%", alignItems: "center" },
  barra: {
    width: "100%", maxWidth: ANCHO_COLUMNA, flexDirection: "row", alignItems: "center", backgroundColor: Colores.white,
    borderTopLeftRadius: 22, borderTopRightRadius: 22, ...sombra(3),
  },
  item: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 8 },
  itemActivo: { transform: [{ scale: 1.1 }] },
  textoItem: { marginTop: 1, textAlign: "center" },
  hueco: { flex: 1 },
  fab: {
    position: "absolute", alignSelf: "center", left: "50%", marginLeft: -28, width: 56, height: 56, borderRadius: 28,
    backgroundColor: Colores.primaryTeal, alignItems: "center", justifyContent: "center", ...sombra(4),
  },
  velo: { position: "absolute", top: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.33)", alignItems: "center" },
  columnaMenu: { flex: 1, width: "100%", maxWidth: ANCHO_COLUMNA, alignItems: "flex-end", justifyContent: "flex-end", paddingRight: 14, paddingBottom: 10 },
  tarjeta: { width: 272, maxWidth: "100%", backgroundColor: Colores.white, borderRadius: 24, paddingVertical: 8, ...sombra(4) },
  fila: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 10 },
  cajaIcono: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
  textoFila: { flex: 1, marginLeft: 14 },
  punto: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colores.dangerRed },
  divisor: { height: 1, marginHorizontal: 16, marginVertical: 4, backgroundColor: Colores.dividerLight },
});
