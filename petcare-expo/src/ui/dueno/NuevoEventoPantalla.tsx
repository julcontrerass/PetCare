/*
 * Migrado de ui/dueno/NuevoEventoPantalla.kt (+ pantalla_nuevo_evento.xml).
 * Asistente de tres pasos para agendar un turno: tipo y mascota, veterinario/fecha/hora, y confirmación. Con
 * `edicion` es el mismo asistente para cambiar un turno (`mostrarEdicion`): arranca en el paso 2 y guarda.
 *
 * Desvío: el calendario del mes y la grilla de horarios que el Kotlin dibujaba a mano son los selectores del kit
 * (`SelectorFecha` / `SelectorHora`); los días y horarios que no se pueden elegir salen bloqueados/tachados y
 * avisan por qué al tocarlos, igual que los toasts del Kotlin.
 */
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { CatalogoMedico } from "../../data/catalogoMedico";
import type { HoraOcupadaDto } from "../../data/remoto/dtos";
import { DuenoRepo, type EstudioAdjunto } from "../../data/repositorio/duenoRepo";
import {
  textoHorarioSede, textoLugarSede, type EventoMascota, type SedeVet, type VeterinarioAcceso,
} from "../../model/modelos";
import { TiposMascota } from "../../model/tiposMascota";
import { Errores } from "../../util/errores";
import { Fechas } from "../../util/fechas";
import { LocalDate, YearMonth } from "../../util/tiempo";
import { ArchivosUi } from "../common/ArchivosUi";
import { Avatar } from "../common/Avatar";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Campo } from "../common/Campo";
import { DialogoCentral } from "../common/DialogoCentral";
import { EstiloCategoria } from "../common/EstiloCategoria";
import { Icono } from "../common/Icono";
import { ImagenRemota } from "../common/ImagenRemota";
import { PantallaBase } from "../common/PantallaBase";
import { SelectorFecha } from "../common/SelectorFecha";
import { SelectorHora } from "../common/SelectorHora";
import { Tarjeta } from "../common/Tarjeta";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";
import { useDatos } from "../common/useDatos";
import { useEntradaDePaso } from "../common/Efectos";
import { useSesionRequerida } from "../common/useSesionRequerida";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { Animated } from "react-native";
import { EstadoDueno } from "./estadoDueno";
import { NavDueno } from "./navegacionDueno";

const SUBTITULOS_PASO = [
  "Paso 1 de 3 · Tipo de evento y mascota",
  "Paso 2 de 3 · Veterinario, fecha y hora",
  "Paso 3 de 3 · Revisá y confirmá",
];

const ETIQUETAS_PASO = ["Tipo", "Detalles", "Resumen"];

/** Texto sin acentos y en minúsculas, para el buscador de servicios. */
export function sinAcentos(texto: string): string {
  return texto.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function textoEstadoVeterinario(estado: VeterinarioAcceso["estado"]): string {
  switch (estado) {
    case "ACTIVO": return "Con acceso";
    case "INACTIVO": return "Sin acceso · se restablece al agendar";
    default: return "Tendrá acceso al agendar";
  }
}

export interface NuevoEventoPantallaProps {
  /** Día con el que arranca el asistente; si ya pasó (o no se da) arranca hoy. */
  fecha?: LocalDate | null;
  /** Mascota que queda elegida en el primer paso. */
  mascota?: string | null;
  /** Turno que se edita; null cuando el asistente crea uno nuevo. */
  edicion?: EventoMascota | null;
}

function Seccion({ titulo, estilo }: { titulo: string; estilo?: object }) {
  return (
    <Texto variante="titulo" tamano={17} style={estilo} accessibilityRole="header">{titulo}</Texto>
  );
}

/** Tarjeta de un servicio o especialidad (paso 1). */
function TarjetaServicio({ nombre, activa, alTocar }: { nombre: string; activa: boolean; alTocar: () => void }) {
  const e = EstiloCategoria.servicio(nombre);
  return (
    <Tarjeta onPress={alTocar} seleccionada={activa} relleno={14} estilo={estilos.tarjetaServicio} accessibilityLabel={nombre}>
      <View style={estilos.centrado}>
        <View style={[estilos.circuloServicio, { backgroundColor: e.fondo }]}>
          <Icono nombre={e.icono} tamano={24} color={e.color} />
        </View>
        <Texto
          variante="cuerpo" tamano={13.5} centrado numberOfLines={3} peso={activa ? "bold" : "regular"}
          color={activa ? Colores.primaryTeal : Colores.brandNavy} style={{ marginTop: 10 }}
        >
          {nombre}
        </Texto>
      </View>
      {activa ? <Icono nombre="checkCirculo" tamano={22} color={Colores.primaryTeal} estilo={estilos.tilde} /> : null}
    </Tarjeta>
  );
}

/** Mascota de la fila del primer paso. */
function ItemMascota({ nombre, inicial, fotoUri, fotoPath, activa, alTocar }: {
  nombre: string; inicial: string; fotoUri: string | null; fotoPath: string | null; activa: boolean; alTocar: () => void;
}) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={nombre} accessibilityState={{ selected: activa }} onPress={alTocar}
      {...foco.props} style={[estilos.itemMascota, cursorTocable]}
    >
      <View style={[estilos.marcoMascota, activa ? estilos.marcoActivo : null, estiloFoco(foco.enfocado)]}>
        <ImagenRemota
          fotoUri={fotoUri} fotoPath={fotoPath} estilo={estilos.fotoMascota}
          respaldo={<Texto variante="titulo" tamano={22} color={Colores.primaryTeal}>{inicial}</Texto>}
        />
      </View>
      <Texto variante="cuerpo" tamano={13} peso={activa ? "bold" : "regular"} color={activa ? Colores.primaryTeal : Colores.textGray} style={{ marginTop: 6 }} numberOfLines={1}>
        {nombre}
      </Texto>
    </Pressable>
  );
}

