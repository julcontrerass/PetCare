/*
 * Migrado de ui/veterinario/InformeFragment.kt (fragment_informe_paciente.xml, sheet_medicamento.xml, sheet_vacuna.xml,
 * item_turno_detalle.xml). Pestaña "Informe" de la ficha del paciente: lo que el veterinario escribe durante o después
 * del turno (SOAP con signos vitales), la receta, las vacunas aplicadas y los archivos de la consulta. El informe solo
 * lo puede modificar quien lo hizo y el mismo día.
 */
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { CatalogoMedico } from "../../data/catalogoMedico";
import { AgendaRepo } from "../../data/repositorio/agendaRepo";
import { ArchivosRepo } from "../../data/repositorio/archivosRepo";
import { InformesRepo, informeEditable, type InformeData } from "../../data/repositorio/informesRepo";
import { comoDocumento, type Paciente } from "../../data/repositorio/pacientesRepo";
import { PerfilVetRepo } from "../../data/repositorio/perfilVetRepo";
import { PrescripcionesRepo } from "../../data/repositorio/prescripcionesRepo";
import { SaludRepo } from "../../data/repositorio/saludRepo";
import { LIMITES_SIGNOS, numeroTexto, posologia, type SignosVitales } from "../../model/clinica";
import { Errores } from "../../util/errores";
import { Fechas } from "../../util/fechas";
import { LocalDate } from "../../util/tiempo";
import { ArchivosUi } from "../common/ArchivosUi";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Campo } from "../common/Campo";
import { Chip } from "../common/Chip";
import { DocumentosPdf } from "../common/DocumentosPdf";
import { HojaInferior } from "../common/HojaInferior";
import { SelectorFecha } from "../common/SelectorFecha";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";
import { useDatos } from "../common/useDatos";
import { BannerInfo, CajaForm, CampoTocable, EtiquetaForm, FilaTurnoDetalle, SeccionTitulo } from "./ElementosVet";

const ENTERO = /^[+-]?\d+$/;
const DECIMAL = /^[+-]?(\d+\.?\d*|\.\d+)$/;

/** Como `toDoubleOrNull` de Kotlin tras cambiar la coma por punto; null si no es un número. */
export function decimal(texto: string): number | null {
  const t = texto.trim().replace(",", ".");
  return DECIMAL.test(t) ? Number(t) : null;
}

/** Como `toIntOrNull`. */
export function entero(texto: string): number | null {
  const t = texto.trim();
  return ENTERO.test(t) ? Number(t) : null;
}

/**
 * Lee los signos vitales y comprueba que sean valores posibles. Devuelve los signos o el mensaje del primero que está
 * mal (el texto exacto del Kotlin).
 */
export function leerSignos(peso: string, temperatura: string, fc: string, fr: string): { signos: SignosVitales } | { problema: string } {
  const p = decimal(peso);
  const t = decimal(temperatura);
  const c = entero(fc);
  const r = entero(fr);
  const L = LIMITES_SIGNOS;
  let problema: string | null = null;
  if (peso.trim() !== "" && (p === null || p <= 0 || p > L.PESO_MAXIMO)) problema = "El peso tiene que estar entre 0 y 999 kg";
  else if (temperatura.trim() !== "" && (t === null || t < L.TEMPERATURA.min || t > L.TEMPERATURA.max)) problema = "La temperatura tiene que estar entre 25 y 45 °C";
  else if (fc.trim() !== "" && (c === null || c < L.FRECUENCIA_CARDIACA.min || c > L.FRECUENCIA_CARDIACA.max)) problema = "La frecuencia cardíaca tiene que estar entre 10 y 400 lpm";
  else if (fr.trim() !== "" && (r === null || r < L.FRECUENCIA_RESPIRATORIA.min || r > L.FRECUENCIA_RESPIRATORIA.max)) problema = "La frecuencia respiratoria tiene que estar entre 2 y 200 rpm";
  if (problema !== null) return { problema };
  return { signos: { pesoKg: p, temperaturaC: t, frecuenciaCardiaca: c, frecuenciaRespiratoria: r } };
}

