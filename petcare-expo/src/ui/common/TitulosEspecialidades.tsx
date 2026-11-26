/*
 * Títulos de especialidades del veterinario. Una especialidad (dermatología, cardiología...) se ofrece a los dueños
 * recién cuando el administrador aprueba su título.
 * - FormularioTitulo: el título, la institución, el año y de 1 a 5 archivos (PDF o foto).
 * - HojaTitulo: el formulario en una hoja (registro y perfil).
 * - TitulosEspecialidadesHoja: en el perfil, el estado de cada especialidad elegida y subir o reemplazar su título.
 */
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import type { ArchivoHabilitacion } from "../../data/habilitaciones";
import { EspecialidadesRepo, type CertificadoElegido } from "../../data/repositorio/especialidadesRepo";
import type { EspecialidadVetDto, EstadoEspecialidad } from "../../data/remoto/dtos";
import { Errores } from "../../util/errores";
import { Avisos } from "./Avisos";
import { Boton } from "./Boton";
import { Campo } from "./Campo";
import { Chip, type TonoChip } from "./Chip";
import { HojaInferior } from "./HojaInferior";
import { Icono } from "./Icono";
import { elegirHabilitacion } from "./SelectorHabilitacion";
import { Colores } from "./tema";
import { Texto } from "./Texto";
import { useDatos } from "./useDatos";
import { cursorTocable, estiloFoco, useFoco } from "./Web";

const MAX_ARCHIVOS = 5;

export const ESTADO_TITULO: Record<EstadoEspecialidad, { texto: string; tono: TonoChip }> = {
  sin_certificado: { texto: "Falta el título", tono: "neutro" },
  pendiente: { texto: "En revisión", tono: "aviso" },
  aprobada: { texto: "Aprobada", tono: "ok" },
  rechazada: { texto: "Rechazado", tono: "peligro" },
};

function Archivo({ archivo, alQuitar }: { archivo: ArchivoHabilitacion; alQuitar: () => void }) {
  const foco = useFoco();
  return (
    <View style={estilos.archivo}>
      <Icono nombre="documento" tamano={18} color={Colores.primaryTeal} />
      <Texto tamano={13.5} numberOfLines={1} style={{ flex: 1 }}>{archivo.nombre}</Texto>
      <Pressable
        accessibilityRole="button" accessibilityLabel={`Quitar ${archivo.nombre}`} onPress={alQuitar} hitSlop={8}
        {...foco.props} style={[cursorTocable, estiloFoco(foco.enfocado)]}
      >
        <Icono nombre="cerrar" tamano={18} color={Colores.dangerRed} />
      </Pressable>
    </View>
  );
}

export function FormularioTitulo({ especialidad, inicial, guardando = false, alGuardar, alVolver }: {
  especialidad: string;
  inicial?: Partial<CertificadoElegido> | null;
  guardando?: boolean;
  alGuardar: (c: CertificadoElegido) => void;
  alVolver: () => void;
}) {
  const [titulo, setTitulo] = useState(inicial?.titulo ?? "");
  const [institucion, setInstitucion] = useState(inicial?.institucion ?? "");
  const [anio, setAnio] = useState(inicial?.anio ? String(inicial.anio) : "");
  const [archivos, setArchivos] = useState<ArchivoHabilitacion[]>(inicial?.archivos ?? []);
  const [errores, setErrores] = useState<Partial<Record<"titulo" | "institucion" | "anio" | "archivos", string>>>({});

  const agregar = async () => {
    const a = await elegirHabilitacion();
    if (!a) return;
    setArchivos((l) => [...l, a].slice(0, MAX_ARCHIVOS));
    setErrores((e) => ({ ...e, archivos: undefined }));
  };

  const guardar = () => {
    const e: typeof errores = {};
    const n = Number(anio);
    if (titulo.trim().length < 3) e.titulo = "Ingresá el nombre del título o del curso";
    if (institucion.trim().length < 2) e.institucion = "Ingresá quién lo otorgó";
    if (!Number.isInteger(n) || n < 1950 || n > new Date().getFullYear()) e.anio = "Revisá el año";
    if (archivos.length === 0) e.archivos = "Sumá al menos un archivo del título o certificado";
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    alGuardar({ especialidad, titulo: titulo.trim(), institucion: institucion.trim(), anio: n, archivos });
  };

  return (
    <View>
      <Texto tamano={20} negrita accessibilityRole="header">{`Título de ${especialidad}`}</Texto>
      <Texto variante="chico" tamano={13} style={{ marginTop: 4 }}>
        El título, diplomatura, posgrado o curso que te habilita para esta especialidad. Solo lo ve el administrador de PetCare.
      </Texto>
      <Campo
        estilo={{ marginTop: 14 }} etiqueta="Título o curso" placeholder={`Ej: Especialista en ${especialidad}`} value={titulo}
        onChangeText={(t) => { setTitulo(t); setErrores((x) => ({ ...x, titulo: undefined })); }} error={errores.titulo}
      />
      <Campo
        estilo={{ marginTop: 12 }} etiqueta="Institución" placeholder="Ej: Facultad de Ciencias Veterinarias (UBA)" value={institucion}
        onChangeText={(t) => { setInstitucion(t); setErrores((x) => ({ ...x, institucion: undefined })); }} error={errores.institucion}
      />
      <Campo
        estilo={{ marginTop: 12 }} etiqueta="Año en que lo obtuviste" placeholder="Ej: 2021" value={anio} keyboardType="number-pad"
        onChangeText={(t) => { setAnio(t.replace(/\D/g, "").slice(0, 4)); setErrores((x) => ({ ...x, anio: undefined })); }} error={errores.anio}
      />
      <Texto tamano={14} negrita style={{ marginTop: 14 }}>Archivos</Texto>
      <Texto variante="chico" tamano={12.5}>PDF o foto del título, el certificado o el analítico. Hasta {MAX_ARCHIVOS}.</Texto>
      {archivos.map((a, i) => (
        <Archivo key={`${a.nombre}-${i}`} archivo={a} alQuitar={() => setArchivos((l) => l.filter((_, j) => j !== i))} />
      ))}
      {archivos.length < MAX_ARCHIVOS ? (
        <Boton titulo="Sumar archivo" icono="mas" variante="secundario" alto={44} estilo={{ marginTop: 10 }} onPress={() => void agregar()} />
      ) : null}
      {errores.archivos ? <Texto variante="chico" tamano={12} color={Colores.dangerRed} style={{ marginTop: 4 }}>{errores.archivos}</Texto> : null}
      <Boton titulo="Guardar título" alto={50} estilo={{ marginTop: 16 }} cargando={guardando} onPress={guardar} />
      <Boton titulo="Volver" variante="texto" alto={46} estilo={{ marginTop: 4 }} deshabilitado={guardando} onPress={alVolver} />
    </View>
  );
}

