/**
 * Menú lateral del formato de escritorio (web ancha): reemplaza la barra inferior del teléfono en los tres roles.
 * Arriba el logo y la acción principal, después las secciones y, separadas, las opciones secundarias; al pie,
 * cerrar sesión.
 */
import type { ReactNode } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Icono, type NombreIcono } from "./Icono";
import { Insignia } from "./Insignia";
import { useMargenes } from "./Margenes";
import { Colores, sombra } from "./tema";
import { Texto } from "./Texto";
import { ANCHO_MENU_LATERAL, cursorTocable, estiloFoco, useEscritorio, useFoco } from "./Web";

const LOGO = require("../../../assets/images/logo_petcare.png") as number;

export interface ItemMenuLateral {
  clave: string;
  texto: string;
  icono: NombreIcono;
  activo?: boolean;
  /** Contador rojo junto al ícono (0 = no se dibuja). */
  insignia?: number;
  /** Punto rojo de "hay algo sin leer". */
  punto?: boolean;
  alTocar: () => void;
}

export interface MenuLateralProps {
  /** Botón destacado debajo del logo (Agendar evento, Agregar consulta). */
  principal?: { texto: string; icono: NombreIcono; alTocar: () => void };
  /** Las secciones (equivalen a las pestañas del teléfono). */
  secciones: ItemMenuLateral[];
  /** Opciones secundarias, debajo de un separador. */
  otras?: ItemMenuLateral[];
  alCerrarSesion?: () => void;
}

function Item({ item, peligro }: { item: ItemMenuLateral; peligro?: boolean }) {
  const foco = useFoco();
  const activo = !!item.activo;
  const color = peligro ? Colores.dangerRed : activo ? Colores.primaryTeal : Colores.brandNavy;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={item.texto}
      accessibilityState={{ selected: activo }}
      testID={`menu-${item.clave}`}
      onPress={item.alTocar}
      {...foco.props}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        estilos.item,
        activo ? estilos.itemActivo : hovered || pressed ? estilos.itemEncima : null,
        cursorTocable,
        estiloFoco(foco.enfocado),
      ]}
    >
      <View>
        <Icono nombre={item.icono} tamano={22} color={color} />
        <Insignia cantidad={item.insignia ?? 0} estilo={estilos.insignia} />
      </View>
      <Texto peso={activo ? "bold" : "medium"} tamano={15} color={color} numberOfLines={1} style={estilos.textoItem}>
        {item.texto}
      </Texto>
      {item.punto ? <View accessibilityLabel="Hay notificaciones sin leer" style={estilos.punto} /> : null}
    </Pressable>
  );
}

function BotonPrincipal({ texto, icono, alTocar }: NonNullable<MenuLateralProps["principal"]>) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={texto}
      onPress={alTocar}
      {...foco.props}
      style={({ hovered, pressed }: { hovered?: boolean; pressed: boolean }) => [
        estilos.principal,
        hovered || pressed ? estilos.principalEncima : null,
        cursorTocable,
        estiloFoco(foco.enfocado),
      ]}
    >
      <Icono nombre={icono} tamano={22} color={Colores.white} />
      <Texto peso="bold" tamano={15} color={Colores.white} style={estilos.textoPrincipal}>{texto}</Texto>
    </Pressable>
  );
}

export function MenuLateral({ principal, secciones, otras, alCerrarSesion }: MenuLateralProps) {
  const margenes = useMargenes();
  return (
    <View
      accessibilityRole="navigation"
      testID="menu-lateral"
      style={[estilos.menu, { paddingTop: 24 + margenes.top, paddingBottom: 16 + margenes.bottom }]}
    >
      <Image source={LOGO} resizeMode="contain" accessibilityLabel="Logo de PetCare" style={estilos.logo} />
      {principal ? <BotonPrincipal {...principal} /> : null}
      <ScrollView style={estilos.lista} contentContainerStyle={estilos.listaContenido} showsVerticalScrollIndicator={false}>
        {secciones.map((s) => (
          <Item key={s.clave} item={s} />
        ))}
        {otras && otras.length > 0 ? (
          <>
            <View style={estilos.divisor} />
            {otras.map((s) => (
              <Item key={s.clave} item={s} />
            ))}
          </>
        ) : null}
      </ScrollView>
      {alCerrarSesion ? (
        <Item item={{ clave: "cerrar-sesion", texto: "Cerrar sesión", icono: "salir", alTocar: alCerrarSesion }} peligro />
      ) : null}
    </View>
  );
}

/**
 * Marco de un rol: en escritorio pone [menu] a la izquierda y el resto ([children], la pila de pantallas) al lado;
 * en el teléfono devuelve [children] solo, sin cambios.
 */
export function MarcoConMenu({ menu, children }: { menu: ReactNode; children: ReactNode }) {
  const escritorio = useEscritorio();
  if (!escritorio) return <>{children}</>;
  return (
    <View style={estilos.marco}>
      {menu}
      <View style={estilos.marcoContenido}>{children}</View>
    </View>
  );
}

const estilos = StyleSheet.create({
  marco: { flex: 1, flexDirection: "row", backgroundColor: Colores.loginBg },
  marcoContenido: { flex: 1, minWidth: 0 },
  menu: {
    width: ANCHO_MENU_LATERAL,
    paddingHorizontal: 16,
    backgroundColor: Colores.white,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    ...sombra(3),
  },
  // Alto explícito: en la web `aspectRatio` con `width` deja la imagen con su alto natural
  logo: { width: 130, height: (130 * 648) / 840, alignSelf: "center", marginBottom: 20 },
  principal: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: Colores.primaryTeal,
    marginBottom: 16,
    ...sombra(2),
  },
  principalEncima: { opacity: 0.9 },
  textoPrincipal: { marginLeft: 8 },
  lista: { flex: 1 },
  listaContenido: { paddingBottom: 8 },
  item: { flexDirection: "row", alignItems: "center", minHeight: 44, paddingHorizontal: 12, borderRadius: 12, marginBottom: 2 },
  itemActivo: { backgroundColor: Colores.lightTeal },
  itemEncima: { backgroundColor: "#F2F4F4" },
  textoItem: { flex: 1, marginLeft: 12 },
  insignia: { position: "absolute", top: -8, right: -12 },
  punto: { width: 9, height: 9, borderRadius: 5, backgroundColor: Colores.dangerRed },
  divisor: { height: 1, marginVertical: 10, marginHorizontal: 4, backgroundColor: Colores.dividerLight },
});