function signosSinDatos(s: SignosVitales): boolean {
  return s.pesoKg == null && s.temperaturaC == null && s.frecuenciaCardiaca == null && s.frecuenciaRespiratoria == null;
}

export interface InformeVetProps {
  paciente: Paciente;
  /** Turno al que pertenece el informe; null si se escribe desde la ficha, sin turno. */
  turnoId: string | null;
  /** `requireActivity().finish()`: se llama al completar el turno. */
  alTerminar: () => void;
}

export function InformeVet({ paciente, turnoId, alTerminar }: InformeVetProps) {
  useDatos();
  const [, redibujar] = useState(0);
  const tick = () => redibujar((n) => n + 1);
  const turno = AgendaRepo.porId(turnoId);
  const motivoTurno = turno?.motivo ?? "";

  const [motivo, setMotivo] = useState("");
  const [anamnesis, setAnamnesis] = useState("");
  const [peso, setPeso] = useState("");
  const [temperatura, setTemperatura] = useState("");
  const [fc, setFc] = useState("");
  const [fr, setFr] = useState("");
  const [examen, setExamen] = useState("");
  const [diagnostico, setDiagnostico] = useState("");
  const [tratamiento, setTratamiento] = useState("");
  const [cerrado, setCerrado] = useState(false);
  const [adjuntadosAhora, setAdjuntadosAhora] = useState<string[]>([]);

  const [hojaMedicamento, setHojaMedicamento] = useState(false);
  const [hojaVacuna, setHojaVacuna] = useState(false);

  const mostrar = (informe: InformeData) => {
    setCerrado(!informeEditable(informe));
    setMotivo(informe.motivo.trim() === "" ? motivoTurno : informe.motivo);
    setAnamnesis(informe.anamnesis);
    setExamen(informe.examenFisico);
    setDiagnostico(informe.diagnostico);
    setTratamiento(informe.tratamiento);
    setPeso(informe.signos.pesoKg != null ? numeroTexto(informe.signos.pesoKg) : "");
    setTemperatura(informe.signos.temperaturaC != null ? numeroTexto(informe.signos.temperaturaC) : "");
    setFc(informe.signos.frecuenciaCardiaca != null ? String(informe.signos.frecuenciaCardiaca) : "");
    setFr(informe.signos.frecuenciaRespiratoria != null ? String(informe.signos.frecuenciaRespiratoria) : "");
  };

  // Lo que ya había escrito el veterinario se pide al servidor; mientras tanto se ve el motivo del turno
  useEffect(() => {
    let vigente = true;
    mostrar(InformesRepo.obtener(paciente.id, turnoId));
    InformesRepo.cargar(paciente.id, turnoId).then((i) => vigente && mostrar(i)).catch(() => {});
    ArchivosRepo.cargar(paciente.id).then(() => vigente && tick()).catch(() => {});
    PrescripcionesRepo.cargar(paciente.id).then(() => vigente && tick()).catch(() => {});
    return () => {
      vigente = false;
    };
  }, [paciente.id, turnoId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Archivos adjuntos ----------
  // Con turno se ven los adjuntos de ese turno. Sin turno la lista parte vacía: lo que ya estaba cargado vive en los
  // archivos de la mascota, y acá solo se muestra lo que se adjunta en esta pantalla.
  const archivos = turnoId !== null ? ArchivosRepo.deTurno(paciente.id, turnoId) : ArchivosRepo.dePaciente(paciente.id).filter((a) => adjuntadosAhora.includes(a.id));

  const adjuntar = async () => {
    const elegido = await ArchivosUi.elegir();
    if (elegido === null) return;
    try {
      const nuevo = await ArchivosRepo.agregar(paciente.id, elegido.nombre, elegido.extension, elegido.bytes, elegido.mime, turnoId);
      setAdjuntadosAhora((a) => [...a, nuevo.id]);
      Avisos.exito("Archivo adjuntado a la consulta");
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
    }
  };

  // ---------- Receta ----------
  const medicamentos = PrescripcionesRepo.deConsulta(paciente.id, turnoId);

  const recetaPdf = async () => {
    const lista = PrescripcionesRepo.deConsulta(paciente.id, turnoId);
    if (lista.length === 0) return;
    const archivo = await DocumentosPdf.receta(PerfilVetRepo.comoProfesional(turno?.sedeId ?? null), comoDocumento(paciente), LocalDate.now(), lista, tratamiento.trim());
    await DocumentosPdf.compartir(archivo, `Receta de ${paciente.nombre}`);
  };

  // ---------- Vacunas aplicadas en la consulta ----------
  // La vacuna se anota con el día del turno (o con hoy si no hay turno o es a futuro)
  const diaDeLaConsulta = turno && !turno.fecha.isAfter(LocalDate.now()) ? turno.fecha : LocalDate.now();
  const aplicadas = SaludRepo.registros.filter(
    (r) => r.mascotaId === paciente.id && r.tipo === "VACUNA" && r.fechaAplicada !== null && r.fechaAplicada.equals(diaDeLaConsulta),
  );

  // ---------- Informe ----------
  const guardar = () => {
    const leido = leerSignos(peso, temperatura, fc, fr);
    if ("problema" in leido) {
      Avisos.aviso(leido.problema);
      return;
    }
    const signos = leido.signos;
    const m = motivo.trim();
    const a = anamnesis.trim();
    const e = examen.trim();
    const d = diagnostico.trim();
    const t = tratamiento.trim();
    if (d === "" && t === "" && a === "" && e === "" && signosSinDatos(signos)) {
      Avisos.aviso("Completá al menos la anamnesis, los signos vitales, el diagnóstico o el tratamiento");
      return;
    }
    InformesRepo.guardar(paciente.id, m, d, t, turnoId, a, e, signos);
    if (turno === null || turno.estado !== "PENDIENTE") {
      Avisos.exito("Informe guardado");
      return;
    }
    // Durante un turno, guardar el informe es el momento natural para cerrarlo
    Avisos.confirmar({
      titulo: "Informe guardado",
      mensaje: `¿Querés dar por terminado el turno de ${paciente.nombre}? Queda como completado en tu agenda y el dueño puede ver el informe.`,
      textoAceptar: "Completar turno", textoCancelar: "Todavía no", peligro: false, icono: "checkCirculo",
      alAceptar: () => {
        AgendaRepo.cambiarEstado(turno, "COMPLETADO");
        alTerminar();
      },
    });
  };

  const bloq = cerrado;
  return (
    <View>
      {cerrado ? <BannerInfo texto="Este informe ya está cerrado: solo lo puede modificar quien lo hizo y el mismo día en que se hizo." /> : null}

      <SeccionTitulo texto="Consulta" estilo={{ marginTop: 0 }} />
      <CajaForm>
        <Texto variante="chico" tamano={12.5}>Motivo del turno / consulta</Texto>
        <Campo
          placeholder="Ej: Vacuna anual, Control general" accessibilityLabel="Motivo del turno / consulta" value={motivo} onChangeText={setMotivo}
          editable={!bloq} autoCapitalize="sentences" estilo={estilos.campo}
        />
        <Texto variante="chico" tamano={12.5} style={{ marginTop: 16 }}>Anamnesis: lo que cuenta el dueño</Texto>
        <Campo
          multilinea placeholder="Desde cuándo, cómo come, cómo se comporta, cambios recientes..." accessibilityLabel="Anamnesis"
          value={anamnesis} onChangeText={setAnamnesis} editable={!bloq} autoCapitalize="sentences" numberOfLines={3} estilo={estilos.campo}
        />
      </CajaForm>

      <SeccionTitulo texto="Signos vitales" />
      <CajaForm>
        <View style={estilos.fila}>
          <View style={{ flex: 1 }}>
            <Texto variante="chico" tamano={12.5}>Peso (kg)</Texto>
            <Campo placeholder="Ej: 12,4" accessibilityLabel="Peso (kg)" value={peso} onChangeText={setPeso} editable={!bloq} keyboardType="decimal-pad" estilo={estilos.campo} />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Texto variante="chico" tamano={12.5}>Temperatura (°C)</Texto>
            <Campo placeholder="Ej: 38,5" accessibilityLabel="Temperatura (°C)" value={temperatura} onChangeText={setTemperatura} editable={!bloq} keyboardType="decimal-pad" estilo={estilos.campo} />
          </View>
        </View>
        <View style={[estilos.fila, { marginTop: 12 }]}>
          <View style={{ flex: 1 }}>
            <Texto variante="chico" tamano={12.5}>Frec. cardíaca (lpm)</Texto>
            <Campo placeholder="Ej: 90" accessibilityLabel="Frec. cardíaca (lpm)" value={fc} onChangeText={setFc} editable={!bloq} keyboardType="decimal-pad" estilo={estilos.campo} />
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Texto variante="chico" tamano={12.5}>Frec. respiratoria (rpm)</Texto>
            <Campo placeholder="Ej: 22" accessibilityLabel="Frec. respiratoria (rpm)" value={fr} onChangeText={setFr} editable={!bloq} keyboardType="decimal-pad" estilo={estilos.campo} />
          </View>
        </View>
      </CajaForm>

      <SeccionTitulo texto="Examen y diagnóstico" />
      <CajaForm>
        <Texto variante="chico" tamano={12.5}>Examen físico</Texto>
        <Campo
          multilinea placeholder="Mucosas, hidratación, ganglios, auscultación, palpación..." accessibilityLabel="Examen físico"
          value={examen} onChangeText={setExamen} editable={!bloq} autoCapitalize="sentences" numberOfLines={3} estilo={estilos.campo}
        />
        <Texto variante="chico" tamano={12.5} style={{ marginTop: 16 }}>Diagnóstico</Texto>
        <Campo
          multilinea placeholder="Impresión diagnóstica y observaciones clínicas" accessibilityLabel="Diagnóstico"
          value={diagnostico} onChangeText={setDiagnostico} editable={!bloq} autoCapitalize="sentences" numberOfLines={3} estilo={estilos.campo}
        />
      </CajaForm>

      <SeccionTitulo texto="Plan e indicaciones" />
      <CajaForm>
        <Texto variante="chico" tamano={12.5}>Tratamiento y recomendaciones</Texto>
        <Campo
          multilinea placeholder="Plan, cuidados, controles, recomendaciones..." accessibilityLabel="Tratamiento y recomendaciones"
          value={tratamiento} onChangeText={setTratamiento} editable={!bloq} autoCapitalize="sentences" numberOfLines={3} estilo={estilos.campo}
        />
      </CajaForm>

      <SeccionTitulo texto="Receta" />
      <View style={estilos.lista}>
        {medicamentos.length === 0 ? (
          <Texto variante="chico" tamano={13.5}>Todavía no recetaste ningún medicamento en esta consulta.</Texto>
        ) : (
          medicamentos.map((m) => (
            <FilaTurnoDetalle
              key={m.id} icono="vacuna" titulo={m.medicamento}
              valor={(posologia(m).trim() === "" ? "Sin dosis indicada" : posologia(m)) + (m.indicaciones.trim() !== "" ? `\n${m.indicaciones}` : "")}
              accion="Quitar" colorAccion={Colores.dangerRed}
              alAccion={() => {
                PrescripcionesRepo.eliminar(m);
                tick();
              }}
            />
          ))
        )}
      </View>
      <Boton titulo="Agregar medicamento" variante="secundario" alto={50} estilo={{ marginTop: 10 }} onPress={() => setHojaMedicamento(true)} />
      {medicamentos.length > 0 ? <Boton titulo="Receta en PDF" variante="secundario" alto={50} estilo={{ marginTop: 8 }} onPress={() => void recetaPdf()} /> : null}

      <SeccionTitulo texto="Vacunas aplicadas" />
      <View style={estilos.lista}>
        {aplicadas.length === 0 ? (
          <Texto variante="chico" tamano={13.5}>Si vacunás en esta consulta, registrala acá: queda en el carnet de salud del animal.</Texto>
        ) : (
          aplicadas.map((v) => (
            <FilaTurnoDetalle
              key={v.id} icono="vacuna" titulo={v.titulo} valor={v.detalle} accion="Quitar" colorAccion={Colores.dangerRed}
              alAccion={() => {
                SaludRepo.eliminar(v);
                tick();
              }}
            />
          ))
        )}
      </View>
      <Boton titulo="Registrar vacuna" variante="secundario" alto={50} estilo={{ marginTop: 10 }} onPress={() => setHojaVacuna(true)} />

      <SeccionTitulo texto="Archivos adjuntos" />
      <View style={estilos.lista}>
        {archivos.length === 0 ? (
          <Texto variante="chico" tamano={13.5}>Todavía no adjuntaste archivos a esta consulta.</Texto>
        ) : (
          archivos.map((a) => (
            <FilaTurnoDetalle
              key={a.id} icono={a.icono === "pencil" ? "editar" : a.icono === "camera" ? "camara" : "lista"} titulo={a.fecha} valor={a.nombre}
              accion="Quitar" colorAccion={Colores.dangerRed}
              alTocar={() => void ArchivosUi.abrir(ArchivosRepo.BUCKET, a.storagePath, a.tipoExtension)}
              alAccion={() =>
                Avisos.confirmar({
                  titulo: "¿Quitar el archivo?", mensaje: `Se borra '${a.nombre}' de la consulta y de la ficha.`,
                  textoAceptar: "Quitar", textoCancelar: "Cancelar",
                  alAceptar: () => {
                    ArchivosRepo.eliminar(a);
                    tick();
                  },
                })
              }
            />
          ))
        )}
      </View>
      <Boton titulo="Adjuntar archivo" variante="secundario" alto={50} estilo={{ marginTop: 10 }} onPress={() => void adjuntar()} />

      {!cerrado ? <Boton titulo="Guardar informe" alto={56} estilo={{ marginTop: 16 }} onPress={guardar} /> : null}

      <HojaMedicamento
        visible={hojaMedicamento} alCerrar={() => setHojaMedicamento(false)}
        alAgregar={(nombre, dosis, cada, dias, indicaciones) => {
          PrescripcionesRepo.agregar(paciente.id, turnoId, nombre, dosis, cada, dias, indicaciones);
          tick();
        }}
      />
      <HojaVacuna
        visible={hojaVacuna} alCerrar={() => setHojaVacuna(false)} paciente={paciente} dia={diaDeLaConsulta}
        alGuardar={(titulo, marca, lote, venceLote, proxima) => {
          SaludRepo.agregar("VACUNA", paciente.id, titulo, null, diaDeLaConsulta, null, proxima, null, marca, lote, venceLote);
          tick();
          Avisos.exito(`Vacuna guardada en el carnet de ${paciente.nombre}`);
        }}
      />
    </View>
  );
}

/** sheet_medicamento: agrega un medicamento a la receta de la consulta. */
function HojaMedicamento({
  visible, alCerrar, alAgregar,
}: { visible: boolean; alCerrar: () => void; alAgregar: (nombre: string, dosis: string, cada: number | null, dias: number | null, indicaciones: string) => void }) {
  const [nombre, setNombre] = useState("");
  const [dosis, setDosis] = useState("");
  const [cada, setCada] = useState("");
  const [dias, setDias] = useState("");
  const [indicaciones, setIndicaciones] = useState("");
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const [errorPauta, setErrorPauta] = useState<string | null>(null);
  const abierta = useRef(false);
  useEffect(() => {
    if (visible && !abierta.current) {
      setNombre(""); setDosis(""); setCada(""); setDias(""); setIndicaciones(""); setErrorNombre(null); setErrorPauta(null);
    }
    abierta.current = visible;
  }, [visible]);

  const guardar = () => {
    if (nombre.trim() === "") {
      setErrorNombre("Indicá el medicamento");
      return;
    }
    const c = entero(cada);
    const d = entero(dias);
    if ((c !== null && (c < 1 || c > 168)) || (d !== null && (d < 1 || d > 365))) {
      const m = "Revisá las horas (1 a 168) y los días (1 a 365)";
      setErrorPauta(m);
      Avisos.aviso(m);
      return;
    }
    alAgregar(nombre, dosis, c, d, indicaciones);
    alCerrar();
  };
  return (
    <HojaInferior visible={visible} alCerrar={alCerrar}>
      <Texto variante="titulo" tamano={21} accessibilityRole="header">Agregar medicamento</Texto>
      <Texto variante="subtitulo" tamano={13.5} style={{ marginTop: 4 }}>
        Si indicás cada cuántas horas y por cuántos días, el dueño recibe el recordatorio de cada toma.
      </Texto>
      <Campo
        placeholder="Medicamento (ej: Amoxicilina)" accessibilityLabel="Medicamento" value={nombre} error={errorNombre}
        onChangeText={(t) => { setNombre(t); setErrorNombre(null); }} autoCapitalize="sentences" estilo={{ marginTop: 16 }}
      />
      <Campo placeholder="Dosis (ej: 250 mg, 1 comprimido)" accessibilityLabel="Dosis" value={dosis} onChangeText={setDosis} autoCapitalize="sentences" estilo={{ marginTop: 10 }} />
      <View style={[estilos.fila, { marginTop: 10 }]}>
        <Campo placeholder="Cada (horas)" accessibilityLabel="Cada (horas)" value={cada} onChangeText={(t) => { setCada(t); setErrorPauta(null); }} keyboardType="number-pad" estilo={{ flex: 1 }} />
        <Campo placeholder="Durante (días)" accessibilityLabel="Durante (días)" value={dias} onChangeText={(t) => { setDias(t); setErrorPauta(null); }} keyboardType="number-pad" estilo={{ flex: 1, marginLeft: 8 }} />
      </View>
      {errorPauta ? <Texto variante="chico" color={Colores.dangerRed} style={{ marginTop: 4 }}>{errorPauta}</Texto> : null}
      <Campo
        multilinea placeholder="Indicaciones (con comida, en ayunas, vía...)" accessibilityLabel="Indicaciones" value={indicaciones}
        onChangeText={setIndicaciones} autoCapitalize="sentences" numberOfLines={2} estilo={{ marginTop: 10 }}
      />
      <Boton titulo="Agregar a la receta" alto={50} estilo={{ marginTop: 18 }} onPress={guardar} />
      <Boton titulo="Cancelar" variante="secundario" alto={50} estilo={{ marginTop: 8 }} onPress={alCerrar} />
    </HojaInferior>
  );
}

/** sheet_vacuna: registra una vacuna aplicada en la consulta (queda en el carnet). */
function HojaVacuna({
  visible, alCerrar, paciente, dia, alGuardar,
}: {
  visible: boolean; alCerrar: () => void; paciente: Paciente; dia: LocalDate;
  alGuardar: (titulo: string, marca: string | null, lote: string | null, venceLote: LocalDate | null, proxima: LocalDate | null) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [marca, setMarca] = useState("");
  const [lote, setLote] = useState("");
  const [venceLote, setVenceLote] = useState<LocalDate | null>(null);
  const [proxima, setProxima] = useState<LocalDate | null>(null);
  const [selVence, setSelVence] = useState(false);
  const [selProxima, setSelProxima] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enfocado, setEnfocado] = useState(false);
  const abierta = useRef(false);
  useEffect(() => {
    if (visible && !abierta.current) {
      setNombre(""); setMarca(""); setLote(""); setVenceLote(null); setProxima(null); setError(null);
    }
    abierta.current = visible;
  }, [visible]);

  const sugeridas = CatalogoMedico.vacunasHabituales(paciente.especie).filter((v) => nombre.trim() === "" || (v.toLowerCase().includes(nombre.trim().toLowerCase()) && v.toLowerCase() !== nombre.trim().toLowerCase()));

  const guardar = () => {
    const titulo = nombre.trim();
    if (titulo === "") {
      setError("Indicá la vacuna");
      return;
    }
    alGuardar(titulo, marca.trim() === "" ? null : marca.trim(), lote.trim() === "" ? null : lote.trim(), venceLote, proxima);
    alCerrar();
  };
  return (
    <HojaInferior visible={visible} alCerrar={alCerrar}>
      <Texto variante="titulo" tamano={21} accessibilityRole="header">Registrar vacuna aplicada</Texto>
      <Texto variante="subtitulo" tamano={13.5} style={{ marginTop: 4 }}>{`${paciente.nombre} · ${Fechas.corta(dia)}`}</Texto>
      <Campo
        placeholder="Vacuna (ej: Antirrábica)" accessibilityLabel="Vacuna" value={nombre} error={error}
        onChangeText={(t) => { setNombre(t); setError(null); }} onFocus={() => setEnfocado(true)} autoCapitalize="sentences" estilo={{ marginTop: 16 }}
      />
      {enfocado && sugeridas.length > 0 ? (
        <View style={estilos.sugeridas}>
          {sugeridas.map((v) => <Chip key={v} texto={v} tono="sinSeleccionar" onPress={() => { setNombre(v); setError(null); setEnfocado(false); }} />)}
        </View>
      ) : null}
      <Campo placeholder="Marca / producto (opcional)" accessibilityLabel="Marca / producto" value={marca} onChangeText={setMarca} autoCapitalize="sentences" estilo={{ marginTop: 10 }} />
      <View style={[estilos.fila, { marginTop: 10 }]}>
        <Campo placeholder="Lote (opcional)" accessibilityLabel="Lote" value={lote} onChangeText={setLote} autoCapitalize="characters" estilo={{ flex: 1 }} />
        <View style={{ flex: 1, marginLeft: 8 }}>
          <CampoTocable valor={venceLote ? Fechas.corta(venceLote) : ""} marcador="Vence el lote" accesibilidad="Vence el lote" icono="calendario" alTocar={() => setSelVence(true)} />
        </View>
      </View>
      <View style={{ marginTop: 10 }}>
        <CampoTocable
          valor={proxima ? Fechas.corta(proxima) : ""} marcador="Próxima dosis (el dueño recibe el aviso)" accesibilidad="Próxima dosis"
          icono="calendario" alTocar={() => setSelProxima(true)}
        />
      </View>
      <Boton titulo="Guardar en el carnet" alto={50} estilo={{ marginTop: 18 }} onPress={guardar} />
      <Boton titulo="Cancelar" variante="secundario" alto={50} estilo={{ marginTop: 8 }} onPress={alCerrar} />
      <SelectorFecha visible={selVence} valor={venceLote} titulo="Vence el lote" alElegir={setVenceLote} alCerrar={() => setSelVence(false)} />
      <SelectorFecha visible={selProxima} valor={proxima} titulo="Próxima dosis" alElegir={setProxima} alCerrar={() => setSelProxima(false)} />
    </HojaInferior>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "flex-start" },
  campo: { marginTop: 6 },
  lista: { backgroundColor: Colores.white, borderRadius: 18, padding: 14, marginTop: 10 },
  sugeridas: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
});
