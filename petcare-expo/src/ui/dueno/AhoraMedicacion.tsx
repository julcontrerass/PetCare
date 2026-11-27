/*
 * "Es hora", arriba de todo en el Inicio del dueño: solo aparece cuando corresponde hacer algo con la medicación.
 *  - una toma de hoy que ya toca (desde 15 minutos antes) o que quedó atrasada sin tildar: "Ya se la di" la marca;
 *    si pasó más de MINUTOS_ATRASO, pregunta si fue a horario o recién ahora (lo mismo que la grilla);
 *  - un tratamiento recién recetado que todavía no empezó: "Le di la primera dosis" arma el plan de tomas.
 * Se vuelve a calcular cada minuto, así la toma aparece sola cuando llega la hora y se va al marcarla.
 */
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { DuenoRepo, type TomaDelDia, type Tratamiento } from "../../data/repositorio/duenoRepo";
import { TEXTO_COMIDA } from "../../model/clinica";
import { MINUTOS_ATRASO } from "../../model/tomas";
import { LocalDate, LocalDateTime } from "../../util/tiempo";
import { Boton } from "../common/Boton";
import { Icono } from "../common/Icono";
import { Tarjeta } from "../common/Tarjeta";
import { Colores } from "../common/tema";
import { Texto } from "../common/Texto";
import { Servicios } from "../../data/servicios";
import { HojaPrimeraDosis, HojaTomaAtrasada } from "./MedicamentosActivos";

/** Minutos antes de la hora desde los que la toma ya aparece. */
export const MINUTOS_ANTES = 15;
/** Un tratamiento sin empezar se recuerda durante estos días desde que se recetó. */
const DIAS_PARA_EMPEZAR = 7;
const REFRESCO_MS = 60_000;

/** Las tomas de hoy que ya tocan (o están atrasadas) y no se dieron, la más vieja primero. */
export function tomasQueTocan(ahora: LocalDateTime = LocalDateTime.now()): TomaDelDia[] {
  const limite = ahora.plusMinutes(MINUTOS_ANTES);
  return DuenoRepo.tomasDelDia(ahora.toLocalDate()).filter((t) => !t.dada && !t.momento.isAfter(limite));
}

/** Tratamientos recetados hace poco que esperan la primera dosis. */
export function tratamientosParaEmpezar(ahora: LocalDateTime = LocalDateTime.now()): Tratamiento[] {
  const desde: LocalDate = ahora.toLocalDate().minusDays(DIAS_PARA_EMPEZAR);
  return DuenoRepo.tratamientos(0, ahora).filter((t) => t.estado === "sin_empezar" && !t.receta.inicio.isBefore(desde));
}

function nombreConDosis(t: { receta: { medicamento: string; dosis: string } }): string {
  return t.receta.dosis.trim() ? `${t.receta.medicamento} ${t.receta.dosis}` : t.receta.medicamento;
}

function FilaToma({ toma, ahora, alAtrasada }: { toma: TomaDelDia; ahora: LocalDateTime; alAtrasada: (t: TomaDelDia) => void }) {
  const minutos = toma.momento.minutosHasta(ahora);
  const atrasada = minutos > MINUTOS_ATRASO;
  const cuando = minutos < 0 ? `A las ${toma.momento.horaTexto()}` : atrasada ? `Era a las ${toma.momento.horaTexto()}` : `${toma.momento.horaTexto()} · ahora`;
  return (
    <View style={estilos.item} accessibilityLabel={`${nombreConDosis(toma)} para ${toma.mascota.nombre}, ${cuando}`}>
      <Texto tamano={16} negrita>{`${nombreConDosis(toma)} para ${toma.mascota.nombre}`}</Texto>
      <Texto variante="chico" tamano={13} color={atrasada ? Colores.accentOrangeDark : Colores.textGray}>{cuando}</Texto>
      {toma.receta.conComida ? (
        <View style={estilos.comida}>
          <Icono nombre="info" tamano={15} color={Colores.accentOrangeDark} />
          <Texto tamano={13} negrita color={Colores.accentOrangeDark}>{TEXTO_COMIDA[toma.receta.conComida]}</Texto>
        </View>
      ) : null}
      <Boton
        titulo="Ya se la di" icono="check" alto={46} estilo={{ marginTop: 10 }}
        onPress={() => {
          if (atrasada) {
            alAtrasada(toma);
            return;
          }
          DuenoRepo.marcarToma(toma, true);
          Servicios.avisarCambio();
        }}
      />
    </View>
  );
}

