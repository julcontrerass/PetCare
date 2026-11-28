/*
 * Migrado de ui/veterinario/EditorSede.kt + sheet_sede_vet.xml: hoja para cargar o editar una veterinaria donde atiende
 * el veterinario (nombre, dirección, días, horario y pausa propios, y qué atiende ahí: todo lo que ofrece o solo una parte). La usa el perfil. A diferencia de `EditorSedeRegistro`
 * (el del registro), acá `alEliminar` recibe la función que cierra la hoja: quien llama decide si se puede borrar y
 * cuándo se cierra (por ejemplo, si el lugar tiene turnos pendientes la hoja queda abierta).
 */
import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { PerfilVetRepo } from "../../data/repositorio/perfilVetRepo";
import { crearSede, textoHorarioSede, textoServiciosSede, type SedeVet } from "../../model/modelos";
import { ChipRegistro, GrupoChips } from "../auth/ChipRegistro";
import { SelectorHoraLibre } from "../auth/SelectorHoraLibre";
import type { EntradaTexto } from "../auth/tipos";
import { Boton } from "../common/Boton";
import { Campo } from "../common/Campo";
import { HojaInferior } from "../common/HojaInferior";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";

/** Dirección y, debajo, los días y el horario (y si ahí atiende solo una parte); el texto de las listas. */
export function detalleSede(sede: SedeVet): string {
  return [sede.direccion, textoHorarioSede(sede), textoServiciosSede(sede)].filter((s) => s.trim() !== "").join("\n");
}

function CampoHora({ etiqueta, valor, onPress }: { etiqueta: string; valor: string; onPress: () => void }) {
  const foco = useFoco();
  return (
    <View style={{ flex: 1 }}>
      <Texto variante="etiqueta" style={estilos.etiqueta}>{etiqueta}</Texto>
      <Pressable
        accessibilityRole="button" accessibilityLabel={`${etiqueta}: ${valor} hs`} onPress={onPress} {...foco.props}
        style={[estilos.hora, cursorTocable, estiloFoco(foco.enfocado)]}
      >
        <Texto variante="cuerpo">{`${valor} hs`}</Texto>
      </Pressable>
    </View>
  );
}

export interface EditorSedeProps {
  /** El lugar que se edita; null para uno nuevo. */
  sede: SedeVet | null;
  /** Recibe el lugar ya validado; la hoja se cierra sola después. */
  alGuardar: (sede: SedeVet) => void;
  /** Si se da, se ofrece "Eliminar este lugar"; recibe la función que cierra la hoja. */
  alEliminar?: (cerrar: () => void) => void;
  alCerrar: () => void;
}

