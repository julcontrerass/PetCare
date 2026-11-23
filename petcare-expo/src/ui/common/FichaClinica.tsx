/*
 * Migrado de ui/common/FichaClinica.kt: tarjetas de la ficha de una mascota que comparten el dueño y el veterinario:
 * alertas clínicas y evolución del peso.
 */
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { GraficoPesoView, type PuntoPeso } from "./GraficoPesoView";
import { Colores } from "./tema";
import { Texto } from "./Texto";
import { cursorTocable, estiloFoco, useFoco } from "./Web";

export interface AlertasClinicasProps {
  /** Las alertas escritas (alergias, carácter, condiciones crónicas); vacío o en blanco si no hay ninguna. */
  texto: string;
  /** Con esto el veterinario puede cambiarlas; sin esto, solo se leen. */
  alEditar?: () => void;
  estilo?: StyleProp<ViewStyle>;
}

/**
 * Alertas que hay que tener presentes en cada consulta (alergias, carácter, condiciones crónicas). Con [alEditar] el
 * veterinario puede cambiarlas; sin él, solo se leen.
 */
export function AlertasClinicas({ texto, alEditar, estilo }: AlertasClinicasProps) {
  const hay = texto.trim() !== "";
  const foco = useFoco();
  return (
    <View style={[estilos.tarjeta, hay ? estilos.conAlertas : estilos.sinAlertas, estilo]}>
      <View style={estilos.contenido}>
        <Texto variante="etiqueta" tamano={14}>{hay ? "Alertas clínicas" : "Alertas clínicas: ninguna cargada"}</Texto>
        {hay ? <Texto variante="cuerpo" tamano={14} style={estilos.texto}>{texto}</Texto> : null}
        {alEditar ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hay ? "Editar alertas" : "Agregar alertas"}
            onPress={alEditar}
            {...foco.props}
            style={[estilos.editar, cursorTocable, estiloFoco(foco.enfocado)]}
          >
            <Texto variante="etiqueta" tamano={13.5} color={Colores.primaryTeal}>
              {hay ? "Editar alertas" : "Agregar alertas (alergias, carácter, condiciones)"}
            </Texto>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export interface EvolucionPesoProps {
  /** Una medición por cada vez que se pesó: [día, kg]. */
  puntos: readonly PuntoPeso[];
  estilo?: StyleProp<ViewStyle>;
}

/** La evolución del peso; no se dibuja nada si todavía no hay al menos dos mediciones. */
export function EvolucionPeso({ puntos, estilo }: EvolucionPesoProps) {
  if (puntos.length < 2) return null;
  return (
    <View style={[estilos.tarjeta, estilos.sinAlertas, estilo]}>
      <View style={[estilos.contenido, estilos.contenidoPeso]}>
        <Texto variante="etiqueta" tamano={14}>Evolución del peso</Texto>
        <GraficoPesoView puntos={puntos} />
      </View>
    </View>
  );
}

/** Como el `object FichaClinica` del Kotlin: `alertas` y `peso` son los dos componentes. */
export const FichaClinica = { alertas: AlertasClinicas, peso: EvolucionPeso };

const estilos = StyleSheet.create({
  tarjeta: { marginTop: 4, marginBottom: 14, borderRadius: 14, borderWidth: 1 },
  conAlertas: { backgroundColor: Colores.lightOrange, borderColor: Colores.accentOrange },
  sinAlertas: { backgroundColor: Colores.white, borderColor: Colores.dividerLight },
  contenido: { paddingHorizontal: 14, paddingVertical: 12 },
  contenidoPeso: { paddingBottom: 8 },
  texto: { paddingTop: 4 },
  editar: { paddingTop: 8, alignSelf: "flex-start", minHeight: 32, justifyContent: "center" },
});
