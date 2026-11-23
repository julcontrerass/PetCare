/*
 * Piezas chicas de las pantallas del veterinario que en Android eran estilos de themes.xml (EventoSeccion,
 * VetFormLabel, PetInfoRow...) o widgets del sistema (Spinner). Genéricos de esta carpeta: no se agregaron al kit.
 */
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Colores } from "../common/tema";
import { HojaInferior } from "../common/HojaInferior";
import { Icono, type NombreIcono } from "../common/Icono";
import { Texto } from "../common/Texto";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";

/** Ícono según el tipo de evento (DetalleEventoVetActivity.iconoDe). */
export function iconoDeEvento(tipo: string): NombreIcono {
  switch (tipo) {
    case "Vacuna": return "vacuna";
    case "Cirugía": return "cirugia";
    case "Desparasitación": return "botiquin";
    case "Control": return "pulso";
    case "Tratamiento": return "actividad";
    case "Consulta": return "medico";
    default: return "lista";
  }
}

/** Título de sección (style EventoSeccion: 17sp, negrita, brand_navy). */
export function SeccionTitulo({ texto, estilo }: { texto: string; estilo?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ marginTop: 22 }, estilo]}>
      <Texto variante="titulo" tamano={17} accessibilityRole="header">{texto}</Texto>
    </View>
  );
}

/** Etiqueta de un campo (style VetFormLabel: 13sp negrita). */
export function EtiquetaForm({ texto, primera }: { texto: string; primera?: boolean }) {
  return <Texto variante="etiqueta" tamano={13} style={{ marginTop: primera ? 0 : 14, marginBottom: 6 }}>{texto}</Texto>;
}

/** Tarjeta blanca con relleno (bg_card_white) donde van los campos de un formulario. */
export function CajaForm({ children, estilo }: { children: ReactNode; estilo?: StyleProp<ViewStyle> }) {
  return <View style={[estilos.caja, estilo]}>{children}</View>;
}