export function AhoraMedicacion() {
  const [, redibujar] = useState(0);
  const [atrasada, setAtrasada] = useState<TomaDelDia | null>(null);
  const [empezar, setEmpezar] = useState<Tratamiento | null>(null);
  useEffect(() => {
    const t = setInterval(() => redibujar((n) => n + 1), REFRESCO_MS);
    return () => clearInterval(t);
  }, []);

  const ahora = LocalDateTime.now();
  const tomas = tomasQueTocan(ahora);
  const nuevos = tratamientosParaEmpezar(ahora);
  const hojas = (
    <>
      {atrasada ? (
        <HojaTomaAtrasada
          t={tratamientoDe(atrasada)} momento={atrasada.momento}
          alCerrar={() => {
            setAtrasada(null);
            Servicios.avisarCambio();
          }}
        />
      ) : null}
      {empezar ? <HojaPrimeraDosis t={empezar} alCerrar={() => setEmpezar(null)} /> : null}
    </>
  );
  if (tomas.length === 0 && nuevos.length === 0) return hojas;

  const titulo = tomas.length > 0 ? (tomas.length === 1 ? "Es hora de un remedio" : `Es hora de ${tomas.length} remedios`) : "Empezá el tratamiento";
  return (
    <Tarjeta relleno={16} estilo={estilos.tarjeta} accessibilityLabel={titulo}>
      <View style={estilos.cabecera}>
        <View style={estilos.icono}><Icono nombre="medicamento" tamano={22} color={Colores.white} /></View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Texto tamano={18} negrita accessibilityRole="header">{titulo}</Texto>
          <Texto variante="chico" tamano={13}>Marcalo cuando se lo des: así el veterinario ve cómo viene el tratamiento.</Texto>
        </View>
      </View>
      {tomas.map((t) => <FilaToma key={`${t.receta.id}-${t.clave}`} toma={t} ahora={ahora} alAtrasada={setAtrasada} />)}
      {nuevos.map((t) => (
        <View key={t.receta.id} style={estilos.item} accessibilityLabel={`Empezar ${nombreConDosis(t)} para ${t.mascota.nombre}`}>
          <Texto tamano={16} negrita>{`${nombreConDosis(t)} para ${t.mascota.nombre}`}</Texto>
          <Texto variante="chico" tamano={13}>Recetado nuevo: cuando le des la primera dosis, marcala y te avisamos de las próximas.</Texto>
          <Boton titulo="Le di la primera dosis" icono="check" variante="secundario" alto={46} estilo={{ marginTop: 10 }} onPress={() => setEmpezar(t)} />
        </View>
      ))}
      {hojas}
    </Tarjeta>
  );
}

/** El tratamiento de una toma (lo que pide la hoja de la toma atrasada). */
function tratamientoDe(toma: TomaDelDia): Tratamiento {
  return DuenoRepo.tratamientos().find((t) => t.receta.id === toma.receta.id)
    ?? { receta: toma.receta, mascota: toma.mascota, estado: "en_curso", momentos: [], dadas: new Set(), cumplimiento: { dadas: 0, debidas: 0, total: 0 } };
}

const estilos = StyleSheet.create({
  tarjeta: { marginTop: 16, backgroundColor: Colores.lightPurple, borderColor: Colores.accentPurple, borderWidth: 1.5 },
  cabecera: { flexDirection: "row", alignItems: "center" },
  icono: { width: 42, height: 42, borderRadius: 14, backgroundColor: Colores.accentPurple, alignItems: "center", justifyContent: "center" },
  item: { marginTop: 12, padding: 12, borderRadius: 14, backgroundColor: Colores.white },
  comida: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
});
