/*
 * Remedios de hoy, en el Inicio: cada toma de las recetas en curso con su hora; se tilda al darla y queda guardada
 * (con quién y cuándo) para el historial que ve el veterinario.
 */
import { Pressable, StyleSheet, View } from "react-native";
import { DuenoRepo, type TomaDelDia } from "../../data/repositorio/duenoRepo";
import { posologia } from "../../model/clinica";
import { LocalDateTime } from "../../util/tiempo";
import { Icono } from "../common/Icono";
import { Tarjeta } from "../common/Tarjeta";
import { Colores } from "../common/tema";
import { Texto } from "../common/Texto";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { Servicios } from "../../data/servicios";

function FilaToma({ toma, ahora }: { toma: TomaDelDia; ahora: LocalDateTime }) {
  const foco = useFoco();
  const atrasada = !toma.dada && toma.momento.isBefore(ahora);
  const detalle = toma.receta.dosis.trim() ? `${toma.receta.medicamento} ${toma.receta.dosis}` : toma.receta.medicamento;
  const estado = toma.dada ? "Dada" : atrasada ? "Pendiente" : "Más tarde";
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: toma.dada }}
      accessibilityLabel={`${toma.momento.horaTexto()}, ${detalle} para ${toma.mascota.nombre}`}
      accessibilityHint={toma.dada ? "Desmarca la toma" : "Marca que ya se la diste"}
      onPress={() => {
        DuenoRepo.marcarToma(toma, !toma.dada);
        Servicios.avisarCambio();
      }}
      {...foco.props}
      style={({ pressed }) => [estilos.fila, pressed ? estilos.filaPresionada : null, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <View style={[estilos.casilla, toma.dada ? estilos.casillaDada : atrasada ? estilos.casillaAtrasada : null]}>
        {toma.dada ? <Icono nombre="check" tamano={18} color={Colores.white} /> : null}
      </View>
      <Texto tamano={15} negrita color={toma.dada ? Colores.textGray : Colores.brandNavy} style={estilos.hora}>
        {toma.momento.horaTexto()}
      </Texto>
      <View style={estilos.textos}>
        <Texto tamano={14.5} negrita numberOfLines={1} color={toma.dada ? Colores.textGray : Colores.brandNavy}>{detalle}</Texto>
        <Texto variante="chico" tamano={12.5} numberOfLines={1}>{toma.mascota.nombre}</Texto>
      </View>
      <Texto
        tamano={12} negrita
        color={toma.dada ? Colores.successGreen : atrasada ? Colores.accentOrangeDark : Colores.textGray}
      >
        {estado}
      </Texto>
    </Pressable>
  );
}

/** La tarjeta; no se dibuja si hoy no hay tomas. */
export function RemediosDeHoy() {
  const tomas = DuenoRepo.tomasDelDia();
  if (tomas.length === 0) return null;
  const ahora = LocalDateTime.now();
  const dadas = tomas.filter((t) => t.dada).length;
  const recetas = new Set(tomas.map((t) => t.receta.id)).size;
  const primera = tomas[0].receta;
  return (
    <Tarjeta relleno={16} estilo={estilos.tarjeta}>
      <View style={estilos.cabecera}>
        <View style={estilos.icono}>
          <Icono nombre="medicamento" tamano={22} color={Colores.accentPurple} />
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Texto tamano={17} negrita accessibilityRole="header">Remedios de hoy</Texto>
          <Texto variante="chico" tamano={13}>
            {dadas === tomas.length
              ? "Ya diste todas las tomas de hoy"
              : `${dadas} de ${tomas.length} ${tomas.length === 1 ? "toma dada" : "tomas dadas"}. Tocá cada una cuando se la des.`}
          </Texto>
        </View>
      </View>
      {recetas === 1 && posologia(primera).trim() ? (
        <Texto variante="chico" tamano={12.5} style={estilos.posologia}>{`${primera.medicamento}: ${posologia(primera)}`}</Texto>
      ) : null}
      <View style={{ marginTop: 6 }}>
        {tomas.map((t) => <FilaToma key={`${t.receta.id}-${t.clave}`} toma={t} ahora={ahora} />)}
      </View>
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { marginTop: 16 },
  cabecera: { flexDirection: "row", alignItems: "center" },
  icono: { width: 42, height: 42, borderRadius: 14, backgroundColor: Colores.lightPurple, alignItems: "center", justifyContent: "center" },
  posologia: { marginTop: 8 },
  fila: { flexDirection: "row", alignItems: "center", minHeight: 52, paddingVertical: 6, paddingHorizontal: 4, borderRadius: 12 },
  filaPresionada: { backgroundColor: Colores.lightGray },
  casilla: {
    width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: Colores.loginFieldStroke,
    alignItems: "center", justifyContent: "center",
  },
  casillaDada: { backgroundColor: Colores.successGreen, borderColor: Colores.successGreen },
  casillaAtrasada: { borderColor: Colores.accentOrange },
  hora: { width: 54, marginLeft: 12 },
  textos: { flex: 1, minWidth: 0, marginRight: 8 },
});