/** Aspecto de un campo (bg_field_card, 50dp) que se toca para elegir algo: fecha, hora o una opción de lista. */
export function CampoTocable({
  valor, marcador, alTocar, error, deshabilitado, accesibilidad, icono = "chevronAbajo",
}: {
  valor: string; marcador?: string; alTocar: () => void; error?: string | null; deshabilitado?: boolean; accesibilidad: string; icono?: NombreIcono;
}) {
  const foco = useFoco();
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${accesibilidad}: ${valor || marcador || "sin elegir"}`}
        disabled={deshabilitado}
        onPress={alTocar}
        {...foco.props}
        style={[estilos.campo, { borderColor: error ? Colores.dangerRed : Colores.loginFieldStroke }, cursorTocable, estiloFoco(foco.enfocado)]}
      >
        <Texto variante="cuerpo" tamano={14} color={valor ? Colores.brandNavy : Colores.textGray} style={{ flex: 1 }} numberOfLines={1}>
          {valor || marcador || ""}
        </Texto>
        <Icono nombre={icono} tamano={20} color={Colores.textGray} />
      </Pressable>
      {error ? <Texto variante="chico" color={Colores.dangerRed} style={{ marginTop: 4, marginLeft: 4 }}>{error}</Texto> : null}
    </View>
  );
}

/** Reemplazo del `Spinner`: un campo que abre una hoja con las opciones. */
export function CampoSeleccion({
  opciones, indice, alElegir, titulo, accesibilidad,
}: {
  opciones: string[]; indice: number; alElegir: (i: number) => void; titulo: string; accesibilidad?: string;
}) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <CampoTocable
        valor={opciones[indice] ?? ""} marcador="Elegir" accesibilidad={accesibilidad ?? titulo}
        alTocar={() => setAbierta(true)} deshabilitado={opciones.length === 0}
      />
      <HojaInferior visible={abierta} alCerrar={() => setAbierta(false)}>
        <Texto variante="titulo" tamano={20} accessibilityRole="header" style={{ marginBottom: 8 }}>{titulo}</Texto>
        {opciones.map((o, i) => (
          <FilaOpcion
            key={`${i}-${o}`} texto={o} elegida={i === indice}
            alTocar={() => {
              alElegir(i);
              setAbierta(false);
            }}
          />
        ))}
      </HojaInferior>
    </>
  );
}

function FilaOpcion({ texto, elegida, alTocar }: { texto: string; elegida: boolean; alTocar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={texto} accessibilityState={{ selected: elegida }} onPress={alTocar}
      {...foco.props} style={[estilos.opcion, elegida ? { backgroundColor: Colores.lightTeal } : null, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Texto variante="cuerpo" tamano={15} peso={elegida ? "bold" : "regular"} color={Colores.brandNavy} style={{ flex: 1 }}>{texto}</Texto>
      {elegida ? <Icono nombre="check" tamano={20} color={Colores.primaryTeal} /> : null}
    </Pressable>
  );
}

/** Fila de datos con ícono en un cuadro (PetInfoRow + PetInfoIconBox + PetInfoLabel/Value). */
export function FilaInfo({ icono, etiqueta, valor, conDivisor = true, izquierda }: {
  icono: NombreIcono; etiqueta: string; valor: string; conDivisor?: boolean; izquierda?: ReactNode;
}) {
  return (
    <>
      <View style={estilos.filaInfo}>
        <View style={estilos.cajaIcono}>{izquierda ?? <Icono nombre={icono} tamano={20} color={Colores.primaryTeal} />}</View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Texto variante="chico" tamano={12} color={Colores.textGray}>{etiqueta}</Texto>
          <Texto variante="cuerpo" tamano={15} peso="medium" style={{ marginTop: 1 }}>{valor}</Texto>
        </View>
      </View>
      {conDivisor ? <View style={estilos.divisor} /> : null}
    </>
  );
}

/** Fila de item_turno_detalle: ícono, título chico, valor y una acción de texto opcional ("Ver", "Quitar"). */
export function FilaTurnoDetalle({ icono, titulo, valor, accion, colorAccion = Colores.primaryTeal, alTocar, alAccion, primera }: {
  icono: NombreIcono; titulo: string; valor: string; accion?: string; colorAccion?: string; alTocar?: () => void; alAccion?: () => void; primera?: boolean;
}) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole={alTocar ? "button" : undefined} accessibilityLabel={`${titulo}. ${valor}`} disabled={!alTocar} onPress={alTocar}
      {...foco.props} style={[estilos.filaTurno, { marginTop: primera ? 0 : 14 }, alTocar ? cursorTocable : null, estiloFoco(foco.enfocado)]}
    >
      <View style={estilos.iconoTeal}><Icono nombre={icono} tamano={22} color={Colores.primaryTeal} /></View>
      <View style={{ flex: 1, marginLeft: 14 }}>
        <Texto variante="chico" tamano={12} color={Colores.textGray}>{titulo}</Texto>
        <Texto variante="cuerpo" tamano={15} color={Colores.black}>{valor}</Texto>
      </View>
      {accion ? <AccionTexto texto={accion} color={colorAccion} alTocar={alAccion ?? alTocar} /> : null}
    </Pressable>
  );
}

function AccionTexto({ texto, color, alTocar }: { texto: string; color: string; alTocar?: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={texto} onPress={alTocar} hitSlop={8}
      {...foco.props} style={[{ marginLeft: 8, padding: 4 }, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Texto variante="etiqueta" tamano={14} color={color}>{texto}</Texto>
    </Pressable>
  );
}

/** Cartel de aviso con fondo teal suave (bg_info_banner). */
export function BannerInfo({ texto }: { texto: string }) {
  return (
    <View style={estilos.banner}>
      <Texto variante="cuerpo" tamano={13.5} color={Colores.tealDark}>{texto}</Texto>
    </View>
  );
}

/** "12" -> "12"; "5" -> "05" (el `"%02d".format` del Kotlin). */
export const dosDigitos = (n: number): string => String(n).padStart(2, "0");

const estilos = StyleSheet.create({
  caja: { backgroundColor: Colores.white, borderRadius: 18, padding: 16, marginTop: 10 },
  campo: {
    minHeight: 50, borderRadius: 16, borderWidth: 1, backgroundColor: Colores.white, paddingHorizontal: 14,
    flexDirection: "row", alignItems: "center",
  },
  opcion: { minHeight: 48, borderRadius: 12, paddingHorizontal: 12, flexDirection: "row", alignItems: "center" },
  filaInfo: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  cajaIcono: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  divisor: { height: 1, marginLeft: 50, backgroundColor: Colores.dividerLight },
  filaTurno: { flexDirection: "row", alignItems: "center" },
  iconoTeal: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
  banner: { backgroundColor: Colores.lightTeal, borderRadius: 14, padding: 14, marginBottom: 10 },
});
