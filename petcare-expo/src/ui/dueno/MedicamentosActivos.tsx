/*
 * Medicamentos activos, en el Inicio del dueño: cada medicamento recetado con plan de tomas (cada N horas durante N
 * días). Arranca "sin empezar" hasta que el dueño marca la primera dosis; desde ahí se arma el plan y la grilla con
 * todas las tomas, que se tildan a medida que se dan (si se tilda una atrasada, se pregunta a qué hora se dio). El
 * veterinario ve la misma grilla en la consulta.
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { DuenoRepo, type Tratamiento } from "../../data/repositorio/duenoRepo";
import { posologia, TEXTO_COMIDA } from "../../model/clinica";
import { claveDeToma } from "../../model/tomas";
import { Errores } from "../../util/errores";
import { LocalDateTime } from "../../util/tiempo";
import { SelectorHoraLibre } from "../auth/SelectorHoraLibre";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Chip, type TonoChip } from "../common/Chip";
import { GrillaTomas, type EstadoToma } from "../common/GrillaTomas";
import { HojaInferior } from "../common/HojaInferior";
import { Icono } from "../common/Icono";
import { Tarjeta } from "../common/Tarjeta";
import { Colores } from "../common/tema";
import { Texto } from "../common/Texto";
import { useDatos } from "../common/useDatos";

const ESTADO: Record<Tratamiento["estado"], { texto: string; tono: TonoChip }> = {
  sin_empezar: { texto: "Sin empezar", tono: "aviso" },
  en_curso: { texto: "En curso", tono: "info" },
  terminado: { texto: "Terminado", tono: "ok" },
  suspendido: { texto: "Suspendido", tono: "peligro" },
};

/** "Faltan 3 días" / "Termina hoy". */
function textoQueda(t: Tratamiento, ahora: LocalDateTime): string | null {
  if (t.estado !== "en_curso") return null;
  const ultima = t.momentos[t.momentos.length - 1];
  const dias = ultima.toLocalDate().toEpochDay() - ahora.toLocalDate().toEpochDay();
  return dias <= 0 ? "Termina hoy" : dias === 1 ? "Termina mañana" : `Faltan ${dias} días`;
}