/** El formulario en una hoja. */
export function HojaTitulo(props: Parameters<typeof FormularioTitulo>[0]) {
  return (
    <HojaInferior visible alCerrar={props.guardando ? () => {} : props.alVolver} cancelable={!props.guardando}>
      <FormularioTitulo {...props} />
    </HojaInferior>
  );
}

function FilaEspecialidad({ e, alSubir }: { e: EspecialidadVetDto; alSubir: () => void }) {
  const estado = ESTADO_TITULO[e.estado];
  const accion = e.estado === "sin_certificado" ? "Subir título" : e.estado === "rechazada" ? "Subir de nuevo" : "Reemplazar";
  return (
    <View style={estilos.fila}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Texto tamano={15} negrita>{e.especialidad}</Texto>
        {e.titulo ? <Texto variante="chico" tamano={12.5} numberOfLines={1}>{`${e.titulo} · ${e.institucion ?? ""} · ${e.anio ?? ""}`}</Texto> : null}
        <Chip texto={estado.texto} tono={estado.tono} estilo={{ marginTop: 6, alignSelf: "flex-start" }} />
        {e.estado === "rechazada" && e.motivo ? (
          <Texto variante="chico" tamano={12.5} color={Colores.dangerRed} style={{ marginTop: 4 }}>{e.motivo}</Texto>
        ) : null}
      </View>
      <Boton titulo={accion} variante={e.estado === "aprobada" ? "texto" : "secundario"} alto={40} onPress={alSubir} />
    </View>
  );
}

/** En el perfil del veterinario: el título de cada especialidad elegida. */
export function TitulosEspecialidadesHoja({ alCerrar }: { alCerrar: () => void }) {
  useDatos();
  const [cargado, setCargado] = useState(false);
  const [editando, setEditando] = useState<EspecialidadVetDto | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void EspecialidadesRepo.cargar().then(() => setCargado(true));
  }, []);

  if (editando) {
    return (
      <HojaTitulo
        especialidad={editando.especialidad} guardando={guardando}
        inicial={{ titulo: editando.titulo ?? "", institucion: editando.institucion ?? "", anio: editando.anio ?? undefined }}
        alVolver={() => setEditando(null)}
        alGuardar={(c) => {
          setGuardando(true);
          EspecialidadesRepo.enviar(c).then(
            () => {
              Avisos.mostrar(`Mandamos el título de ${c.especialidad}. Te avisamos cuando lo revisemos`, "exito");
              setGuardando(false);
              setEditando(null);
            },
            (err: unknown) => {
              Avisos.error(Errores.mensaje(err));
              setGuardando(false);
            },
          );
        }}
      />
    );
  }

  const lista = EspecialidadesRepo.lista;
  return (
    <HojaInferior visible alCerrar={alCerrar}>
      <Texto tamano={20} negrita accessibilityRole="header">Títulos de especialidades</Texto>
      <Texto variante="chico" tamano={13} style={{ marginTop: 4 }}>
        Cada especialidad se ofrece a los dueños cuando aprobamos su título. Tus servicios generales (chequeo, castraciones,
        cirugía...) se ofrecen siempre con tu matrícula.
      </Texto>
      {!cargado && lista.length === 0 ? <ActivityIndicator color={Colores.primaryTeal} style={{ marginVertical: 16 }} /> : null}
      {cargado && lista.length === 0 ? (
        <Texto variante="chico" tamano={13} style={{ marginTop: 12 }}>
          {"No elegiste especialidades. Si hacés alguna, sumala en \"Especialidades\" y después subí su título acá."}
        </Texto>
      ) : null}
      <View style={{ marginTop: 8 }}>
        {lista.map((e) => <FilaEspecialidad key={e.id} e={e} alSubir={() => setEditando(e)} />)}
      </View>
    </HojaInferior>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colores.dividerLight },
  archivo: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, padding: 10, borderRadius: 12,
    backgroundColor: Colores.white, borderWidth: 1, borderColor: Colores.dividerLight,
  },
});
