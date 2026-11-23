/*
 * Migrado de ui/dueno/CarnetSaludActivity.kt (+ activity_carnet_salud.xml, item_registro_salud.xml).
 * Vacunas, desparasitaciones, tratamientos, cirugías y documentos de las mascotas, con búsqueda y filtro por
 * mascota. Es una pantalla aparte (sin barra inferior). El Kotlin también la usaba el veterinario con sus
 * pacientes: se conserva (`Sesion.rol`).
 *
 * Desvíos: el `AlertDialog` de "Agregar" es una hoja inferior con los mismos campos (las fechas usan el
 * `SelectorFecha` del kit en vez del `DatePickerDialog`) y las pestañas del `TabLayout` son una fila de pestañas.
 */
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { ArchivosRepo } from "../../data/repositorio/archivosRepo";
import { DuenoRepo } from "../../data/repositorio/duenoRepo";
import { PacientesRepo } from "../../data/repositorio/pacientesRepo";
import {
  SaludRepo, TIPOS_REGISTRO, TiposRegistro, type RegistroSalud, type TipoRegistro,
} from "../../data/repositorio/saludRepo";
import { Servicios } from "../../data/servicios";
import { Sesion } from "../../data/sesion";
import { Errores } from "../../util/errores";
import { Fechas } from "../../util/fechas";
import { LocalDate } from "../../util/tiempo";
import { nuevoId } from "../../util/uuid";
import { ArchivosUi, TAMANO_MAXIMO, type ArchivoElegido } from "../common/ArchivosUi";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { BotonIcono } from "../common/BotonIcono";
import { Campo } from "../common/Campo";
import { EstadoVacio } from "../common/EstadoVacio";
import { HojaInferior } from "../common/HojaInferior";
import { HojaLista } from "../common/HojaLista";
import { Icono, type NombreIcono } from "../common/Icono";
import { PantallaBase } from "../common/PantallaBase";
import { SelectorFecha } from "../common/SelectorFecha";
import { Tarjeta } from "../common/Tarjeta";
import { Texto } from "../common/Texto";
import { Colores, sombra } from "../common/tema";
import { useDatos } from "../common/useDatos";
import { useSesionRequerida } from "../common/useSesionRequerida";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { Imagenes } from "../../data/imagenes";
import { elegirImagen } from "../common/Selectores";
import { router } from "expo-router";
import { ICONO_TIPO_REGISTRO, RegistroSaludFila } from "./RegistroSaludFila";

interface MascotaCarnet {
  id: string;
  nombre: string;
  tipo: string;
}

const ICONOS_TIPO: Record<string, NombreIcono> = {
  Perro: "perro", Gato: "gato", Ave: "ave", Reptil: "reptil", Pez: "pez", Roedor: "roedor",
};

function iconoDeTipo(tipo: string): NombreIcono {
  return ICONOS_TIPO[tipo] ?? "mascotas";
}

/** Las mascotas del carnet: las del dueño en sesión o los pacientes del veterinario. */
export function mascotasDelCarnet(): MascotaCarnet[] {
  return Sesion.rol === "DUENO"
    ? DuenoRepo.mascotas.map((m) => ({ id: m.id, nombre: m.nombre, tipo: m.tipo }))
    : PacientesRepo.pacientes.map((p) => ({ id: p.id, nombre: p.nombre, tipo: p.especie }));
}