/** Fila tocable de "Fecha" y "Hora" del segundo paso. */
function CampoElegir({ icono, texto, etiqueta, alTocar }: { icono: "calendario" | "reloj"; texto: string; etiqueta: string; alTocar: () => void }) {
  return (
    <Tarjeta onPress={alTocar} relleno={14} accessibilityLabel={etiqueta} estilo={{ marginTop: 10 }}>
      <View style={estilos.fila}>
        <View style={estilos.cajaIcono}><Icono nombre={icono} tamano={22} color={Colores.primaryTeal} /></View>
        <Texto variante="cuerpo" peso="bold" style={{ flex: 1, marginLeft: 12 }}>{texto}</Texto>
        <Icono nombre="chevronDerecha" tamano={24} color={Colores.textGray} />
      </View>
    </Tarjeta>
  );
}

/** Dato del resumen del turno (veterinario, observaciones). */
function FilaResumen({ icono, etiqueta, valor, divisor }: { icono: "veterinario" | "documento"; etiqueta: string; valor: string; divisor?: boolean }) {
  return (
    <>
      {divisor ? <View style={estilos.divisor} /> : null}
      <View style={[estilos.fila, { paddingVertical: 12 }]}>
        <View style={[estilos.cajaIcono, { width: 38, height: 38 }]}><Icono nombre={icono === "veterinario" ? "botiquin" : "documento"} tamano={20} color={Colores.primaryTeal} /></View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Texto variante="chico" tamano={12}>{etiqueta}</Texto>
          <Texto variante="cuerpo" peso="medium" style={{ marginTop: 1 }}>{valor}</Texto>
        </View>
      </View>
    </>
  );
}

