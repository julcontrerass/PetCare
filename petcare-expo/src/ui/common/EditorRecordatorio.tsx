/*
 * Migrado de ui/common/EditorRecordatorio.kt: formulario para crear o editar un recordatorio, el mismo para el dueño y
 * para el veterinario.
 *
 * Desvíos: el `AlertDialog` es un `DialogoCentral`; los `Spinner` de mascota y tipo son chips; el `DatePickerDialog` es
 * el `SelectorFecha` del kit y el `TimePickerDialog` un cuadro con hora y minutos (con "Sin hora"); el aviso de fecha
 * anterior a hoy se ve dentro del formulario (un banner quedaría detrás del modal).
 */
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { RecordatoriosRepo, type RecordatorioManual } from "../../data/repositorio/recordatoriosRepo";
import { Errores } from "../../util/errores";
import { Fechas } from "../../util/fechas";
import { LocalDate } from "../../util/tiempo";
import { Avisos } from "./Avisos";
import { Boton } from "./Boton";
import { Campo } from "./Campo";
import { Chip } from "./Chip";
import { DialogoCentral } from "./DialogoCentral";
import { SelectorFecha } from "./SelectorFecha";
import { Colores } from "./tema";
import { Texto } from "./Texto";
import { cursorTocable, estiloFoco, useFoco } from "./Web";

export interface MascotaOpcion {
  id: string;
  nombre: string;
}

export interface EditorRecordatorioProps {
  visible: boolean;
  alCerrar: () => void;
  /** Las mascotas entre las que se puede elegir; si es una sola o se edita uno existente, no se pregunta. */
  mascotas: MascotaOpcion[];
  /** El recordatorio que se edita; sin esto se crea uno nuevo. */
  existente?: RecordatorioManual | null;
  /** Se llama cuando ya se guardó, para que la pantalla se dibuje de nuevo. */
  alGuardar: () => void;
}

const dosDigitos = (n: number) => String(n).padStart(2, "0");

function Etiqueta({ texto }: { texto: string }) {
  return <Texto variante="chico" tamano={12} color={Colores.textGray} style={estilos.etiqueta}>{texto}</Texto>;
}

