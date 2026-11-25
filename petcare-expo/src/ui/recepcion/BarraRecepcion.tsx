/*
 * Barra inferior del modo recepción, igual a la del veterinario (BarraVet): blanca con las esquinas superiores
 * redondeadas, cuatro solapas (Hoy, Agenda, Pacientes, Perfil) y al centro el botón "+" que saca un turno nuevo.
 * En escritorio las mismas solapas van en el menú lateral.
 */
import { Pressable, StyleSheet, View } from "react-native";
import { Icono, type NombreIcono } from "../common/Icono";
import { useMargenes } from "../common/Margenes";
import { MenuLateral } from "../common/MenuLateral";
import { Colores, sombra } from "../common/tema";
import { Texto } from "../common/Texto";
import { ANCHO_COLUMNA, cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { NavRecepcion } from "./navegacionRecepcion";

export type SeccionRecepcion = "hoy" | "agenda" | "pacientes" | "perfil";

/** Nombre de la ruta de cada pestaña dentro de `src/app/recepcion/(tabs)/`. */
export const RutaDeSeccionRecepcion: Record<SeccionRecepcion, string> = {
  hoy: "index",
  agenda: "agenda",
  pacientes: "pacientes",
  perfil: "perfil",
};

const SOLAPAS: { seccion: SeccionRecepcion; titulo: string; icono: NombreIcono }[] = [
  { seccion: "hoy", titulo: "Hoy", icono: "reloj" },
  { seccion: "agenda", titulo: "Agenda", icono: "calendario" },
  { seccion: "pacientes", titulo: "Pacientes", icono: "perro" },
  { seccion: "perfil", titulo: "Perfil", icono: "masOpciones" },
];

function Solapa({ titulo, icono, activa, alTocar }: { titulo: string; icono: NombreIcono; activa: boolean; alTocar: () => void }) {
  const foco = useFoco();
  const color = activa ? Colores.primaryTeal : Colores.textGray;
  return (
    <Pressable
      accessibilityRole="tab" accessibilityLabel={titulo} accessibilityState={{ selected: activa }} onPress={alTocar}
      {...foco.props} style={[estilos.solapa, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Icono nombre={icono} tamano={24} color={color} />
      <Texto variante="etiqueta" tamano={12} peso={activa ? "bold" : "medium"} color={color} style={{ marginTop: 4 }}>{titulo}</Texto>
    </Pressable>
  );
}

export function BarraRecepcion({ seleccionada, alElegir }: { seleccionada: SeccionRecepcion; alElegir: (s: SeccionRecepcion) => void }) {
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
          accessibilityRole="button" accessibilityLabel="Nuevo turno" onPress={() => NavRecepcion.nuevoTurno()} {...foco.props}
          style={[estilos.fab, { bottom: 26 + margenes.bottom }, cursorTocable, estiloFoco(foco.enfocado)]}
        >
          <Icono nombre="mas" tamano={26} color={Colores.white} />
        </Pressable>
      </View>
    </View>
  );
}

/** Solapa del menú lateral para una ruta de la recepción (`/recepcion/turno-nuevo` marca Agenda). */
function seccionLateral(ruta: string): SeccionRecepcion {
  const primero = ruta.replace(/^\/recepcion\/?/, "").split("/")[0] ?? "";
  if (primero === "" || primero === "index") return "hoy";
  if (primero === "turno-nuevo") return "agenda";
  return (["agenda", "pacientes", "perfil"] as const).find((s) => s === primero) ?? "hoy";
}

/** El formato de escritorio: las cuatro solapas y "Nuevo turno" en el menú lateral. */
export function MenuLateralRecepcion({ ruta }: { ruta: string }) {
  const actual = seccionLateral(ruta);
  const ir: Record<SeccionRecepcion, () => void> = {
    hoy: () => NavRecepcion.irAHoy(),
    agenda: () => NavRecepcion.irAAgenda(),
    pacientes: () => NavRecepcion.irAPacientes(),
    perfil: () => NavRecepcion.irAPerfil(),
  };
  return (
    <MenuLateral
      principal={{ texto: "Nuevo turno", icono: "mas", alTocar: () => NavRecepcion.nuevoTurno() }}
      secciones={SOLAPAS.map((s) => ({
        clave: s.seccion, texto: s.titulo, icono: s.seccion === "perfil" ? "persona" : s.icono,
        activo: actual === s.seccion, alTocar: ir[s.seccion],
      }))}
      alCerrarSesion={() => NavRecepcion.cerrarSesion()}
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