export default function NuevoEventoPantalla({ fecha: fechaPedida, mascota: mascotaPreseleccionada, edicion = null }: NuevoEventoPantallaProps) {
  useSesionRequerida();
  useDatos();

  const inicial = useMemo(() => {
    if (edicion) return edicion.fecha;
    return !fechaPedida || fechaPedida.isBefore(LocalDate.now()) ? LocalDate.now() : fechaPedida;
  }, [fechaPedida, edicion]);

  const [paso, setPaso] = useState(edicion ? 2 : 1);
  const [categoria, setCategoria] = useState<string | null>(edicion?.categoria ?? null);
  const [mascota, setMascota] = useState<string | null>(edicion ? edicion.mascota : (mascotaPreseleccionada ?? null));
  const [veterinario, setVeterinario] = useState<string | null>(edicion ? (edicion.veterinario.trim() ? edicion.veterinario : null) : null);
  /** Lugar de atención elegido; null usa el principal del veterinario. */
  const [sedeId, setSedeId] = useState<string | null>(edicion?.sedeId ?? null);
  const [hora, setHora] = useState<string | null>(edicion?.hora ?? null);
  const [ocupadas, setOcupadas] = useState<HoraOcupadaDto[]>([]);
  const [estudios, setEstudios] = useState<EstudioAdjunto[]>([]);
  const [observaciones, setObservaciones] = useState(edicion?.observaciones ?? "");
  const [fecha, setFecha] = useState<LocalDate>(inicial);
  const [filtroServicio, setFiltroServicio] = useState("");
  const [selectorFecha, setSelectorFecha] = useState(false);
  const [selectorHora, setSelectorHora] = useState(false);
  const [estudiosCargados, setEstudiosCargados] = useState<EstudioAdjunto[] | null>(null);
  const [marcados, setMarcados] = useState<Set<string>>(new Set());
  const [archivoNuevo, setArchivoNuevo] = useState<Awaited<ReturnType<typeof ArchivosUi.elegir>>>(null);
  const [cargandoEstudios, setCargandoEstudios] = useState(false);
  const entrada = useEntradaDePaso(paso, 16);

  // Lo que necesita una respuesta tardía del servidor para saber si todavía sirve
  const vivo = useRef({ fecha, veterinario, hora, paso });
  vivo.current = { fecha, veterinario, hora, paso };

  const mascotasActivas = DuenoRepo.mascotasActivas;
  // Si la mascota elegida ya no está activa se descarta (dibujarMascotas del Kotlin)
  useEffect(() => {
    if (paso === 1 && mascota != null && !mascotasActivas.some((m) => m.nombre === mascota)) setMascota(null);
  });

  const vet = DuenoRepo.buscarVeterinario(veterinario);
  const mascotaElegida = DuenoRepo.buscarMascota(mascota);
  const tipoDeLaMascota = mascotaElegida?.tipo ?? null;
  /** El lugar donde se atendería el turno: el elegido o, si no eligió, el principal del veterinario. */
  const sedeElegida = (v: VeterinarioAcceso | null): SedeVet | null => v?.sede(sedeId) ?? null;
  const sede = sedeElegida(vet);
  const duracion = vet?.duracionDe(categoria) ?? CatalogoMedico.duracionPorDefecto(categoria);

  /** Pide al servidor los horarios que ya reservaron otros dueños con el veterinario elegido ese día. */
  useEffect(() => {
    const v = DuenoRepo.buscarVeterinario(veterinario);
    if (!v) {
      setOcupadas([]);
      return;
    }
    const dia = fecha;
    let vigente = true;
    void (async () => {
      let reservadas: HoraOcupadaDto[];
      try {
        reservadas = await DuenoRepo.horasOcupadas(v, dia);
      } catch {
        reservadas = [];
      }
      // El horario que ya tiene este mismo turno no está "ocupado" para quien lo está editando
      if (edicion && edicion.veterinario === v.nombre && edicion.fecha.equals(dia)) {
        reservadas = reservadas.filter((o) => o.hora !== edicion.hora);
      }
      const ahora = vivo.current;
      if (!vigente || !dia.equals(ahora.fecha) || v.nombre !== ahora.veterinario) return;
      setOcupadas(reservadas);
      const elegida = ahora.hora;
      const d = v.duracionDe(categoria);
      if (elegida != null && DuenoRepo.estaOcupado(elegida, d, reservadas)) setHora(null);
    })();
    return () => {
      vigente = false;
    };
    // categoria solo cambia la duración, que no cambia lo que reservaron otros
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [veterinario, fecha.toString(), sedeId]);

  const toast = (t: string) => Avisos.mostrar(t);

  /** Veterinarios que ofrecen el servicio elegido y atienden el tipo de animal de la mascota. */
  const veterinariosElegibles = (): VeterinarioAcceso[] => DuenoRepo.veterinariosPara(categoria, tipoDeLaMascota);

  const animales = () => TiposMascota.plural(TiposMascota.normalizar(tipoDeLaMascota)).toLowerCase();

  /** Comprueba que el veterinario, el día y el horario elegidos se puedan reservar; si no, avisa por qué. */
  const horarioValido = (): boolean => {
    const horaElegida = hora;
    const v = vet;
    const mensaje =
      v == null ? "Seleccioná un veterinario"
      : fecha.isBefore(LocalDate.now()) ? "No podés seleccionar una fecha que ya pasó"
      : !v.atiende(tipoDeLaMascota) ? `${v.nombre} no atiende ${animales()}`
      : !DuenoRepo.trabajaEl(v, fecha, sedeElegida(v)) ? `${v.nombre} no atiende ese día en ese lugar`
      : horaElegida == null || DuenoRepo.horaPasada(fecha, horaElegida) ? "Elegí un horario disponible"
      : DuenoRepo.estaOcupado(horaElegida, duracion, ocupadas) ? "Ese horario ya fue reservado, elegí otro"
      : DuenoRepo.hayConflictoDeTurno(fecha, horaElegida, mascota, edicion, duracion) ? `${mascota} ya tiene un turno en ese horario`
      : null;
    if (mensaje) toast(mensaje);
    return mensaje == null;
  };

  const avanzarDelPrimerPaso = () => {
    if (categoria == null || mascota == null) {
      toast("Seleccioná una categoría y una mascota");
      return;
    }
    // Si cambió la mascota o el servicio, el veterinario que estaba elegido puede ya no corresponder
    if (veterinario != null && !veterinariosElegibles().some((v) => v.nombre === veterinario)) {
      setVeterinario(null);
      setHora(null);
    }
    setPaso(2);
  };

  const avanzarDelSegundoPaso = () => {
    if (!horarioValido()) return;
    setObservaciones((o) => o.trim());
    setPaso(3);
  };

  const irAlCalendario = (dia: LocalDate) => {
    EstadoDueno.diaSeleccionado = dia;
    EstadoDueno.mesCalendario = YearMonth.of(dia.year, dia.monthValue);
    NavDueno.irACalendario();
  };

  /** Guarda los cambios del turno que se está editando y vuelve al calendario. */
  const guardarEdicion = () => {
    if (!edicion) return;
    const obs = observaciones.trim();
    setObservaciones(obs);
    if (!horarioValido()) return;
    const sedeNueva = sedeElegida(vet)?.id;
    const sedeVieja = DuenoRepo.sedeDe(edicion)?.id;
    const sinCambios =
      fecha.equals(edicion.fecha) && hora === edicion.hora && (veterinario ?? "") === edicion.veterinario &&
      sedeNueva === sedeVieja && obs === edicion.observaciones;
    if (sinCambios) {
      toast("No hiciste ningún cambio");
      return;
    }
    DuenoRepo.modificarEvento(edicion, fecha, hora as string, veterinario ?? "", obs, sedeId);
    toast("Turno actualizado");
    irAlCalendario(fecha);
  };

  const confirmar = () => {
    if (fecha.isBefore(LocalDate.now())) {
      toast("No podés seleccionar una fecha que ya pasó");
      return;
    }
    DuenoRepo.agendarEvento(
      fecha, categoria as string, mascota as string, veterinario ?? "", hora as string, observaciones, [...estudios], sedeId,
    );
    toast("Evento guardado");
    irAlCalendario(fecha);
  };

  const alAtras = () => {
    if (paso === 1 || edicion) {
      NavDueno.irACalendario();
    } else {
      if (paso === 2) setObservaciones((o) => o.trim());
      setPaso(paso - 1);
    }
  };

  const alSiguiente = () => {
    if (edicion) return guardarEdicion();
    if (paso === 1) avanzarDelPrimerPaso();
    else if (paso === 2) avanzarDelSegundoPaso();
    else confirmar();
  };

  // ---------- Paso 1 ----------

  const buscado = sinAcentos(filtroServicio.trim());
  const seccionServicios = (titulo: string, detalle: string, nombres: string[]) => {
    const visibles = nombres.filter((n) => buscado === "" || sinAcentos(n).includes(buscado));
    if (visibles.length === 0) return null;
    const filas: string[][] = [];
    for (let i = 0; i < visibles.length; i += 2) filas.push(visibles.slice(i, i + 2));
    return (
      <View key={titulo}>
        <View style={[estilos.fila, { marginTop: 18, marginBottom: 8 }]}>
          <View style={{ flex: 1 }}>
            <Texto variante="titulo" tamano={16} accessibilityRole="header">{titulo}</Texto>
            <Texto variante="chico">{detalle}</Texto>
          </View>
          <View style={estilos.contador}><Texto variante="etiqueta" tamano={12.5} color={Colores.primaryTeal}>{String(visibles.length)}</Texto></View>
        </View>
        {filas.map((par) => (
          <View key={par[0]} style={estilos.filaServicios}>
            {par.map((n) => (
              <TarjetaServicio
                key={n} nombre={n} activa={n === categoria}
                alTocar={() => {
                  setCategoria(n);
                  setVeterinario(null);
                }}
              />
            ))}
            {par.length === 1 ? <View style={{ flex: 1, margin: 5 }} /> : null}
          </View>
        ))}
      </View>
    );
  };

  const paso1 = (
    <View>
      <Seccion titulo="¿Qué servicio o especialidad necesitás?" />
      <Campo
        estilo={{ marginTop: 12 }} icono="buscar" placeholder="Buscar servicio o especialidad" value={filtroServicio}
        onChangeText={setFiltroServicio} returnKeyType="search" autoCorrect={false}
      />
      <View style={{ marginTop: 6 }}>
        {seccionServicios("Servicios", "Atención y procedimientos de la clínica", CatalogoMedico.SERVICIOS)}
        {seccionServicios("Especialidades médicas", "Consultas con profesionales especializados", CatalogoMedico.ESPECIALIDADES)}
        {buscado !== "" &&
        ![...CatalogoMedico.SERVICIOS, ...CatalogoMedico.ESPECIALIDADES].some((n) => sinAcentos(n).includes(buscado)) ? (
          <Texto variante="subtitulo" centrado style={{ paddingVertical: 24 }}>No encontramos ningún servicio con ese nombre.</Texto>
        ) : null}
      </View>
      <Seccion titulo="¿Para quién es?" estilo={{ marginTop: 26 }} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ paddingVertical: 4 }}>
        {mascotasActivas.map((m) => (
          <ItemMascota
            key={m.id} nombre={m.nombre} inicial={m.inicial} fotoUri={m.fotoUri} fotoPath={m.fotoPath}
            activa={m.nombre === mascota} alTocar={() => setMascota(m.nombre)}
          />
        ))}
      </ScrollView>
    </View>
  );

  // ---------- Paso 2 ----------

  const elegibles = (() => {
    let filtrados = veterinariosElegibles();
    // Un turno viejo puede tener un servicio que nadie ofrece hoy: al editarlo se muestran todos los veterinarios
    if (edicion && filtrados.length === 0) filtrados = DuenoRepo.todosLosVeterinarios();
    return filtrados;
  })();

  const textoSinVeterinarios = (() => {
    if (elegibles.length > 0) return "";
    const delServicio = DuenoRepo.veterinariosPara(categoria);
    return delServicio.length > 0
      ? `Ningún veterinario que ofrezca ${categoria ?? "este servicio"} atiende ${animales()} por ahora. Probá con otro servicio o especialidad.`
      : `Ningún veterinario atiende ${categoria ?? "este servicio"} por ahora. Probá con otro servicio o especialidad.`;
  })();

  const elegirVeterinario = (v: VeterinarioAcceso) => {
    if (veterinario !== v.nombre) setSedeId(null);
    setVeterinario(v.nombre);
    setHora(null);
  };

  const elegirSede = (s: SedeVet) => {
    setSedeId(s.id);
    setHora(null);
  };

  const elegidoConVarias = elegibles.find((v) => v.nombre === veterinario);

  const horas = vet == null ? [] : DuenoRepo.horasDe(vet, fecha, duracion, sede);
  const noLibres = horas.filter(
    (h) => DuenoRepo.horaPasada(fecha, h) || DuenoRepo.estaOcupado(h, duracion, ocupadas) ||
      DuenoRepo.hayConflictoDeTurno(fecha, h, mascota, edicion, duracion),
  );
  const textoSinHoras =
    vet == null ? "Elegí un veterinario para ver sus horarios"
    : !DuenoRepo.trabajaEl(vet, fecha, sede) ? `${vet.nombre} no atiende ese día` + (vet.sedes.length > 1 ? ` en ${sede?.nombre}` : "")
    : horas.length === 0
      ? `${categoria ?? "Este servicio"} dura ${CatalogoMedico.textoDuracion(duracion)} y no entra en el horario de atención de ${vet.nombre} (${sede?.apertura ?? vet.apertura} a ${sede?.cierre ?? vet.cierre} hs)`
      : "";
  const horaActiva = hora != null && !noLibres.includes(hora) ? hora : null;

  const conEdicionVet = edicion ? edicion.veterinario.trim() : "";
  const textoTurnoActual = edicion
    ? `Turno actual de ${edicion.mascota}\n${edicion.categoria} · ${Fechas.larga(edicion.fecha)} de ${edicion.hora} a ${DuenoRepo.horaFin(edicion.hora, edicion.duracionMin)} hs` +
      (conEdicionVet ? ` con ${conEdicionVet}` : "")
    : "";

  const paso2 = (
    <View>
      {edicion ? (
        <View style={estilos.banner}>
          <Texto variante="cuerpo" tamano={13.5} color={Colores.tealDark}>{textoTurnoActual}</Texto>
        </View>
      ) : null}
      <Seccion titulo="Veterinario" />
      <View style={{ marginTop: 10 }}>
        {elegibles.length === 0 ? (
          <View style={estilos.cajaSinVet}><Texto variante="subtitulo" tamano={14}>{textoSinVeterinarios}</Texto></View>
        ) : (
          elegibles.map((v) => {
            const seleccionado = v.nombre === veterinario;
            return (
              <Tarjeta
                key={v.nombre} onPress={() => elegirVeterinario(v)} seleccionada={seleccionado} relleno={14}
                estilo={{ marginBottom: 10 }} accessibilityLabel={v.nombre}
              >
                <View style={estilos.fila}>
                  <Avatar nombre={v.nombre} fotoPath={v.fotoPath} tamano={44} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Texto variante="cuerpo" peso="bold">{v.nombre}</Texto>
                    <Texto variante="chico">
                      {`${v.matricula} · ${textoEstadoVeterinario(v.estado)}\nTurno de ${CatalogoMedico.textoDuracion(v.duracionDe(categoria))}`}
                    </Texto>
                  </View>
                  <Icono nombre={seleccionado ? "checkCirculo" : "chevronDerecha"} tamano={24} color={seleccionado ? Colores.primaryTeal : Colores.textGray} />
                </View>
              </Tarjeta>
            );
          })
        )}
        {elegidoConVarias && elegidoConVarias.sedes.length > 1 ? (
          <View>
            <Texto variante="cuerpo" peso="bold" style={{ marginTop: 16, marginBottom: 4 }}>
              {`¿Dónde querés atenderte con ${elegidoConVarias.nombre}?`}
            </Texto>
            {elegidoConVarias.sedes.map((s) => (
              <Tarjeta
                key={s.id} onPress={() => elegirSede(s)} seleccionada={elegidoConVarias.sede(sedeId)?.id === s.id}
                relleno={14} estilo={{ marginTop: 8 }} accessibilityLabel={s.nombre}
              >
                <Texto variante="cuerpo" peso="bold">{s.nombre}</Texto>
                <Texto variante="chico">{[s.direccion, textoHorarioSede(s)].filter((x) => x.trim() !== "").join("\n")}</Texto>
              </Tarjeta>
            ))}
          </View>
        ) : null}
      </View>

      <Seccion titulo="Fecha" estilo={{ marginTop: 22 }} />
      <CampoElegir icono="calendario" texto={`${Fechas.diaSemana(fecha)} ${Fechas.larga(fecha)}`} etiqueta="Elegir la fecha" alTocar={() => setSelectorFecha(true)} />

      <Seccion titulo="Hora" estilo={{ marginTop: 22 }} />
      {vet != null && horas.length > 0 ? (
        <View style={estilos.duracion}>
          <Texto variante="cuerpo" tamano={13} color={Colores.tealDark}>
            {hora == null
              ? `Este turno dura ${CatalogoMedico.textoDuracion(duracion)}. Cada horario muestra cuándo arranca.`
              : `Este turno dura ${CatalogoMedico.textoDuracion(duracion)}: de ${hora} a ${DuenoRepo.horaFin(hora, duracion)} hs.`}
          </Texto>
        </View>
      ) : null}
      {horas.length > 0 ? (
        <CampoElegir icono="reloj" texto={horaActiva ?? "Elegí un horario"} etiqueta="Elegir el horario" alTocar={() => setSelectorHora(true)} />
      ) : (
        <Texto variante="subtitulo" tamano={14} style={{ marginTop: 10 }}>{textoSinHoras}</Texto>
      )}

      <Seccion titulo="Observaciones (opcional)" estilo={{ marginTop: 22 }} />
      <Campo
        estilo={{ marginTop: 10 }} multilinea placeholder="Ej: llevar el carnet de vacunación" value={observaciones}
        onChangeText={setObservaciones} autoCapitalize="sentences" accessibilityLabel="Observaciones"
      />
    </View>
  );

  // ---------- Paso 3: estudios y resumen ----------

  /** Lista los estudios que la mascota ya tiene en la ficha para marcar los que hagan falta. */
  const elegirEstudioCargado = async () => {
    const m = mascotaElegida;
    if (!m || cargandoEstudios) return;
    setCargandoEstudios(true);
    try {
      let disponibles: EstudioAdjunto[];
      try {
        disponibles = await DuenoRepo.estudiosDisponibles(m);
      } catch {
        Avisos.error("No pudimos traer los estudios cargados. Revisá tu conexión.");
        return;
      }
      const faltan = disponibles.filter((d) => !estudios.some((e) => e.ruta === d.ruta));
      if (faltan.length === 0) {
        toast(`${m.nombre} no tiene estudios cargados todavía. Podés subir uno nuevo.`);
        return;
      }
      setMarcados(new Set());
      setEstudiosCargados(faltan);
    } finally {
      setCargandoEstudios(false);
    }
  };

  const adjuntarMarcados = () => {
    const lista = estudiosCargados ?? [];
    setEstudios((actuales) => [...actuales, ...lista.filter((x) => marcados.has(x.ruta))]);
    setEstudiosCargados(null);
  };

  /** Sube un estudio nuevo a la ficha de la mascota y lo deja adjunto a este turno. */
  const subirEstudioNuevo = async () => {
    if (!mascotaElegida) return;
    const elegido = await ArchivosUi.elegir();
    if (elegido) setArchivoNuevo(elegido);
  };

  const subirConTipo = async (tipo: string) => {
    const elegido = archivoNuevo;
    const m = mascotaElegida;
    setArchivoNuevo(null);
    if (!elegido || !m) return;
    try {
      const estudio = await DuenoRepo.subirEstudio(m, tipo, elegido.nombre, elegido.extension, elegido.bytes, elegido.mime);
      setEstudios((actuales) => [...actuales, estudio]);
      toast(`${tipo} subido y adjunto al turno`);
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
    }
  };

  const lugar = vet && vet.sedes.length > 1 ? sede : null;
  const duracionResumen = duracion;

  const paso3 = (
    <View>
      <Seccion titulo="Revisá los datos del turno" />
      <LinearGradient colors={["#02797A", "#17A58F"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={estilos.hero}>
        <Texto variante="titulo" tamano={22} color={Colores.white}>{categoria ?? ""}</Texto>
        <View style={[estilos.fila, { marginTop: 2 }]}>
          <Icono nombre="perro" tamano={18} color={Colores.white} />
          <Texto variante="cuerpo" color="#F2FFFFFF" style={{ marginLeft: 8 }}>{mascota ?? ""}</Texto>
        </View>
        <View style={[estilos.fila, { marginTop: 16, flexWrap: "wrap", gap: 8 }]}>
          <View style={estilos.chipVidrio}>
            <Icono nombre="calendario" tamano={16} color={Colores.white} />
            <Texto variante="etiqueta" tamano={13} color={Colores.white} style={{ marginLeft: 6 }}>
              {`${fecha.dayOfMonth} de ${Fechas.nombreMes(fecha.monthValue)}, ${fecha.year}`}
            </Texto>
          </View>
          <View style={estilos.chipVidrio}>
            <Icono nombre="reloj" tamano={16} color={Colores.white} />
            <Texto variante="etiqueta" tamano={13} color={Colores.white} style={{ marginLeft: 6 }}>
              {`${hora ?? ""} a ${DuenoRepo.horaFin(hora ?? "00:00", duracionResumen)} hs · ${CatalogoMedico.textoDuracion(duracionResumen)}`}
            </Texto>
          </View>
        </View>
      </LinearGradient>

      <Tarjeta relleno={16} estilo={{ marginTop: 14, paddingVertical: 4 }}>
        <FilaResumen icono="veterinario" etiqueta="Veterinario" valor={(veterinario ?? "") + (lugar ? `\n${textoLugarSede(lugar)}` : "")} />
        <FilaResumen icono="documento" etiqueta="Observaciones" valor={observaciones === "" ? "Sin observaciones" : observaciones} divisor />
      </Tarjeta>

      <Seccion titulo="Estudios previos (opcional)" estilo={{ marginTop: 22 }} />
      <Tarjeta relleno={16} estilo={{ marginTop: 10 }}>
        {estudios.length === 0 ? (
          <Texto variante="subtitulo" tamano={13.5} style={{ paddingVertical: 6 }}>
            Si para este turno hace falta un estudio anterior, adjuntalo y el veterinario lo va a ver.
          </Texto>
        ) : (
          estudios.map((e) => (
            <Pressable
              key={e.ruta} accessibilityRole="button" accessibilityLabel={`Quitar ${e.nombre}`}
              onPress={() => setEstudios((a) => a.filter((x) => x !== e))} style={[estilos.fila, { paddingVertical: 8 }, cursorTocable]}
            >
              <View style={[estilos.cajaIcono, { width: 38, height: 38 }]}><Icono nombre="documento" tamano={20} color={Colores.primaryTeal} /></View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Texto variante="chico" tamano={12}>{`${e.tipo} · ${e.extension.toUpperCase()}`}</Texto>
                <Texto variante="cuerpo" peso="medium" numberOfLines={2}>{e.nombre}</Texto>
              </View>
              <Texto variante="etiqueta" color={Colores.dangerRed}>Quitar</Texto>
            </Pressable>
          ))
        )}
      </Tarjeta>
      <View style={[estilos.fila, { marginTop: 10, gap: 12 }]}>
        <Boton titulo="Elegir uno cargado" variante="secundario" alto={48} estilo={{ flex: 1 }} cargando={cargandoEstudios} onPress={() => void elegirEstudioCargado()} />
        <Boton titulo="Subir uno nuevo" variante="secundario" alto={48} estilo={{ flex: 1 }} onPress={() => void subirEstudioNuevo()} />
      </View>

      <View style={[estilos.banner, estilos.fila, { marginTop: 14, marginBottom: 0 }]}>
        <Icono nombre="checkCirculo" tamano={22} color={Colores.primaryTeal} />
        <Texto variante="cuerpo" tamano={13.5} color={Colores.tealDark} style={{ flex: 1, marginLeft: 12 }}>
          {`${veterinario} va a poder ver la ficha de ${mascota} apenas confirmes el turno. No hace falta autorizarlo.`}
        </Texto>
      </View>
    </View>
  );

  // ---------- Pantalla ----------

  const titulo = edicion ? "Editar turno" : "Nuevo evento";
  const subtitulo = edicion ? "Elegí otro veterinario, día u horario" : SUBTITULOS_PASO[paso - 1];
  const textoAtras = paso === 1 || edicion ? "Cancelar" : "Atrás";
  const textoSiguiente = edicion ? "Guardar cambios" : paso === 3 ? "Guardar Evento" : "Siguiente";

  return (
    <PantallaBase
      titulo={titulo}
      subtitulo={subtitulo}
      alVolver={() => NavDueno.irACalendario()}
      pie={
        <View style={estilos.fila}>
          <Boton titulo={textoAtras} variante="secundario" estilo={{ flex: 1, marginRight: 10 }} onPress={alAtras} />
          <Boton titulo={textoSiguiente} estilo={{ flex: 1.4 }} onPress={alSiguiente} />
        </View>
      }
    >
      {!edicion ? (
        <View style={estilos.stepper} accessibilityLabel={`Paso ${paso} de 3`}>
          {[1, 2, 3].map((n) => {
            const activo = n === paso;
            const completado = n < paso;
            return (
              <View key={n} style={estilos.pasoGrupo}>
                {n > 1 ? <View style={[estilos.linea, n - 1 < paso ? { backgroundColor: Colores.primaryTeal } : null]} /> : null}
                <View style={{ alignItems: "center" }}>
                  <View style={[estilos.circuloPaso, completado ? estilos.pasoHecho : activo ? estilos.pasoActual : estilos.pasoPendiente]}>
                    <Texto variante="etiqueta" tamano={14} color={completado ? Colores.white : activo ? Colores.primaryTeal : Colores.textGray}>
                      {completado ? "✓" : String(n)}
                    </Texto>
                  </View>
                  <Texto variante="etiqueta" tamano={12} color={activo || completado ? Colores.primaryTeal : Colores.textGray} style={{ marginTop: 6 }}>
                    {ETIQUETAS_PASO[n - 1]}
                  </Texto>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      <Animated.View style={[{ marginTop: 12 }, entrada]}>{paso === 1 ? paso1 : paso === 2 ? paso2 : paso3}</Animated.View>

      <SelectorFecha
        visible={selectorFecha}
        valor={fecha}
        minima={LocalDate.now()}
        diaHabilitado={(d) => vet == null || DuenoRepo.trabajaEl(vet, d, sede)}
        alTocarBloqueado={() => toast(`${vet?.nombre} no atiende ese día` + ((vet?.sedes.length ?? 0) > 1 ? " en ese lugar" : ""))}
        leyendaBloqueado="No atiende"
        alElegir={(d) => {
          setFecha(d);
          setHora(null);
        }}
        alCerrar={() => setSelectorFecha(false)}
      />
      <SelectorHora
        visible={selectorHora}
        horarios={horas}
        valor={horaActiva}
        ocupados={noLibres}
        alTocarOcupado={(h) => toast(DuenoRepo.horaPasada(fecha, h) ? "Ese horario ya pasó" : "Ese horario no está disponible")}
        alElegir={setHora}
        alCerrar={() => setSelectorHora(false)}
      />

      <DialogoCentral visible={estudiosCargados != null} alCerrar={() => setEstudiosCargados(null)}>
        <Texto variante="titulo" tamano={18} accessibilityRole="header">{`Estudios de ${mascotaElegida?.nombre ?? ""}`}</Texto>
        <ScrollView style={{ marginTop: 12, maxHeight: 320 }}>
          {(estudiosCargados ?? []).map((e) => {
            const marcado = marcados.has(e.ruta);
            return (
              <Pressable
                key={e.ruta} accessibilityRole="checkbox" accessibilityState={{ checked: marcado }}
                accessibilityLabel={`${e.nombre} (${e.extension.toUpperCase()})`}
                onPress={() =>
                  setMarcados((a) => {
                    const n = new Set(a);
                    if (n.has(e.ruta)) n.delete(e.ruta);
                    else n.add(e.ruta);
                    return n;
                  })
                }
                style={[estilos.fila, { paddingVertical: 10 }, cursorTocable]}
              >
                <Icono nombre={marcado ? "checkCirculo" : "cancelar"} tamano={22} color={marcado ? Colores.primaryTeal : Colores.dividerColor} />
                <Texto variante="cuerpo" style={{ flex: 1, marginLeft: 12 }}>{`${e.nombre} (${e.extension.toUpperCase()})`}</Texto>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={[estilos.fila, { marginTop: 16, gap: 10 }]}>
          <Boton titulo="Cancelar" variante="secundario" estilo={{ flex: 1 }} onPress={() => setEstudiosCargados(null)} />
          <Boton titulo="Adjuntar" estilo={{ flex: 1 }} onPress={adjuntarMarcados} />
        </View>
      </DialogoCentral>

      <DialogoCentral visible={archivoNuevo != null} alCerrar={() => setArchivoNuevo(null)}>
        <Texto variante="titulo" tamano={18} accessibilityRole="header">¿Qué tipo de estudio es?</Texto>
        <ScrollView style={{ marginTop: 8, maxHeight: 360 }}>
          {DuenoRepo.TIPOS_ESTUDIO.map((t) => (
            <Pressable key={t} accessibilityRole="button" accessibilityLabel={t} onPress={() => void subirConTipo(t)} style={[estilos.opcionTipo, cursorTocable]}>
              <Texto variante="cuerpo">{t}</Texto>
            </Pressable>
          ))}
        </ScrollView>
        <Boton titulo="Cancelar" variante="texto" estilo={{ marginTop: 8 }} onPress={() => setArchivoNuevo(null)} />
      </DialogoCentral>
    </PantallaBase>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center" },
  centrado: { alignItems: "center" },
  stepper: { flexDirection: "row", marginHorizontal: 8, marginTop: 14, alignItems: "flex-start" },
  pasoGrupo: { flexDirection: "row", alignItems: "flex-start", flexGrow: 0 },
  linea: { height: 3, width: 70, marginHorizontal: 8, marginTop: 16, backgroundColor: "#E6EAE9", flexShrink: 1 },
  circuloPaso: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  pasoHecho: { backgroundColor: Colores.primaryTeal },
  pasoActual: { backgroundColor: Colores.white, borderWidth: 3, borderColor: Colores.primaryTeal },
  pasoPendiente: { backgroundColor: "#E6EAE9" },
  tarjetaServicio: { flex: 1, margin: 5 },
  filaServicios: { flexDirection: "row", alignItems: "stretch" },
  circuloServicio: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  tilde: { position: "absolute", top: 8, right: 8 },
  contador: { width: 30, height: 30, borderRadius: 15, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
  itemMascota: { width: 78, alignItems: "center", marginRight: 6 },
  marcoMascota: { width: 66, height: 66, borderRadius: 33, padding: 3, backgroundColor: Colores.white },
  marcoActivo: { borderWidth: 3, padding: 0, borderColor: Colores.primaryTeal },
  fotoMascota: { width: "100%", height: "100%", borderRadius: 33, backgroundColor: Colores.lightTeal },
  cajaIcono: { width: 44, height: 44, borderRadius: 14, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
  banner: { backgroundColor: "#E3F3F1", borderRadius: 16, padding: 14, marginBottom: 18 },
  cajaSinVet: { backgroundColor: Colores.white, borderRadius: 16, borderWidth: 1, borderColor: Colores.loginFieldStroke, padding: 16 },
  duracion: { backgroundColor: Colores.lightTeal, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginTop: 6 },
  hero: { borderRadius: 22, padding: 20, marginTop: 12 },
  chipVidrio: { flexDirection: "row", alignItems: "center", backgroundColor: "#33FFFFFF", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6 },
  divisor: { height: 1, marginLeft: 50, backgroundColor: Colores.dividerLight },
  opcionTipo: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colores.dividerLight },
});