export function EditorSede({ sede, alGuardar, alEliminar, alCerrar }: EditorSedeProps) {
  const [nombre, setNombre] = useState(sede?.nombre ?? "");
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const [direccion, setDireccion] = useState(sede?.direccion ?? "");
  const [apertura, setApertura] = useState(sede?.apertura ?? "09:00");
  const [cierre, setCierre] = useState(sede?.cierre ?? "18:00");
  const [dias, setDias] = useState<number[]>(sede?.dias ?? [1, 2, 3, 4, 5]);
  const [conPausa, setConPausa] = useState(!!sede?.pausaDesde);
  const [pausaDesde, setPausaDesde] = useState(sede?.pausaDesde ?? "13:00");
  const [pausaHasta, setPausaHasta] = useState(sede?.pausaHasta ?? "14:00");
  const ofrecidos = PerfilVetRepo.serviciosOfrecidos();
  const [soloAlgunos, setSoloAlgunos] = useState(!!sede?.servicios);
  const [servicios, setServicios] = useState<string[]>(sede?.servicios ?? []);
  const [eligiendo, setEligiendo] = useState<"apertura" | "cierre" | "pausaDesde" | "pausaHasta" | null>(null);
  const refNombre = useRef<EntradaTexto>(null);

  /** Lo que se ve debajo de los horarios: cómo queda el lugar o, si falta algo, qué es. */
  const problema = (): string | null => {
    if (dias.length === 0) return "Elegí al menos un día de atención.";
    if (cierre <= apertura) return "El horario de cierre tiene que ser posterior al de apertura.";
    if (conPausa && pausaHasta <= pausaDesde) return "El final de la pausa tiene que ser posterior al comienzo.";
    if (conPausa && (pausaDesde < apertura || pausaHasta > cierre)) return `La pausa tiene que estar dentro del horario (${apertura} a ${cierre} hs).`;
    if (soloAlgunos && servicios.length === 0) return "Elegí al menos un servicio para este lugar.";
    return null;
  };
  const error = problema();
  const pausa = conPausa ? { pausaDesde, pausaHasta } : { pausaDesde: null, pausaHasta: null };
  const lista = soloAlgunos ? ofrecidos.filter((o) => servicios.includes(o)) : null;
  const deEsteLugar = { ...pausa, servicios: lista && lista.length > 0 ? lista : null };
  const resumen = error ?? "Atiende " + textoHorarioSede(crearSede({ id: "", nombre: "", dias, apertura, cierre, ...deEsteLugar }));

  const alternarDia = (d: number, marcado: boolean) =>
    setDias((a) => (marcado ? [...new Set([...a, d])] : a.filter((x) => x !== d)));

  const guardar = () => {
    const nuevo = crearSede({ id: sede?.id ?? "", nombre: nombre.trim(), direccion: direccion.trim(), dias: [...dias].sort((a, b) => a - b), apertura, cierre, ...deEsteLugar });
    if (nuevo.nombre.trim() === "") {
      setErrorNombre("Ingresá el nombre de la veterinaria");
      refNombre.current?.focus();
      return;
    }
    if (problema() != null) return;
    alGuardar(nuevo);
    alCerrar();
  };

  return (
    <HojaInferior visible alCerrar={alCerrar}>
      <Texto variante="titulo" tamano={20} accessibilityRole="header">{sede ? "Editar veterinaria" : "Agregar otra veterinaria"}</Texto>
      <Texto variante="subtitulo" tamano={13}>Cada lugar tiene su dirección, sus días y sus horarios.</Texto>
      <Campo
        ref={refNombre} estilo={estilos.campo} etiqueta="Nombre de la veterinaria" placeholder="Ej: Veterinaria Central" value={nombre}
        onChangeText={(t) => { setNombre(t); setErrorNombre(null); }} error={errorNombre} autoCapitalize="words"
      />
      <Campo estilo={estilos.campo} etiqueta="Dirección" placeholder="Calle, número y ciudad" value={direccion} onChangeText={setDireccion} autoCapitalize="words" />

      <Texto variante="etiqueta" style={estilos.etiqueta}>Días de atención</Texto>
      <GrupoChips espacioVertical={4}>
        {PerfilVetRepo.todosLosDias.map((dia, i) => (
          <ChipRegistro key={dia} texto={dia.slice(0, 3)} marcado={dias.includes(i + 1)} alCambiar={(m) => alternarDia(i + 1, m)} />
        ))}
      </GrupoChips>
      <View style={estilos.presets}>
        <Pressable accessibilityRole="button" onPress={() => setDias([1, 2, 3, 4, 5])} style={[estilos.preset, cursorTocable]}>
          <Texto variante="etiqueta" tamano={13} color={Colores.primaryTeal}>Lunes a viernes</Texto>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => setDias([1, 2, 3, 4, 5, 6])} style={[estilos.preset, cursorTocable]}>
          <Texto variante="etiqueta" tamano={13} color={Colores.primaryTeal}>Lunes a sábado</Texto>
        </Pressable>
      </View>
      <View style={estilos.horas}>
        <CampoHora etiqueta="Desde" valor={apertura} onPress={() => setEligiendo("apertura")} />
        <CampoHora etiqueta="Hasta" valor={cierre} onPress={() => setEligiendo("cierre")} />
      </View>

      <Texto variante="etiqueta" style={estilos.etiqueta}>Pausa</Texto>
      <GrupoChips espacioVertical={4}>
        <ChipRegistro texto="Sin pausa" marcado={!conPausa} alCambiar={() => setConPausa(false)} />
        <ChipRegistro texto="Pausa todos los días" marcado={conPausa} alCambiar={() => setConPausa(true)} />
      </GrupoChips>
      {conPausa ? (
        <View style={[estilos.horas, { marginTop: 4 }]}>
          <CampoHora etiqueta="Pausa desde" valor={pausaDesde} onPress={() => setEligiendo("pausaDesde")} />
          <CampoHora etiqueta="Pausa hasta" valor={pausaHasta} onPress={() => setEligiendo("pausaHasta")} />
        </View>
      ) : null}
      {ofrecidos.length > 1 ? (
        <>
          <Texto variante="etiqueta" style={estilos.etiqueta}>Qué atendés acá</Texto>
          <GrupoChips espacioVertical={4}>
            <ChipRegistro texto="Todo lo que ofrecés" marcado={!soloAlgunos} alCambiar={() => setSoloAlgunos(false)} />
            <ChipRegistro texto="Solo algunos" marcado={soloAlgunos} alCambiar={() => setSoloAlgunos(true)} />
          </GrupoChips>
          {soloAlgunos ? (
            <>
              <Texto variante="chico" tamano={12.5} style={{ marginTop: 6 }}>
                Los dueños solo van a poder sacar acá turnos de lo que marques. Las consultas y controles generales valen en todos lados.
              </Texto>
              <GrupoChips espacioVertical={4}>
                {ofrecidos.map((o) => (
                  <ChipRegistro
                    key={o} texto={o} marcado={servicios.includes(o)}
                    alCambiar={(m) => setServicios((a) => (m ? [...new Set([...a, o])] : a.filter((x) => x !== o)))}
                  />
                ))}
              </GrupoChips>
            </>
          ) : null}
        </>
      ) : null}
      <Texto variante="cuerpo" tamano={13.5} color={error == null ? Colores.tealDark : Colores.dangerRed} style={estilos.resumen}>{resumen}</Texto>

      <Boton titulo="Guardar" alto={50} estilo={{ marginTop: 18 }} onPress={guardar} />
      <Boton titulo="Cancelar" variante="secundario" alto={50} estilo={{ marginTop: 8 }} onPress={alCerrar} />
      {alEliminar ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Eliminar este lugar" onPress={() => alEliminar(alCerrar)} style={[estilos.eliminar, cursorTocable]}>
          <Texto variante="boton" color={Colores.dangerRed}>Eliminar este lugar</Texto>
        </Pressable>
      ) : null}
      <SelectorHoraLibre
        visible={eligiendo != null}
        valor={eligiendo === "cierre" ? cierre : eligiendo === "pausaDesde" ? pausaDesde : eligiendo === "pausaHasta" ? pausaHasta : apertura}
        titulo={TITULO_HORA[eligiendo ?? "apertura"]}
        alElegir={(h) => ({ apertura: setApertura, cierre: setCierre, pausaDesde: setPausaDesde, pausaHasta: setPausaHasta })[eligiendo ?? "apertura"](h)}
        alCerrar={() => setEligiendo(null)}
      />
    </HojaInferior>
  );
}

const TITULO_HORA = {
  apertura: "Hora de apertura", cierre: "Hora de cierre", pausaDesde: "Comienzo de la pausa", pausaHasta: "Fin de la pausa",
} as const;

export default EditorSede;

const estilos = StyleSheet.create({
  campo: { marginTop: 14 },
  etiqueta: { marginTop: 14, marginBottom: 6 },
  presets: { flexDirection: "row", marginTop: 4, gap: 10 },
  preset: { padding: 6, minHeight: 36, justifyContent: "center" },
  horas: { flexDirection: "row", gap: 12 },
  hora: { minHeight: 50, justifyContent: "center", paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: Colores.loginFieldStroke, backgroundColor: Colores.white },
  eliminar: { height: 50, alignItems: "center", justifyContent: "center", marginTop: 4 },
  resumen: { marginTop: 16, backgroundColor: "#E3F3F1", borderRadius: 16, padding: 14 },
});