/** Cuándo le dio la primera dosis: ahora o más temprano (hoy). */
function HojaPrimeraDosis({ t, alCerrar }: { t: Tratamiento; alCerrar: () => void }) {
  const [eligiendo, setEligiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const empezar = async (hora: LocalDateTime) => {
    setGuardando(true);
    try {
      await DuenoRepo.empezarTratamiento(t.receta, hora);
      Avisos.mostrar(`Listo: te avisamos cuando toque la próxima toma de ${t.receta.medicamento}`, "exito");
      alCerrar();
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
      setGuardando(false);
    }
  };
  const ahora = LocalDateTime.now();
  return (
    <HojaInferior visible alCerrar={guardando ? () => {} : alCerrar}>
      <Texto tamano={20} negrita accessibilityRole="header">{`Primera dosis de ${t.receta.medicamento}`}</Texto>
      <Texto variante="chico" tamano={13} style={{ marginTop: 4 }}>
        {`¿Cuándo se la diste a ${t.mascota.nombre}? Desde esa hora armamos las próximas tomas y te avisamos de cada una.`}
      </Texto>
      <Boton titulo={`Ahora (${ahora.horaTexto()})`} alto={50} estilo={{ marginTop: 16 }} cargando={guardando} onPress={() => void empezar(ahora)} />
      <Boton titulo="Más temprano: elegir la hora" variante="secundario" alto={50} estilo={{ marginTop: 8 }} deshabilitado={guardando} onPress={() => setEligiendo(true)} />
      <Boton titulo="Todavía no se la di" variante="texto" alto={46} estilo={{ marginTop: 4 }} deshabilitado={guardando} onPress={alCerrar} />
      <SelectorHoraLibre
        visible={eligiendo} valor={ahora.horaTexto()} titulo="¿A qué hora se la diste?"
        alCerrar={() => setEligiendo(false)}
        alElegir={(h) => {
          const [hh, mm] = h.split(":").map(Number);
          const hora = LocalDateTime.ofDate(ahora.toLocalDate(), hh, mm, 0);
          setEligiendo(false);
          if (hora.isAfter(ahora)) {
            Avisos.aviso("Esa hora todavía no pasó. Si se la vas a dar más tarde, marcala cuando se la des.");
            return;
          }
          void empezar(hora);
        }}
      />
    </HojaInferior>
  );
}

/** Una toma atrasada: ¿se la dio a horario (y se olvidó de tildar) o recién ahora? */
function HojaTomaAtrasada({ t, momento, alCerrar }: { t: Tratamiento; momento: LocalDateTime; alCerrar: () => void }) {
  const marcar = (cuando: Date) => {
    DuenoRepo.marcarToma({ clave: claveDeToma(momento), receta: t.receta, mascota: t.mascota, momento, dada: false }, true, cuando);
    alCerrar();
  };
  const ahora = LocalDateTime.now();
  const aHorario = new Date(momento.year, momento.monthValue - 1, momento.dayOfMonth, momento.hour, momento.minute);
  return (
    <HojaInferior visible alCerrar={alCerrar}>
      <Texto tamano={20} negrita accessibilityRole="header">{`Toma de las ${momento.horaTexto()}`}</Texto>
      <Texto variante="chico" tamano={13} style={{ marginTop: 4 }}>
        ¿Se la diste a horario o recién ahora? Así el veterinario sabe cómo vino el tratamiento.
      </Texto>
      <Boton titulo={`A horario (${momento.horaTexto()})`} alto={50} estilo={{ marginTop: 16 }} onPress={() => marcar(aHorario)} />
      <Boton titulo={`Recién ahora (${ahora.horaTexto()})`} variante="secundario" alto={50} estilo={{ marginTop: 8 }} onPress={() => marcar(new Date())} />
      <Boton titulo="Cancelar" variante="texto" alto={46} estilo={{ marginTop: 4 }} onPress={alCerrar} />
    </HojaInferior>
  );
}

function TarjetaTratamiento({ t, ahora }: { t: Tratamiento; ahora: LocalDateTime }) {
  const [primera, setPrimera] = useState(false);
  const [atrasada, setAtrasada] = useState<LocalDateTime | null>(null);
  const estado = ESTADO[t.estado];
  const queda = textoQueda(t, ahora);
  const c = t.cumplimiento;
  const tocar = (momento: LocalDateTime, e: EstadoToma) => {
    const toma = { clave: claveDeToma(momento), receta: t.receta, mascota: t.mascota, momento, dada: e === "dada" };
    if (e === "dada") DuenoRepo.marcarToma(toma, false);
    else if (e === "atrasada") setAtrasada(momento);
    else DuenoRepo.marcarToma(toma, true);
  };
  return (
    <Tarjeta relleno={14} estilo={estilos.tarjeta} accessibilityLabel={`${t.receta.medicamento} para ${t.mascota.nombre}`}>
      <View style={estilos.cabecera}>
        <View style={estilos.icono}><Icono nombre="vacuna" tamano={22} color={Colores.primaryTeal} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Texto tamano={16} negrita>{t.receta.dosis.trim() ? `${t.receta.medicamento} ${t.receta.dosis}` : t.receta.medicamento}</Texto>
          <Texto variante="chico" tamano={12.5}>{`${t.mascota.nombre} · ${posologia(t.receta)}`}</Texto>
        </View>
        <Chip texto={estado.texto} tono={estado.tono} />
      </View>
      {t.receta.conComida ? (
        <View style={estilos.comida}>
          <Icono nombre="info" tamano={16} color={Colores.accentOrangeDark} />
          <Texto tamano={13.5} negrita color={Colores.accentOrangeDark}>{TEXTO_COMIDA[t.receta.conComida]}</Texto>
        </View>
      ) : null}
      {t.receta.indicaciones.trim() ? <Texto variante="chico" tamano={13} style={{ marginTop: 6 }}>{t.receta.indicaciones}</Texto> : null}

      {t.estado === "sin_empezar" ? (
        <>
          <Texto variante="chico" tamano={13} style={{ marginTop: 10 }}>
            {`Son ${c.total} ${c.total === 1 ? "toma" : "tomas"}. Cuando le des la primera dosis, marcala y armamos el resto con avisos.`}
          </Texto>
          <Boton titulo="Ya le di la primera dosis" icono="check" alto={48} estilo={{ marginTop: 10 }} onPress={() => setPrimera(true)} />
        </>
      ) : (
        <>
          <Texto variante="chico" tamano={13} style={{ marginTop: 10 }}>
            {[`${c.dadas} de ${c.debidas} tomas dadas hasta ahora (${c.total} en total)`, queda].filter(Boolean).join(" · ")}
          </Texto>
          {t.estado === "suspendido" ? (
            <Texto variante="chico" tamano={13} color={Colores.dangerRed} style={{ marginTop: 4 }}>
              {`El veterinario suspendió el tratamiento${t.receta.motivoSuspension ? `: ${t.receta.motivoSuspension}` : "."}`}
            </Texto>
          ) : null}
          <GrillaTomas
            momentos={t.momentos} dadas={t.dadas} ahora={ahora}
            alTocar={t.estado === "en_curso" ? tocar : undefined}
          />
        </>
      )}
      {primera ? <HojaPrimeraDosis t={t} alCerrar={() => setPrimera(false)} /> : null}
      {atrasada ? <HojaTomaAtrasada t={t} momento={atrasada} alCerrar={() => setAtrasada(null)} /> : null}
    </Tarjeta>
  );
}

export function MedicamentosActivos() {
  useDatos();
  const ahora = LocalDateTime.now();
  const lista = DuenoRepo.tratamientos(3, ahora);
  if (lista.length === 0) return null;
  return (
    <View style={{ marginTop: 16 }}>
      <Texto variante="titulo" tamano={18} accessibilityRole="header">Medicamentos activos</Texto>
      <Texto variante="chico" tamano={13} style={{ marginTop: 2 }}>Tocá cada toma cuando se la des. Te avisamos a la hora de cada una.</Texto>
      {lista.map((t) => <TarjetaTratamiento key={t.receta.id} t={t} ahora={ahora} />)}
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { marginTop: 10 },
  cabecera: { flexDirection: "row", alignItems: "center", gap: 10 },
  icono: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
  comida: {
    flexDirection: "row", alignItems: "center", gap: 6, marginTop: 10, alignSelf: "flex-start", paddingHorizontal: 10,
    paddingVertical: 6, borderRadius: 10, backgroundColor: Colores.lightOrange,
  },
});