function BotonPildora({ texto, alTocar, etiqueta }: { texto: string; alTocar: () => void; etiqueta: string }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={etiqueta} onPress={alTocar} {...foco.props}
      style={[estilos.pildora, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Texto variante="cuerpo" tamano={14}>{texto}</Texto>
    </Pressable>
  );
}

/** Cuadro para elegir la hora y los minutos (o "Sin hora"). */
function SelectorHoraLibre({
  visible, valor, alElegir, alQuitar, alCerrar,
}: { visible: boolean; valor: string | null; alElegir: (hora: string) => void; alQuitar: () => void; alCerrar: () => void }) {
  const [hora, setHora] = useState("09");
  const [minutos, setMinutos] = useState("00");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const [h, m] = (valor ?? "09:00").split(":");
    setHora(h);
    setMinutos(m);
    setError(null);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const aceptar = () => {
    const h = Number(hora);
    const m = Number(minutos);
    if (!/^\d{1,2}$/.test(hora) || !/^\d{1,2}$/.test(minutos) || h > 23 || m > 59) {
      setError("Elegí una hora entre 00:00 y 23:59");
      return;
    }
    alElegir(`${dosDigitos(h)}:${dosDigitos(m)}`);
    alCerrar();
  };

  return (
    <DialogoCentral visible={visible} alCerrar={alCerrar} anchoMaximo={340}>
      <Texto variante="titulo" tamano={20} accessibilityRole="header">Elegí la hora</Texto>
      <View style={estilos.filaHora}>
        <Campo
          estilo={estilos.campoHora} etiqueta="Hora" value={hora} onChangeText={(t) => setHora(t.replace(/\D/g, "").slice(0, 2))}
          keyboardType="number-pad" maxLength={2} onSubmitEditing={aceptar}
        />
        <Texto variante="titulo" tamano={22} style={estilos.dosPuntos}>:</Texto>
        <Campo
          estilo={estilos.campoHora} etiqueta="Minutos" value={minutos} onChangeText={(t) => setMinutos(t.replace(/\D/g, "").slice(0, 2))}
          keyboardType="number-pad" maxLength={2} onSubmitEditing={aceptar}
        />
      </View>
      {error ? <Texto variante="chico" color={Colores.dangerRed} style={estilos.error}>{error}</Texto> : null}
      <View style={estilos.botonesHora}>
        <Boton titulo="Sin hora" variante="texto" alto={44} onPress={() => { alQuitar(); alCerrar(); }} estilo={estilos.botonHora} />
        <Boton titulo="Cancelar" variante="texto" alto={44} onPress={alCerrar} estilo={estilos.botonHora} />
        <Boton titulo="Aceptar" variante="primario" alto={44} onPress={aceptar} estilo={estilos.botonHora} />
      </View>
    </DialogoCentral>
  );
}

/** Formulario para crear o editar un recordatorio, el mismo para el dueño y para el veterinario. */
export function EditorRecordatorio({ visible, alCerrar, mascotas, existente = null, alGuardar }: EditorRecordatorioProps) {
  const tipos = RecordatoriosRepo.TIPOS;
  const [mascotaId, setMascotaId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [tipo, setTipo] = useState(tipos[0]);
  const [fecha, setFecha] = useState<LocalDate>(LocalDate.now());
  const [hora, setHora] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [errorTitulo, setErrorTitulo] = useState<string | null>(null);
  const [errorFecha, setErrorFecha] = useState<string | null>(null);
  const [eligiendoFecha, setEligiendoFecha] = useState(false);
  const [eligiendoHora, setEligiendoHora] = useState(false);

  // Al abrir se carga el formulario con el recordatorio que se edita (o vacío)
  useEffect(() => {
    if (!visible) return;
    if (existente === null && mascotas.length === 0) {
      Avisos.mostrar("Primero necesitás una mascota para crear un recordatorio");
      alCerrar();
      return;
    }
    setMascotaId(existente?.mascotaId ?? mascotas[0]?.id ?? null);
    setTitulo(existente?.titulo ?? "");
    setTipo(tipos[Math.max(tipos.indexOf(existente?.tipo ?? ""), 0)]);
    setFecha(existente?.fecha ?? LocalDate.now());
    setHora(existente?.hora ?? null);
    setNota(existente?.nota ?? "");
    setErrorTitulo(null);
    setErrorFecha(null);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = () => {
    const texto = titulo.trim();
    if (texto === "") {
      setErrorTitulo("Escribí qué querés recordar");
      return;
    }
    // Se puede dejar una fecha pasada si no se la tocó; lo nuevo no puede ser de antes de hoy
    if (fecha.isBefore(LocalDate.now()) && (existente === null || !fecha.equals(existente.fecha))) {
      setErrorFecha("La fecha no puede ser anterior a hoy");
      return;
    }
    try {
      if (existente === null) {
        if (mascotaId === null) return;
        RecordatoriosRepo.crear(mascotaId, texto, tipo, fecha, hora, nota.trim());
      } else {
        RecordatoriosRepo.editar(existente, texto, tipo, fecha, hora, nota.trim());
      }
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
      return;
    }
    alCerrar();
    alGuardar();
  };

  return (
    <>
      <DialogoCentral visible={visible} alCerrar={alCerrar} anchoMaximo={440} relleno={0}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={estilos.contenido}>
          <Texto variante="titulo" tamano={20} accessibilityRole="header">
            {existente === null ? "Nuevo recordatorio" : "Editar recordatorio"}
          </Texto>

          {existente === null && mascotas.length > 1 ? (
            <>
              <Etiqueta texto="Mascota" />
              <View style={estilos.chips}>
                {mascotas.map((m) => (
                  <Chip
                    key={m.id} texto={m.nombre} tono={mascotaId === m.id ? "seleccionado" : "sinSeleccionar"}
                    onPress={() => setMascotaId(m.id)} estilo={estilos.chip}
                  />
                ))}
              </View>
            </>
          ) : null}

          <Etiqueta texto="Qué querés recordar" />
          <Campo
            placeholder="Ej.: Bañar a la mascota" value={titulo} error={errorTitulo} autoCapitalize="sentences"
            onChangeText={(t) => { setTitulo(t); setErrorTitulo(null); }} returnKeyType="next"
            accessibilityLabel="Qué querés recordar"
          />

          <Etiqueta texto="Tipo" />
          <View style={estilos.chips}>
            {tipos.map((t) => (
              <Chip key={t} texto={t} tono={tipo === t ? "seleccionado" : "sinSeleccionar"} onPress={() => setTipo(t)} estilo={estilos.chip} />
            ))}
          </View>

          <Etiqueta texto="Cuándo" />
          <View style={estilos.fila}>
            <BotonPildora texto={Fechas.corta(fecha)} etiqueta={`Fecha: ${Fechas.corta(fecha)}`} alTocar={() => setEligiendoFecha(true)} />
            <View style={estilos.separador} />
            <BotonPildora texto={hora ? `${hora} hs` : "Sin hora"} etiqueta={hora ? `Hora: ${hora}` : "Sin hora"} alTocar={() => setEligiendoHora(true)} />
          </View>
          {errorFecha ? <Texto variante="chico" color={Colores.dangerRed} style={estilos.error}>{errorFecha}</Texto> : null}

          <Etiqueta texto="Nota (opcional)" />
          <Campo
            multilinea placeholder="Algún detalle para acordarte" value={nota} onChangeText={setNota}
            autoCapitalize="sentences" accessibilityLabel="Nota (opcional)" numberOfLines={2}
          />

          <View style={estilos.botones}>
            <Boton titulo="Cancelar" variante="texto" alto={44} onPress={alCerrar} estilo={estilos.boton} />
            <Boton titulo="Guardar" alto={44} onPress={guardar} estilo={estilos.boton} />
          </View>
        </ScrollView>
      </DialogoCentral>

      <SelectorFecha
        visible={visible && eligiendoFecha} valor={fecha} titulo="Elegí la fecha"
        alElegir={(f) => { setFecha(f); setErrorFecha(null); }} alCerrar={() => setEligiendoFecha(false)}
      />
      <SelectorHoraLibre
        visible={visible && eligiendoHora} valor={hora} alElegir={setHora} alQuitar={() => setHora(null)}
        alCerrar={() => setEligiendoHora(false)}
      />
    </>
  );
}

const estilos = StyleSheet.create({
  contenido: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 14 },
  etiqueta: { paddingTop: 12, paddingBottom: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap" },
  chip: { marginRight: 8, marginTop: 6 },
  fila: { flexDirection: "row", alignItems: "center" },
  separador: { width: 8 },
  pildora: {
    flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, paddingVertical: 11,
    backgroundColor: Colores.white, borderRadius: 22, borderWidth: 1, borderColor: Colores.loginFieldStroke,
  },
  error: { marginTop: 4 },
  botones: { flexDirection: "row", justifyContent: "flex-end", marginTop: 18 },
  boton: { marginLeft: 8, minWidth: 100 },
  filaHora: { flexDirection: "row", alignItems: "flex-end", marginTop: 12 },
  campoHora: { flex: 1 },
  dosPuntos: { paddingHorizontal: 10, paddingBottom: 12 },
  botonesHora: { flexDirection: "row", justifyContent: "flex-end", marginTop: 14 },
  botonHora: { marginLeft: 6, paddingHorizontal: 14 },
});
