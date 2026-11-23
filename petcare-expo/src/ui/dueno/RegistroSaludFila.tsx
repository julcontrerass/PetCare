/*
 * Migrado de RegistrosAdapter (CarnetSaludActivity.kt) + item_registro_salud.xml: una fila del carnet de salud.
 * Tocar abre el archivo (si tiene); mantener apretado (o la papelera) elimina el registro.
 */
import { Pressable, StyleSheet, View } from "react-native";
import type { RegistroSalud, TipoRegistro } from "../../data/repositorio/saludRepo";
import { Chip, type TonoChip } from "../common/Chip";
import { Icono, type NombreIcono } from "../common/Icono";
import { Texto } from "../common/Texto";
import { Colores, sombra } from "../common/tema";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";

/** Ícono del tipo de registro (también el del estado vacío). */
export const ICONO_TIPO_REGISTRO: Record<TipoRegistro, NombreIcono> = {
  VACUNA: "vacuna",
  DESPARASITACION: "botiquin",
  TRATAMIENTO: "pulso",
  CIRUGIA: "cirugia",
  DOCUMENTO: "documento",
};

const ESTILO_TIPO: Record<TipoRegistro, { fondo: string; color: string }> = {
  VACUNA: { fondo: Colores.lightGreen, color: Colores.successGreen },
  DESPARASITACION: { fondo: Colores.lightOrange, color: Colores.accentOrange },
  CIRUGIA: { fondo: Colores.lightPurple, color: Colores.accentPurple },
  TRATAMIENTO: { fondo: Colores.lightPurple, color: Colores.accentPurple },
  DOCUMENTO: { fondo: Colores.lightOrange, color: Colores.accentOrange },
};

/** Tono del chip de estado: Vencida rojo, Próxima naranja, Finalizado gris y el resto verde. */
export function tonoDeEstado(estado: string): TonoChip {
  switch (estado) {
    case "Vencida": return "peligro";
    case "Próxima": return "aviso";
    case "Finalizado": return "neutro";
    default: return "ok";
  }
}

export interface RegistroSaludFilaProps {
  registro: RegistroSalud;
  alTocar: (r: RegistroSalud) => void;
  alMantener: (r: RegistroSalud) => void;
}

export function RegistroSaludFila({ registro: r, alTocar, alMantener }: RegistroSaludFilaProps) {
  const foco = useFoco();
  const e = ESTILO_TIPO[r.tipo];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${r.titulo}, ${r.mascota}`}
      onPress={() => {
        if (r.archivoPath != null) alTocar(r);
      }}
      onLongPress={() => alMantener(r)}
      {...foco.props}
      style={[estilos.fila, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <View style={[estilos.icono, { backgroundColor: e.fondo }]}>
        <Icono nombre={ICONO_TIPO_REGISTRO[r.tipo]} tamano={22} color={e.color} />
      </View>
      <View style={estilos.textos}>
        <View style={estilos.titulo}>
          <Texto variante="titulo" tamano={16} style={{ flex: 1 }}>{r.titulo}</Texto>
          {r.estado != null ? <Chip texto={r.estado} tono={tonoDeEstado(r.estado)} estilo={{ marginLeft: 8 }} /> : null}
        </View>
        <Texto variante="etiqueta" tamano={13.5} color={Colores.tealDark} style={{ marginTop: 2 }}>{`${r.mascota} · ${r.fecha}`}</Texto>
        <Texto variante="chico" tamano={13} style={{ marginTop: 2 }}>{r.detalle}</Texto>
      </View>
      <Pressable
        accessibilityRole="button" accessibilityLabel={`Eliminar ${r.titulo}`} hitSlop={8}
        onPress={() => alMantener(r)} style={[estilos.borrar, cursorTocable]}
      >
        <Icono nombre="borrar" tamano={20} color={Colores.textGray} />
      </Pressable>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  fila: {
    flexDirection: "row", alignItems: "center", marginTop: 10, marginBottom: 2, padding: 14, borderRadius: 18,
    backgroundColor: Colores.white, ...sombra(1),
  },
  icono: { width: 46, height: 46, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  textos: { flex: 1, marginLeft: 14, minWidth: 0 },
  titulo: { flexDirection: "row", alignItems: "center" },
  borrar: { marginLeft: 6, padding: 6 },
});