/** Tipo MIME de una foto del carnet (el bucket solo acepta JPG, PNG y WebP): por la extensión o por los primeros bytes. */
export function tipoDeImagen(uri: string, bytes: Uint8Array): { mime: string; extension: string } | null {
  const ext = /\.([A-Za-z0-9]+)(?:[?#].*)?$/.exec(uri)?.[1]?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return { mime: "image/jpeg", extension: "jpg" };
  if (ext === "png") return { mime: "image/png", extension: "png" };
  if (ext === "webp") return { mime: "image/webp", extension: "webp" };
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return { mime: "image/jpeg", extension: "jpg" };
  if (bytes.length > 3 && bytes[0] === 0x89 && bytes[1] === 0x50) return { mime: "image/png", extension: "png" };
  if (bytes.length > 11 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57 && bytes[9] === 0x45) {
    return { mime: "image/webp", extension: "webp" };
  }
  return null;
}

function Pestana({ texto, activa, alTocar }: { texto: string; activa: boolean; alTocar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="tab" accessibilityLabel={texto} accessibilityState={{ selected: activa }} onPress={alTocar}
      {...foco.props} style={[estilos.pestana, activa ? estilos.pestanaActiva : null, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Texto variante="etiqueta" tamano={14} color={activa ? Colores.primaryTeal : Colores.textGray}>{texto}</Texto>
    </Pressable>
  );
}

function ChipMascota({ texto, activo, alTocar }: { texto: string; activo: boolean; alTocar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={texto} accessibilityState={{ selected: activo }} onPress={alTocar}
      {...foco.props} style={[estilos.chipMascota, activo ? estilos.chipActivo : null, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Texto variante="etiqueta" tamano={14} color={activo ? Colores.white : Colores.textGray}>{texto}</Texto>
    </Pressable>
  );
}

function Estadistica({ icono, fondo, color, valor, etiqueta }: { icono: NombreIcono; fondo: string; color: string; valor: number; etiqueta: string }) {
  return (
    <View style={estilos.estadistica}>
      <View style={[estilos.cajaEstadistica, { backgroundColor: fondo }]}><Icono nombre={icono} tamano={20} color={color} /></View>
      <Texto variante="titulo" tamano={22} style={{ marginTop: 6 }}>{String(valor)}</Texto>
      <Texto variante="chico" tamano={12} centrado>{etiqueta}</Texto>
    </View>
  );
}

/** Campo que muestra una fecha y abre el selector de fechas. */
function CampoFecha({ etiqueta, valor, error, alTocar }: { etiqueta: string; valor: LocalDate | null; error?: string | null; alTocar: () => void }) {
  return (
    <View style={{ marginTop: 12 }}>
      <Tarjeta onPress={alTocar} relleno={14} accessibilityLabel={etiqueta} estilo={error ? { borderColor: Colores.dangerRed } : null}>
        <View style={estilos.fila}>
          <Icono nombre="calendario" tamano={22} color={Colores.textGray} />
          <Texto variante="cuerpo" color={valor ? Colores.brandNavy : Colores.textGray} style={{ marginLeft: 12, flex: 1 }}>
            {valor ? Fechas.corta(valor) : etiqueta}
          </Texto>
        </View>
      </Tarjeta>
      {error ? <Texto variante="chico" color={Colores.dangerRed} style={{ marginTop: 4, marginLeft: 8 }}>{error}</Texto> : null}
    </View>
  );
}

type CampoDeFecha = "fecha" | "proxima" | "venceLote";

export default function CarnetSaludPantalla() {
  const sesionLista = useSesionRequerida();
  useDatos();
  const [version, setVersion] = useState(0);
  const refrescar = () => setVersion((v) => v + 1);
  void version;

  const [tipo, setTipo] = useState<TipoRegistro>("VACUNA");
  const [consulta, setConsulta] = useState("");
  const [mascotaFiltro, setMascotaFiltro] = useState<string | null>(null);
  const [hojaMascotas, setHojaMascotas] = useState(false);
  const mascotaDestino = useRef<string | null>(null);

  // Hoja "Agregar"
  const [agregando, setAgregando] = useState(false);
  const [mascotaElegida, setMascotaElegida] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [fecha, setFecha] = useState<LocalDate | null>(null);
  const [extra, setExtra] = useState("");
  const [proxima, setProxima] = useState<LocalDate | null>(null);
  const [marca, setMarca] = useState("");
  const [lote, setLote] = useState("");
  const [venceLote, setVenceLote] = useState<LocalDate | null>(null);
  const [archivo, setArchivo] = useState<ArchivoElegido | null>(null);
  const [errorTitulo, setErrorTitulo] = useState<string | null>(null);
  const [errorFecha, setErrorFecha] = useState<string | null>(null);
  const [selectorDe, setSelectorDe] = useState<CampoDeFecha | null>(null);

  // El carnet del dueño no se carga al ingresar: se pide al abrir la pantalla
  useEffect(() => {
    if (!sesionLista || Sesion.rol !== "DUENO") return;
    let vigente = true;
    void (async () => {
      try {
        await SaludRepo.cargarComoDueno();
      } catch (e) {
        Avisos.error(Errores.mensaje(e));
      }
      if (vigente) refrescar();
    })();
    return () => {
      vigente = false;
    };
    // Una sola vez al abrir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sesionLista]);

  const mascotas = mascotasDelCarnet();
  const lista = SaludRepo.filtrar(tipo, consulta, mascotaFiltro);
  const vacunas = SaludRepo.registros.filter((r) => TiposRegistro[r.tipo].conProximaDosis);
  const alDia = vacunas.filter((r) => r.estado === "Al día").length;
  const porRenovar = vacunas.filter((r) => r.estado === "Próxima" || r.estado === "Vencida").length;
  const documentos = SaludRepo.registros.filter((r) => r.tipo === "DOCUMENTO").length;

  const abrirDocumento = (r: RegistroSalud) => {
    const ruta = r.archivoPath;
    if (!ruta) return;
    const despuesDelPunto = r.detalle.includes(".") ? r.detalle.slice(r.detalle.lastIndexOf(".") + 1) : r.detalle.split(" ")[0];
    void ArchivosUi.abrir("archivos", ruta, despuesDelPunto);
  };

  const confirmarEliminar = (r: RegistroSalud) => {
    if (r.deConsulta) {
      Avisos.informar({
        titulo: "Indicado en la consulta",
        mensaje: "Este tratamiento lo indicó el veterinario en su informe, así que no se puede borrar desde el carnet.",
        icono: "info",
      });
      return;
    }
    Avisos.confirmar({
      titulo: "¿Eliminar el registro?",
      mensaje: `Se borra "${r.titulo}" del carnet. No se puede deshacer.`,
      textoAceptar: "Eliminar",
      textoCancelar: "Cancelar",
      alAceptar: () => {
        SaludRepo.eliminar(r);
        refrescar();
      },
    });
  };

  // ---------- Foto de la libreta de vacunas ----------

  const registroCarnet = (() => {
    if (tipo !== "VACUNA") return null;
    return SaludRepo.registros.find(
      (r) => r.tipo === "DOCUMENTO" && r.titulo.toLowerCase().includes("carnet de vacunas") && (mascotaFiltro == null || r.mascotaId === mascotaFiltro),
    ) ?? null;
  })();
  const nombreMascotaFiltro = mascotas.find((m) => m.id === mascotaFiltro)?.nombre;
  const hayCarnet = registroCarnet != null && !!registroCarnet.archivoPath?.trim();
  const textosCarnet =
    mascotaFiltro == null
      ? {
          titulo: "Carnet / Calendario de Vacunas Físico",
          subtitulo: hayCarnet ? `Carnet registrado para ${registroCarnet?.mascota}` : "Seleccioná una mascota o tocá para subir su carnet físico",
          boton: hayCarnet ? "Cargar otro" : "+ Cargar carnet",
        }
      : {
          titulo: `Carnet de Vacunas de ${nombreMascotaFiltro}`,
          subtitulo: hayCarnet
            ? `Libreta/Calendario de vacunas cargado (${registroCarnet?.fecha})`
            : `Sin foto de libreta física cargada para ${nombreMascotaFiltro}`,
          boton: hayCarnet ? "Cambiar" : "+ Cargar foto",
        };

  const pedirFotoCarnetVacunas = () => {
    if (mascotas.length === 0) {
      Avisos.mostrar("No hay mascotas registradas para subir el carnet");
      return;
    }
    if (mascotaFiltro != null && mascotaFiltro.trim() !== "") {
      mascotaDestino.current = mascotaFiltro;
      void elegirFotoCarnet();
      return;
    }
    setHojaMascotas(true);
  };

  const elegirFotoCarnet = async () => {
    const uri = await elegirImagen();
    if (uri) await subirFotoCarnetVacunas(uri);
  };

  const subirFotoCarnetVacunas = async (uri: string) => {
    const pacienteId = mascotaDestino.current ?? mascotaFiltro ?? mascotas[0]?.id ?? null;
    if (pacienteId == null) {
      Avisos.mostrar("Elegí una mascota para subir la foto de su carnet");
      return;
    }
    const nombreMascota = mascotas.find((m) => m.id === pacienteId)?.nombre ?? "";
    const tituloRegistro = nombreMascota.trim() !== "" ? `Carnet de vacunas - ${nombreMascota}` : "Carnet de vacunas (foto)";
    try {
      let bytes: Uint8Array;
      try {
        bytes = await Imagenes.bytesDe(uri);
      } catch {
        throw new Error("No se pudo leer la imagen");
      }
      const tipoFoto = tipoDeImagen(uri, bytes);
      if (!tipoFoto) {
        Avisos.mostrar("La foto del carnet tiene que ser JPG, PNG o WebP");
        return;
      }
      if (bytes.length > TAMANO_MAXIMO) {
        Avisos.mostrar("La imagen supera los 15 MB");
        return;
      }
      // Cada carga va a una ruta propia: así borrar el carnet anterior nunca se lleva el nuevo
      const ruta = `${pacienteId}/${nuevoId()}.${tipoFoto.extension}`;
      await Servicios.fuente.subir(ArchivosRepo.BUCKET, ruta, bytes, tipoFoto.mime);
      const existente = SaludRepo.registros.find(
        (r) => r.tipo === "DOCUMENTO" && r.titulo.toLowerCase().includes("carnet de vacunas") && r.mascotaId === pacienteId,
      );
      if (existente) SaludRepo.eliminar(existente);
      SaludRepo.agregar("DOCUMENTO", pacienteId, tituloRegistro, "Libreta / Calendario de vacunas físico", LocalDate.now(), null, null, ruta);
      refrescar();
      Avisos.mostrar("Foto del carnet de vacunas guardada");
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
    }
  };

  // ---------- Agregar un registro ----------

  const abrirAgregar = () => {
    setMascotaElegida(mascotaFiltro != null && mascotas.some((m) => m.id === mascotaFiltro) ? mascotaFiltro : (mascotas[0]?.id ?? null));
    setTitulo("");
    setFecha(null);
    setExtra("");
    setProxima(null);
    setMarca("");
    setLote("");
    setVenceLote(null);
    setArchivo(null);
    setErrorTitulo(null);
    setErrorFecha(null);
    setAgregando(true);
  };

  /** Sube el documento al bucket `archivos` y recién entonces lo suma al carnet. */
  const subirDocumento = async (mascotaId: string, tituloDoc: string, a: ArchivoElegido, dia: LocalDate) => {
    try {
      const ruta = `${mascotaId}/${nuevoId()}.${a.extension}`;
      await Servicios.fuente.subir(ArchivosRepo.BUCKET, ruta, a.bytes, a.mime);
      SaludRepo.agregar("DOCUMENTO", mascotaId, tituloDoc, a.nombre, dia, null, null, ruta);
      refrescar();
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
    }
  };

  const seleccionarArchivo = async () => {
    const elegido = await ArchivosUi.elegir();
    if (!elegido) return;
    setArchivo(elegido);
    if (titulo.trim() === "") setTitulo(elegido.nombre);
  };

  const guardar = () => {
    const tituloLimpio = titulo.trim();
    if (tituloLimpio === "") {
      setErrorTitulo("Requerido");
      return;
    }
    if (tipo !== "DOCUMENTO" && fecha == null) {
      setErrorFecha("Requerido");
      return;
    }
    if (tipo === "DOCUMENTO" && archivo == null) {
      Avisos.mostrar("Seleccioná un archivo");
      return;
    }
    const paciente = mascotas.find((m) => m.id === mascotaElegida);
    if (!paciente) {
      Avisos.mostrar("Elegí una mascota");
      return;
    }
    const extraLimpio = extra.trim();
    const fechaElegida = fecha ?? LocalDate.now();
    const oNull = (t: string) => (t.trim() === "" ? null : t.trim());
    switch (tipo) {
      case "VACUNA":
        SaludRepo.agregar(tipo, paciente.id, tituloLimpio, null, fechaElegida, null, proxima, null, oNull(marca), oNull(lote), venceLote);
        break;
      case "DESPARASITACION":
        SaludRepo.agregar(tipo, paciente.id, tituloLimpio, null, fechaElegida, null, proxima, null, oNull(marca));
        break;
      case "TRATAMIENTO":
        SaludRepo.agregar(tipo, paciente.id, tituloLimpio, extraLimpio === "" ? "Sin indicaciones" : extraLimpio, fechaElegida);
        break;
      case "CIRUGIA":
        SaludRepo.agregar(tipo, paciente.id, tituloLimpio, extraLimpio === "" ? "Sin detalles" : extraLimpio, fechaElegida);
        break;
      case "DOCUMENTO":
        void subirDocumento(paciente.id, tituloLimpio, archivo as ArchivoElegido, fechaElegida);
        break;
    }
    refrescar();
    setAgregando(false);
  };

  const hintTitulo: Record<TipoRegistro, string> = {
    VACUNA: "Vacuna (ej: Antirrábica)",
    DESPARASITACION: "Desparasitación (ej: Interna)",
    TRATAMIENTO: "Medicamento / tratamiento",
    CIRUGIA: "Cirugía (ej: Castración)",
    DOCUMENTO: "Nombre del documento",
  };

  const elegirFechaDe = (campo: CampoDeFecha) => (d: LocalDate) => {
    if (campo === "fecha") {
      setFecha(d);
      setErrorFecha(null);
    } else if (campo === "proxima") setProxima(d);
    else setVenceLote(d);
  };

  const filasHoja = mascotas.map((m) => ({
    titulo: m.nombre,
    subtitulo: m.tipo,
    icono: iconoDeTipo(m.tipo),
    alTocar: () => {
      mascotaDestino.current = m.id;
      void elegirFotoCarnet();
    },
  }));

  const etiqueta = TiposRegistro[tipo].etiqueta.toLowerCase();

  return (
    <PantallaBase
      titulo="Salud"
      subtitulo="Vacunas, tratamientos y documentos"
      alVolver={() => router.back()}
      derecha={<BotonIcono icono="mas" accessibilityLabel="Agregar registro" onPress={abrirAgregar} />}
    >
      <View style={estilos.resumen}>
        <Estadistica icono="checkCirculo" fondo={Colores.lightGreen} color={Colores.successGreen} valor={alDia} etiqueta="Vacunas al día" />
        <Estadistica icono="reloj" fondo={Colores.lightOrange} color={Colores.accentOrange} valor={porRenovar} etiqueta="Por renovar" />
        <Estadistica icono="documento" fondo={Colores.lightPurple} color={Colores.accentPurple} valor={documentos} etiqueta="Documentos" />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14, flexGrow: 0 }} accessibilityRole="tablist">
        {TIPOS_REGISTRO.map((t) => (
          <Pestana key={t} texto={TiposRegistro[t].etiqueta} activa={t === tipo} alTocar={() => setTipo(t)} />
        ))}
      </ScrollView>

      <Campo
        estilo={{ marginTop: 12 }} icono="buscar" placeholder="Buscar registro" value={consulta} onChangeText={setConsulta}
        returnKeyType="search" autoCorrect={false}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10, flexGrow: 0 }} contentContainerStyle={{ paddingVertical: 4 }}>
        <ChipMascota texto="Todas" activo={mascotaFiltro == null} alTocar={() => setMascotaFiltro(null)} />
        {mascotas.map((m) => (
          <ChipMascota key={m.id} texto={m.nombre} activo={mascotaFiltro === m.id} alTocar={() => setMascotaFiltro(m.id)} />
        ))}
      </ScrollView>

      {tipo === "VACUNA" ? (
        <Tarjeta relleno={14} estilo={{ marginTop: 10 }}>
          <View style={estilos.fila}>
            <View style={estilos.iconoCarnet}><Icono nombre="documento" tamano={22} color={Colores.primaryTeal} /></View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Texto variante="cuerpo" tamano={14} negrita color={Colores.black}>{textosCarnet.titulo}</Texto>
              <Texto variante="chico" tamano={12} style={{ marginTop: 2 }}>{textosCarnet.subtitulo}</Texto>
            </View>
          </View>
          <View style={estilos.botonesCarnet}>
            {hayCarnet ? (
              <Boton
                titulo="Ver carnet" variante="secundario" icono="buscar" alto={40}
                onPress={() => {
                  const ruta = registroCarnet?.archivoPath;
                  if (ruta) void ArchivosUi.abrir(ArchivosRepo.BUCKET, ruta, ruta.slice(ruta.lastIndexOf(".") + 1));
                }}
                estilo={{ alignSelf: "auto", marginRight: 8, paddingHorizontal: 8 }}
              />
            ) : null}
            <Boton titulo={textosCarnet.boton} alto={40} onPress={pedirFotoCarnetVacunas} estilo={{ alignSelf: "auto", paddingHorizontal: 8 }} />
          </View>
        </Tarjeta>
      ) : null}

      {lista.length === 0 ? (
        <EstadoVacio
          icono={ICONO_TIPO_REGISTRO[tipo]} titulo={`No hay ${etiqueta} para mostrar`} mensaje="Tocá + para agregar uno"
          estilo={{ marginTop: 24 }}
        />
      ) : (
        <View style={{ marginTop: 4 }}>
          {lista.map((r) => (
            <RegistroSaludFila key={r.id} registro={r} alTocar={abrirDocumento} alMantener={confirmarEliminar} />
          ))}
        </View>
      )}

      <HojaLista
        visible={hojaMascotas} alCerrar={() => setHojaMascotas(false)} titulo="¿De qué mascota es el carnet?"
        subtitulo="Elegí la mascota y después la foto de su libreta de vacunas." filas={filasHoja}
      />

      <HojaInferior
        visible={agregando} alCerrar={() => setAgregando(false)}
        pie={
          <View style={estilos.fila}>
            <Boton titulo="Cancelar" variante="secundario" estilo={{ flex: 1, marginRight: 10 }} onPress={() => setAgregando(false)} />
            <Boton titulo="Guardar" estilo={{ flex: 1 }} onPress={guardar} />
          </View>
        }
      >
        <Texto variante="titulo" tamano={20} accessibilityRole="header">{`Agregar ${TiposRegistro[tipo].singular}`}</Texto>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12, flexGrow: 0 }}>
          {mascotas.map((m) => (
            <ChipMascota key={m.id} texto={m.nombre} activo={mascotaElegida === m.id} alTocar={() => setMascotaElegida(m.id)} />
          ))}
        </ScrollView>
        <Campo
          estilo={{ marginTop: 12 }} placeholder={hintTitulo[tipo]} value={titulo} error={errorTitulo}
          onChangeText={(t) => {
            setTitulo(t);
            setErrorTitulo(null);
          }}
        />
        <CampoFecha etiqueta={tipo === "TRATAMIENTO" ? "Fecha de inicio" : "Fecha"} valor={fecha} error={errorFecha} alTocar={() => setSelectorDe("fecha")} />
        {tipo === "VACUNA" || tipo === "DESPARASITACION" ? (
          <CampoFecha etiqueta="Próxima dosis (opcional)" valor={proxima} alTocar={() => setSelectorDe("proxima")} />
        ) : null}
        {tipo === "TRATAMIENTO" ? <Campo estilo={{ marginTop: 12 }} placeholder="Dosis / indicaciones" value={extra} onChangeText={setExtra} /> : null}
        {tipo === "CIRUGIA" ? <Campo estilo={{ marginTop: 12 }} placeholder="Detalles (opcional)" value={extra} onChangeText={setExtra} /> : null}
        {TiposRegistro[tipo].conProximaDosis ? (
          <Campo estilo={{ marginTop: 12 }} placeholder="Marca / producto (opcional)" value={marca} onChangeText={setMarca} />
        ) : null}
        {tipo === "VACUNA" ? (
          <>
            <Campo estilo={{ marginTop: 12 }} placeholder="Lote (opcional)" value={lote} onChangeText={setLote} />
            <CampoFecha etiqueta="Vencimiento del lote (opcional)" valor={venceLote} alTocar={() => setSelectorDe("venceLote")} />
          </>
        ) : null}
        {tipo === "DOCUMENTO" ? (
          <View style={{ marginTop: 12 }}>
            <Boton titulo="Seleccionar archivo" variante="secundario" icono="archivo" onPress={() => void seleccionarArchivo()} />
            <Texto variante="subtitulo" tamano={14} style={{ marginTop: 8 }}>{archivo ? archivo.nombre : "Ningún archivo seleccionado"}</Texto>
          </View>
        ) : null}
      </HojaInferior>

      <SelectorFecha
        visible={selectorDe != null}
        valor={selectorDe === "fecha" ? fecha : selectorDe === "proxima" ? proxima : venceLote}
        alElegir={(d) => (selectorDe ? elegirFechaDe(selectorDe)(d) : undefined)}
        alCerrar={() => setSelectorDe(null)}
      />
    </PantallaBase>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center" },
  resumen: { flexDirection: "row", gap: 10, marginTop: 8 },
  estadistica: { flex: 1, alignItems: "center", backgroundColor: Colores.white, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 6, ...sombra(1) },
  cajaEstadistica: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  pestana: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 3, borderBottomColor: "transparent" },
  pestanaActiva: { borderBottomColor: Colores.primaryTeal },
  chipMascota: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 22, backgroundColor: Colores.white, marginRight: 10, ...sombra(1) },
  chipActivo: { backgroundColor: Colores.primaryTeal },
  iconoCarnet: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
  botonesCarnet: { flexDirection: "row", justifyContent: "flex-end", marginTop: 12 },
});
