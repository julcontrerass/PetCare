/*
 * Migrado de ui/veterinario/VetBottomNav.kt + view_vet_bottom_nav.xml + menu/bottom_nav_menu_vet.xml: barra inferior
 * blanca con esquinas superiores de 22dp, cuatro solapas (Inicio, Pacientes, Agenda, Perfil) y, al centro, el botón
 * "+" (Agregar consulta) que sobresale. En Android la barra se repetía en las pantallas de detalle; acá solo vive en
 * las pestañas y las pantallas de detalle se apilan encima.
 */
import { Pressable, StyleSheet, View } from "react-native";
import { Colores, sombra } from "../common/tema";
import { Icono, type NombreIcono } from "../common/Icono";
import { useMargenes } from "../common/Margenes";
import { MenuLateral } from "../common/MenuLateral";
import { Texto } from "../common/Texto";
import { ANCHO_COLUMNA, cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { NavVet } from "./navegacionVet";
import type { SeccionVet } from "./SeccionVet";

const SOLAPAS: { seccion: SeccionVet; titulo: string; icono: NombreIcono }[] = [
  { seccion: "inicio", titulo: "Inicio", icono: "inicio" },
  { seccion: "pacientes", titulo: "Pacientes", icono: "perro" },
  { seccion: "agenda", titulo: "Agenda", icono: "calendario" },
  { seccion: "perfil", titulo: "Perfil", icono: "masOpciones" },
];

function Solapa({ titulo, icono, activa, alTocar }: { titulo: string; icono: NombreIcono; activa: boolean; alTocar: () => void }) {
  const foco = useFoco();
  const color = activa ? Colores.primaryTeal : Colores.textGray;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={titulo}
      accessibilityState={{ selected: activa }}
      onPress={alTocar}
      {...foco.props}
      style={[estilos.solapa, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Icono nombre={icono} tamano={24} color={color} />
      <Texto variante="etiqueta" tamano={12} peso={activa ? "bold" : "medium"} color={color} style={{ marginTop: 4 }}>{titulo}</Texto>
    </Pressable>
  );
}

export interface BarraVetProps {
  seleccionada: SeccionVet;
  alElegir: (seccion: SeccionVet) => void;
  /** El botón central: abre AgregarConsulta. */
  alAgregar: () => void;
}

export function BarraVet({ seleccionada, alElegir, alAgregar }: BarraVetProps) {
  const margenes = useMargenes();
  const foco = useFoco();
  const [a, b, c, d] = SOLAPAS;
  const solapa = (s: (typeof SOLAPAS)[number]) => (
    <Solapa key={s.seccion} titulo={s.titulo} icono={s.icono} activa={s.seccion === seleccionada} alTocar={() => alElegir(s.seccion)} />
  );
  return (
    <View style={estilos.fuera}>
      <View style={[estilos.barra, { paddingBottom: margenes.bottom }]}>
        <View style={estilos.fila}>
          {solapa(a)}
          {solapa(b)}
          <View style={estilos.hueco} />
          {solapa(c)}
          {solapa(d)}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Agregar consulta"
          onPress={alAgregar}
          {...foco.props}
          style={[estilos.fab, { bottom: 26 + margenes.bottom }, cursorTocable, estiloFoco(foco.enfocado)]}
        >
          <Icono nombre="mas" tamano={26} color={Colores.white} />
        </Pressable>
      </View>
    </View>
  );
}

/** Solapa del menú lateral para una ruta del veterinario (`/vet/paciente/1` marca Pacientes). */
export function seccionLateralVet(ruta: string): string {
  const primero = ruta.replace(/^\/vet\/?/, "").split("/")[0] ?? "";
  if (primero === "" || primero === "index") return "inicio";
  if (primero === "paciente" || primero === "dueno-nuevo") return "pacientes";
  if (primero === "evento") return "agenda";
  return primero;
}

/** El formato de escritorio: las cuatro solapas y el botón "Agregar consulta" en el menú lateral. */
export function MenuLateralVet({ ruta }: { ruta: string }) {
  const actual = seccionLateralVet(ruta);
  const ir: Record<SeccionVet, () => void> = {
    inicio: () => NavVet.irAInicio(),
    pacientes: () => NavVet.irAPacientes(),
    agenda: () => NavVet.irAAgenda(),
    perfil: () => NavVet.irAPerfil(),
  };
  return (
    <MenuLateral
      principal={{ texto: "Agregar consulta", icono: "mas", alTocar: () => NavVet.agregarConsulta() }}
      secciones={SOLAPAS.map((s) => ({
        clave: s.seccion,
        texto: s.titulo,
        icono: s.seccion === "perfil" ? "persona" : s.icono,
        activo: actual === s.seccion,
        alTocar: ir[s.seccion],
      }))}
      alCerrarSesion={() => NavVet.cerrarSesion()}
    />
  );
}

const estilos = StyleSheet.create({
  fuera: { alignItems: "center", backgroundColor: Colores.loginBg },
  barra: {
    width: "100%", maxWidth: ANCHO_COLUMNA, backgroundColor: Colores.white, borderTopLeftRadius: 22, borderTopRightRadius: 22,
    ...sombra(3),
  },
  fila: { flexDirection: "row", height: 80, paddingTop: 12 },
  solapa: { flex: 1, alignItems: "center", justifyContent: "flex-start", minHeight: 44 },
  hueco: { flex: 1 },
  fab: {
    position: "absolute", alignSelf: "center", width: 56, height: 56, borderRadius: 16, backgroundColor: Colores.primaryTeal,
    alignItems: "center", justifyContent: "center", ...sombra(3),
  },
});
