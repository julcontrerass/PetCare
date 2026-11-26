/*
 * Elegir una habilitación de la veterinaria (comercial o sanitaria): un PDF o una foto. Muestra el nombre del archivo
 * elegido o, si ya está subida, que está cargada; tocarla la cambia.
 */
import { Pressable, StyleSheet, View } from "react-native";
import { problemaConHabilitacion, type ArchivoHabilitacion } from "../../data/habilitaciones";
import type { TipoHabilitacion } from "../../data/remoto/dtos";
import { Avisos } from "./Avisos";
import { Icono } from "./Icono";
import { elegirArchivo } from "./Selectores";
import { Colores } from "./tema";
import { Texto } from "./Texto";
import { cursorTocable, estiloFoco, useFoco } from "./Web";

export const NOMBRE_HABILITACION: Record<TipoHabilitacion, string> = {
  comercial: "Habilitación comercial",
  sanitaria: "Habilitación sanitaria",
};

const AYUDA: Record<TipoHabilitacion, string> = {
  comercial: "La que da el municipio para abrir el local",
  sanitaria: "La del establecimiento veterinario (Colegio o Ministerio)",
};

/** Abre el selector (PDF o imagen) y devuelve el archivo si sirve; si no, avisa por qué. */
export async function elegirHabilitacion(): Promise<ArchivoHabilitacion | null> {
  const a = await elegirArchivo(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
  if (!a) return null;
  const problema = problemaConHabilitacion(a.nombre, a.tamano);
  if (problema) {
    Avisos.aviso(problema);
    return null;
  }
  return { uri: a.uri, nombre: a.nombre };
}

export function SelectorHabilitacion({ tipo, archivo, yaCargada = false, error, ocupado = false, alElegir }: {
  tipo: TipoHabilitacion;
  archivo: ArchivoHabilitacion | null;
  /** Ya está subida en el servidor (solo se puede reemplazar). */
  yaCargada?: boolean;
  error?: string | null;
  ocupado?: boolean;
  alElegir: (a: ArchivoHabilitacion) => void;
}) {
  const foco = useFoco();
  const listo = archivo != null || yaCargada;
  const elegir = async () => {
    const a = await elegirHabilitacion();
    if (a) alElegir(a);
  };
  return (
    <View style={estilos.envoltura}>
      <Pressable
        accessibilityRole="button" accessibilityLabel={`${NOMBRE_HABILITACION[tipo]}: ${listo ? "cambiar" : "subir"}`}
        onPress={() => void elegir()} disabled={ocupado} {...foco.props}
        style={[estilos.caja, listo ? estilos.cajaLista : null, error ? estilos.cajaError : null, cursorTocable, estiloFoco(foco.enfocado)]}
      >
        <View style={[estilos.icono, { backgroundColor: listo ? Colores.lightGreen : Colores.lightTeal }]}>
          <Icono nombre={listo ? "checkCirculo" : "documento"} tamano={22} color={listo ? Colores.successGreen : Colores.primaryTeal} />
        </View>
        <View style={estilos.textos}>
          <Texto tamano={14.5} negrita>{NOMBRE_HABILITACION[tipo]}</Texto>
          <Texto variante="chico" tamano={12} numberOfLines={1}>
            {ocupado ? "Subiendo..." : archivo ? archivo.nombre : yaCargada ? "Cargada · tocá para reemplazarla" : AYUDA[tipo]}
          </Texto>
        </View>
        <Texto tamano={13} negrita color={Colores.primaryTeal}>{listo ? "Cambiar" : "Subir"}</Texto>
      </Pressable>
      {error ? <Texto variante="chico" tamano={12} color={Colores.dangerRed} style={{ marginTop: 4 }}>{error}</Texto> : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  envoltura: { marginTop: 12 },
  caja: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 16, borderWidth: 1.5,
    borderStyle: "dashed", borderColor: Colores.loginFieldStroke, backgroundColor: Colores.white,
  },
  cajaLista: { borderStyle: "solid", borderColor: Colores.successGreen },
  cajaError: { borderColor: Colores.dangerRed },
  icono: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  textos: { flex: 1, minWidth: 0 },
});
