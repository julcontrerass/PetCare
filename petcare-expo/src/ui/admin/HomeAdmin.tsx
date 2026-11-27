/*
 * Migrado de ui/admin/HomeAdminActivity.kt + layout activity_home_admin.
 *
 * Panel del administrador: resumen general, revisión de altas de veterinarios, listado de dueños con sus
 * mascotas, las veterinarias (en revisión, aprobadas o rechazadas) y el registro de actividad. Desde acá se da de alta, rechaza, suspende o reactiva cuentas.
 * En pantallas anchas (>= 900 dp, la web de escritorio) las listas se ven en dos columnas.
 */
import { useCallback, useRef, useState, type ReactNode } from "react";
import { BackHandler, FlatList, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Errores } from "../../util/errores";
import { Fechas } from "../../util/fechas";
import { LocalDate } from "../../util/tiempo";
import { AdminRepo, type ActividadAdmin, type DuenoAdminItem, type VetAdminItem } from "../../data/repositorio/adminRepo";
import { Servicios } from "../../data/servicios";
import { Avisos } from "../common/Avisos";
import { BotonIcono } from "../common/BotonIcono";
import { EstadoVacio } from "../common/EstadoVacio";
import { Icono, type NombreIcono } from "../common/Icono";
import { Insignia } from "../common/Insignia";
import { PantallaBase } from "../common/PantallaBase";
import { Tarjeta } from "../common/Tarjeta";
import { Texto } from "../common/Texto";
import { Colores, sombra } from "../common/tema";
import { useDatos } from "../common/useDatos";
import { useMargenes } from "../common/Margenes";
import { useSesionRequerida } from "../common/useSesionRequerida";
import { MarcoConMenu, MenuLateral } from "../common/MenuLateral";
import { ANCHO_MENU_LATERAL, cursorTocable, estiloFoco, useEscritorio, useFoco } from "../common/Web";
import { AdminUi } from "./AdminUi";
import { DialogoCredencial } from "./DialogoCredencial";
import { DialogoMotivo, type PedidoMotivo } from "./DialogoMotivo";
import { FilaActividad, FilaDueno, FilaPendiente, FilaVet } from "./FilasAdmin";
import { cerrarSesionConfirmando, HojaCuentaAdmin } from "./HojaCuentaAdmin";
import { BuscadorAdmin as Buscador, FiltrosAdmin as Filtros } from "./FiltrosAdmin";
import { PanelVeterinarias, useClinicasAdmin } from "./PanelVeterinarias";
import { HojaDuenoAdmin } from "./HojaDuenoAdmin";
import { HojaVetAdmin } from "./HojaVetAdmin";
import { imagenEnMemoria, type ImagenEnMemoria } from "./credencial";
import { RevisionClinicas } from "./RevisionClinicas";
import { RevisionEspecialidades } from "./RevisionEspecialidades";

type Panel = "inicio" | "vets" | "clinicas" | "duenos" | "actividad";

/** A partir de este ancho (dp) las listas pasan a dos columnas. */
const ANCHO_DOS_COLUMNAS = 900;
const ANCHO_PANEL = 1100;
const MARGEN = 20;
const SEPARACION = 12;
const INTERVALO_ACTUALIZACION_MS = 30_000;
const RECARGA_MINIMA_MS = 8_000;

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** Qué se está pidiendo motivar: el rechazo o la suspensión de una cuenta. */
interface MotivoPendiente {
  tipo: "rechazarVet" | "suspenderVet" | "suspenderDueno";
  id: string;
}

const FILTROS_VETS: { estado: string | null; texto: string }[] = [
  { estado: AdminRepo.PENDIENTE, texto: "En revisión" },
  { estado: AdminRepo.ACTIVO, texto: "Activos" },
  { estado: AdminRepo.RECHAZADO, texto: "Rechazados" },
  { estado: AdminRepo.SUSPENDIDO, texto: "Suspendidos" },
  { estado: null, texto: "Todos" },
];

const FILTROS_DUENOS: { estado: string | null; texto: string }[] = [
  { estado: null, texto: "Todos" },
  { estado: AdminRepo.ACTIVO, texto: "Activos" },
  { estado: AdminRepo.SUSPENDIDO, texto: "Suspendidos" },
];

export function HomeAdmin() {
  const haySesion = useSesionRequerida();
  useDatos();
  const { width } = useWindowDimensions();
  const escritorio = useEscritorio();
  const ancha = width >= ANCHO_DOS_COLUMNAS;
  const columnas = ancha ? 2 : 1;
  // En escritorio el menú lateral ocupa su parte de la ventana
  const anchoUtil = escritorio ? width - ANCHO_MENU_LATERAL : width;
  const anchoColumna = ancha ? (Math.min(anchoUtil, ANCHO_PANEL) - 2 * MARGEN - SEPARACION) / 2 : undefined;

  const [panel, setPanel] = useState<Panel>("inicio");
  const [filtroVets, setFiltroVets] = useState<string | null>(AdminRepo.PENDIENTE);
  const [filtroDuenos, setFiltroDuenos] = useState<string | null>(null);
  const [busquedaVets, setBusquedaVets] = useState("");
  const [busquedaDuenos, setBusquedaDuenos] = useState("");

  // Hojas de detalle: el id queda guardado al cerrar para que no se vacíe mientras la hoja baja
  const [vetId, setVetId] = useState<string | null>(null);
  const [vetAbierta, setVetAbierta] = useState(false);
  const [duenoId, setDuenoId] = useState<string | null>(null);
  const [duenoAbierta, setDuenoAbierta] = useState(false);
  const [cuentaAbierta, setCuentaAbierta] = useState(false);
  const [motivo, setMotivo] = useState<MotivoPendiente | null>(null);
  const [credencial, setCredencial] = useState<{ nombre: string; matricula: string; imagen: ImagenEnMemoria } | null>(null);
  const [cargandoCredencial, setCargandoCredencial] = useState(false);

  const { clinicas, recargar: recargarClinicas } = useClinicasAdmin();
  const [clinicaEnfocada, setClinicaEnfocada] = useState<{ id: string; vez: number } | null>(null);

  const panelRef = useRef(panel);
  panelRef.current = panel;
  const errorMostrado = useRef(false);
  const credencialRef = useRef<ImagenEnMemoria | null>(null);

  /** Pide los datos al servidor; si falla avisa qué pasó una sola vez, en vez de dejar la pantalla vacía. */
  const cargarDatos = useCallback(async (avisarSiFalla: boolean) => {
    try {
      await AdminRepo.cargar();
    } catch (e) {
      if (avisarSiFalla && !errorMostrado.current) {
        errorMostrado.current = true;
        Avisos.error(Errores.mensaje(e), "No se pudieron cargar los datos");
      }
      return;
    }
    errorMostrado.current = false;
    Servicios.avisarCambio();
  }, []);

  // Mientras la pantalla está a la vista: carga si pasó un rato y pide las cuentas nuevas cada tanto (no llegan en vivo)
  useFocusEffect(
    useCallback(() => {
      if (AdminRepo.cargadoHaceMs() > RECARGA_MINIMA_MS) void cargarDatos(true);
      const t = setInterval(() => void cargarDatos(false), INTERVALO_ACTUALIZACION_MS);
      return () => {
        clearInterval(t);
        // La foto del carnet no se conserva al salir de la pantalla
        credencialRef.current?.liberar();
        credencialRef.current = null;
      };
    }, [cargarDatos]),
  );

  // El botón atrás del sistema vuelve al inicio del panel antes de salir (en la web no existe)
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS === "web") return undefined;
      const suscripcion = BackHandler.addEventListener("hardwareBackPress", () => {
        if (panelRef.current !== "inicio") {
          setPanel("inicio");
          return true;
        }
        return false;
      });
      return () => suscripcion.remove();
    }, []),
  );

  if (!haySesion) return null;

  const refrescar = () => Servicios.avisarCambio();

  const verVeterinarios = (estado: string | null) => {
    setFiltroVets(estado);
    setPanel("vets");
  };

  // ---------- Acciones ----------

  const cerrarHojas = () => {
    setVetAbierta(false);
    setDuenoAbierta(false);
  };

  const aprobar = (vet: VetAdminItem) => {
    AdminRepo.aprobarVet(vet.id);
    cerrarHojas();
    Avisos.mostrar(`${vet.nombre} ya está dado de alta`);
    refrescar();
  };

  const reactivarVet = (vet: VetAdminItem) => {
    AdminRepo.reactivarVet(vet.id);
    cerrarHojas();
    Avisos.mostrar(`${vet.nombre} fue reactivado`);
    refrescar();
  };

  const reactivarDueno = (dueno: DuenoAdminItem) => {
    AdminRepo.reactivarDueno(dueno.id);
    cerrarHojas();
    Avisos.mostrar(`La cuenta de ${dueno.nombre} fue reactivada`);
    refrescar();
  };

  const pedirRechazo = (vet: VetAdminItem) => setMotivo({ tipo: "rechazarVet", id: vet.id });
  const pedirSuspensionVet = (vet: VetAdminItem) => setMotivo({ tipo: "suspenderVet", id: vet.id });
  const pedirSuspensionDueno = (dueno: DuenoAdminItem) => setMotivo({ tipo: "suspenderDueno", id: dueno.id });

  const vetDelMotivo = motivo && motivo.tipo !== "suspenderDueno" ? AdminRepo.vetPorId(motivo.id) : null;
  const duenoDelMotivo = motivo && motivo.tipo === "suspenderDueno" ? AdminRepo.duenoPorId(motivo.id) : null;
  let pedido: PedidoMotivo | null = null;
  if (motivo?.tipo === "rechazarVet" && vetDelMotivo) {
    pedido = {
      titulo: `Rechazar a ${vetDelMotivo.nombre}`,
      ayuda: "El veterinario va a ver este motivo cuando intente ingresar.",
      sugerencias: ["No se pudo verificar la matrícula", "Datos incompletos o incorrectos", "Documentación inválida"],
      confirmar: "Rechazar",
    };
  } else if (motivo?.tipo === "suspenderVet" && vetDelMotivo) {
    pedido = {
      titulo: `Suspender a ${vetDelMotivo.nombre}`,
      ayuda: "No va a poder ingresar hasta que lo reactives.",
      sugerencias: ["Matrícula vencida", "Reclamos de dueños", "Datos desactualizados"],
      confirmar: "Suspender",
    };
  } else if (motivo?.tipo === "suspenderDueno" && duenoDelMotivo) {
    pedido = {
      titulo: `Suspender a ${duenoDelMotivo.nombre}`,
      ayuda: "No va a poder ingresar hasta que lo reactives.",
      sugerencias: ["Datos falsos", "Uso indebido de la plataforma", "Pedido del propio usuario"],
      confirmar: "Suspender",
    };
  }

  const confirmarMotivo = (texto: string) => {
    if (!motivo) return;
    if (motivo.tipo === "suspenderDueno") {
      const dueno = AdminRepo.duenoPorId(motivo.id);
      if (dueno) {
        AdminRepo.suspenderDueno(dueno.id, texto);
        Avisos.mostrar(`La cuenta de ${dueno.nombre} quedó suspendida`);
      }
    } else {
      const vet = AdminRepo.vetPorId(motivo.id);
      if (vet) {
        if (motivo.tipo === "rechazarVet") {
          AdminRepo.rechazarVet(vet.id, texto);
          Avisos.mostrar(`Solicitud de ${vet.nombre} rechazada`);
        } else {
          AdminRepo.suspenderVet(vet.id, texto);
          Avisos.mostrar(`${vet.nombre} quedó suspendido`);
        }
      }
    }
    setMotivo(null);
    cerrarHojas();
    refrescar();
  };

  /** Muestra la foto del carnet sin guardarla en el teléfono: se baja del bucket privado y se descarta. */
  const verCredencial = async (vet: VetAdminItem) => {
    const ruta = vet.credencialPath;
    if (!ruta) return;
    setCargandoCredencial(true);
    try {
      const bytes = await Servicios.fuente.descargar("credenciales", ruta);
      if (bytes.length === 0) throw new Error("La foto no se pudo abrir");
      credencialRef.current?.liberar();
      const imagen = imagenEnMemoria(bytes);
      credencialRef.current = imagen;
      setCredencial({ nombre: vet.nombre, matricula: vet.matricula, imagen });
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
    } finally {
      setCargandoCredencial(false);
    }
  };

  const cerrarCredencial = () => {
    credencialRef.current?.liberar();
    credencialRef.current = null;
    setCredencial(null);
  };

  const abrirVet = (vet: VetAdminItem) => {
    setVetId(vet.id);
    setVetAbierta(true);
  };
  const abrirDueno = (dueno: DuenoAdminItem) => {
    setDuenoId(dueno.id);
    setDuenoAbierta(true);
  };

  /** Adónde lleva tocar un movimiento: la veterinaria, o la cuenta del veterinario o del dueño. Nada si ya no existe. */
  const destinoDe = (a: ActividadAdmin): (() => void) | undefined => {
    if (a.clinicaId && clinicas.some((c) => c.id === a.clinicaId)) {
      const id = a.clinicaId;
      return () => {
        setClinicaEnfocada((antes) => ({ id, vez: (antes?.vez ?? 0) + 1 }));
        setPanel("clinicas");
      };
    }
    if (!a.objetivoId) return undefined;
    const vet = AdminRepo.vetPorId(a.objetivoId);
    if (vet) return () => abrirVet(vet);
    const dueno = AdminRepo.duenoPorId(a.objetivoId);
    if (dueno) return () => abrirDueno(dueno);
    return undefined;
  };

  // ---------- Datos derivados ----------

  const pendientes = AdminRepo.pendientesRevisionCount();
  const clinicasPendientes = clinicas.filter((c) => c.revision === "pendiente").length;
  const insigniaDe = (p: Panel) => (p === "vets" ? pendientes : p === "clinicas" ? clinicasPendientes : 0);
  const vets = AdminRepo.listaVeterinarios;
  const duenos = AdminRepo.listaDuenos;

  const listaVets = vets
    .filter((v) => filtroVets == null || v.estado === filtroVets)
    .filter((v) => AdminUi.textoContiene(busquedaVets, v.nombre, v.matricula, v.clinica, v.email, v.dni))
    .sort((a, b) => (a.estado === AdminRepo.PENDIENTE ? 0 : 1) - (b.estado === AdminRepo.PENDIENTE ? 0 : 1));
  const listaDuenos = duenos
    .filter((d) => filtroDuenos == null || d.estado === filtroDuenos)
    .filter((d) => AdminUi.textoContiene(busquedaDuenos, d.nombre, d.dni, d.email, d.telefono));

  const vetSeleccionado = vetId ? AdminRepo.vetPorId(vetId) : null;
  const duenoSeleccionado = duenoId ? AdminRepo.duenoPorId(duenoId) : null;
  const detalleOculto = motivo != null || credencial != null || cargandoCredencial;

  // ---------- Paneles ----------

  const hoy = LocalDate.now();
  const textoFecha = `${DIAS[hoy.dayOfWeek - 1]} ${hoy.dayOfMonth} de ${Fechas.mesAnio(hoy).split(" ")[0].toLowerCase()}`;
  const pendientesLista = AdminRepo.porEstado(AdminRepo.PENDIENTE);

  const columnaPendientes = (
    <View style={ancha ? estilos.columnaInicio : undefined}>
      <CabeceraSeccion titulo="Para revisar" accion="Ver todas" visible={pendientesLista.length > 0} alAccion={() => verVeterinarios(AdminRepo.PENDIENTE)} />
      <View style={estilos.listaInicio}>
        {pendientesLista.slice(0, 3).map((vet) => (
          <View key={vet.id} style={estilos.filaInicio}>
            <FilaPendiente vet={vet} alAbrir={abrirVet} />
          </View>
        ))}
      </View>
      {pendientesLista.length === 0 ? (
        <EstadoVacio icono="checkCirculo" titulo="Sin solicitudes pendientes" mensaje="Ya revisaste todas las altas" />
      ) : null}
    </View>
  );

  const columnaActividad = (
    <View style={ancha ? estilos.columnaInicio : undefined}>
      <CabeceraSeccion titulo="Actividad reciente" accion="Ver todo" visible alAccion={() => setPanel("actividad")} />
      <View style={estilos.listaInicio}>
        {AdminRepo.actividad.slice(0, 4).map((a, i) => (
          <View key={`${i}-${a.texto}`} style={estilos.filaInicio}>
            <FilaActividad actividad={a} alAbrir={destinoDe(a)} />
          </View>
        ))}
      </View>
      {AdminRepo.actividad.length === 0 ? (
        <EstadoVacio icono="historial" titulo="Sin actividad" mensaje="Los registros y cambios de cuentas aparecen acá" />
      ) : null}
    </View>
  );

  const inicio = (
    <ScrollView contentContainerStyle={estilos.scrollInicio} showsVerticalScrollIndicator={false}>
      <View style={estilos.cabecera}>
        <View style={estilos.cabeceraTextos}>
          <Texto variante="titulo" tamano={26} numberOfLines={1}>Panel de control</Texto>
          <Texto variante="subtitulo" tamano={13}>{textoFecha}</Texto>
        </View>
        <BotonIcono icono="persona" accessibilityLabel="Cuenta de administrador" onPress={() => setCuentaAbierta(true)} />
      </View>

      <LinearGradient colors={["#0B2A4A", "#0B6E73"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={estilos.hero}>
        <Texto variante="etiqueta" tamano={12} color="#FFFFFFCC" style={estilos.heroEtiqueta}>
          {pendientes > 0 ? "Revisión pendiente" : "Todo al día"}
        </Texto>
        <Texto variante="titulo" tamano={21} color={Colores.white} style={{ marginTop: 6 }}>
          {pendientes === 0
            ? "No hay altas pendientes"
            : pendientes === 1
              ? "1 veterinario espera tu aprobación"
              : `${pendientes} veterinarios esperan tu aprobación`}
        </Texto>
        <Texto variante="subtitulo" tamano={14} color="#FFFFFFE6" style={{ marginTop: 4 }}>
          {pendientes > 0 ? "Verificá la matrícula antes de darlos de alta." : "Cuando un veterinario pida el alta lo vas a ver acá."}
        </Texto>
        <BotonHero
          texto={pendientes > 0 ? "Revisar solicitudes" : "Ver veterinarios"}
          onPress={() => verVeterinarios(pendientes > 0 ? AdminRepo.PENDIENTE : null)}
        />
      </LinearGradient>

      {/* Veterinarias que registró alguien que no es veterinario: solo aparece si hay alguna */}
      <RevisionClinicas
        alRevisar={() => void recargarClinicas()}
        encabezado={(n) => (
          <CabeceraSeccion titulo={n === 1 ? "Veterinaria para revisar" : `${n} veterinarias para revisar`} accion="" visible={false} alAccion={() => {}} />
        )}
      />

      {/* Títulos de especialidades que mandaron los veterinarios: solo aparece si hay alguno */}
      <RevisionEspecialidades
        encabezado={(n) => (
          <CabeceraSeccion titulo={n === 1 ? "Título de especialidad para revisar" : `${n} títulos de especialidades para revisar`} accion="" visible={false} alAccion={() => {}} />
        )}
      />

      <View style={[estilos.estadisticas, ancha ? estilos.estadisticasAncha : null]}>
        <Estadistica
          ancha={ancha}
          icono="botiquin"
          fondo={Colores.lightGreen}
          color={Colores.successGreen}
          valor={AdminRepo.vetsActivos()}
          etiqueta="Veterinarios activos"
          onPress={() => verVeterinarios(AdminRepo.ACTIVO)}
        />
        <Estadistica
          ancha={ancha}
          icono="persona"
          fondo={Colores.lightTeal}
          color={Colores.primaryTeal}
          valor={duenos.length}
          etiqueta="Dueños"
          onPress={() => setPanel("duenos")}
        />
        <Estadistica
          ancha={ancha}
          icono="perro"
          fondo={Colores.lightPurple}
          color={Colores.accentPurple}
          valor={AdminRepo.totalMascotas()}
          etiqueta="Mascotas"
          onPress={() => setPanel("duenos")}
        />
        <Estadistica
          ancha={ancha}
          icono="calendario"
          fondo={Colores.lightOrange}
          color={Colores.accentOrange}
          valor={AdminRepo.turnosHoy()}
          etiqueta="Turnos de hoy"
          onPress={() => {
            const hoyTurnos = AdminRepo.turnosHoy();
            Avisos.mostrar(hoyTurnos === 1 ? "Hay 1 turno pendiente para hoy" : `Hay ${hoyTurnos} turnos pendientes para hoy`);
          }}
        />
      </View>

      {ancha ? (
        <View style={estilos.dosColumnasInicio}>
          {columnaPendientes}
          {columnaActividad}
        </View>
      ) : (
        <>
          {columnaPendientes}
          {columnaActividad}
        </>
      )}
    </ScrollView>
  );

  const claveColumnas = `columnas-${columnas}`;
  const envolver = (hijo: ReactNode, id: string, margenAbajo: number) => (
    <View key={id} style={{ width: anchoColumna, marginBottom: margenAbajo }}>{hijo}</View>
  );

  const panelVets = (
    <View style={estilos.panel}>
      <Texto variante="titulo" tamano={26}>Veterinarios</Texto>
      <Texto variante="subtitulo" tamano={13}>{`${AdminRepo.vetsActivos()} activos · ${pendientes} en revisión`}</Texto>
      <Buscador
        placeholder="Buscar por nombre, matrícula o clínica..."
        valor={busquedaVets}
        alCambiar={setBusquedaVets}
      />
      <Filtros
        opciones={FILTROS_VETS}
        elegido={filtroVets}
        alElegir={setFiltroVets}
        cantidad={(estado) => (estado == null ? vets.length : AdminRepo.porEstado(estado).length)}
      />
      {listaVets.length === 0 ? (
        <EstadoVacio
          icono="botiquin"
          titulo={busquedaVets.trim() ? "No encontramos veterinarios" : "Sin veterinarios acá"}
          mensaje={busquedaVets.trim() ? "Probá con otro nombre, matrícula o clínica" : "No hay veterinarios con este estado"}
          estilo={estilos.vacio}
        />
      ) : (
        <FlatList
          key={claveColumnas}
          data={listaVets}
          keyExtractor={(v) => v.id}
          numColumns={columnas}
          columnWrapperStyle={columnas > 1 ? estilos.columnas : undefined}
          contentContainerStyle={estilos.lista}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) =>
            envolver(<FilaVet vet={item} alAbrir={abrirVet} alAprobar={aprobar} alRechazar={pedirRechazo} />, item.id, 12)
          }
        />
      )}
    </View>
  );

  const panelDuenos = (
    <View style={estilos.panel}>
      <Texto variante="titulo" tamano={26}>Dueños</Texto>
      <Texto variante="subtitulo" tamano={13}>{`${duenos.length} dueños · ${AdminRepo.totalMascotas()} mascotas`}</Texto>
      <Buscador placeholder="Buscar por nombre, DNI o correo..." valor={busquedaDuenos} alCambiar={setBusquedaDuenos} />
      <Filtros
        opciones={FILTROS_DUENOS}
        elegido={filtroDuenos}
        alElegir={setFiltroDuenos}
        cantidad={(estado) => (estado == null ? duenos.length : duenos.filter((d) => d.estado === estado).length)}
      />
      {listaDuenos.length === 0 ? (
        <EstadoVacio
          icono="persona"
          titulo={busquedaDuenos.trim() ? "No encontramos dueños" : "Sin dueños acá"}
          mensaje={busquedaDuenos.trim() ? "Probá con otro nombre, DNI o correo" : "No hay dueños con este estado"}
          estilo={estilos.vacio}
        />
      ) : (
        <FlatList
          key={claveColumnas}
          data={listaDuenos}
          keyExtractor={(d) => d.id}
          numColumns={columnas}
          columnWrapperStyle={columnas > 1 ? estilos.columnas : undefined}
          contentContainerStyle={estilos.lista}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => envolver(<FilaDueno dueno={item} alAbrir={abrirDueno} />, item.id, 12)}
        />
      )}
    </View>
  );

  const panelClinicas = (
    <PanelVeterinarias
      clinicas={clinicas}
      recargar={recargarClinicas}
      columnas={columnas}
      envolver={envolver}
      estiloPanel={estilos.panel}
      enfocar={clinicaEnfocada}
    />
  );

  const movimientos = AdminRepo.actividad;
  const panelActividad = (
    <View style={estilos.panel}>
      <Texto variante="titulo" tamano={26}>Actividad</Texto>
      <Texto variante="subtitulo" tamano={13}>Últimos movimientos de la plataforma</Texto>
      {movimientos.length === 0 ? (
        <EstadoVacio
          icono="historial"
          titulo="Sin actividad"
          mensaje="Los registros y cambios de cuentas aparecen acá"
          estilo={estilos.vacio}
        />
      ) : (
        <FlatList
          key={claveColumnas}
          data={movimientos}
          keyExtractor={(a, i) => `${i}-${a.texto}`}
          numColumns={columnas}
          columnWrapperStyle={columnas > 1 ? estilos.columnas : undefined}
          contentContainerStyle={estilos.lista}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => envolver(<FilaActividad actividad={item} alAbrir={destinoDe(item)} />, `${index}-${item.texto}`, 10)}
        />
      )}
    </View>
  );

  const menuLateral = (
    <MenuLateral
      secciones={ITEMS_NAVEGACION.map((item) => ({
        clave: item.panel,
        texto: item.titulo,
        icono: item.icono,
        activo: panel === item.panel,
        insignia: insigniaDe(item.panel),
        alTocar: () => setPanel(item.panel),
      }))}
      otras={[{ clave: "cuenta", texto: "Mi cuenta", icono: "persona", alTocar: () => setCuentaAbierta(true) }]}
      alCerrarSesion={cerrarSesionConfirmando}
    />
  );

  return (
    <MarcoConMenu menu={menuLateral}>
    <PantallaBase scroll={false} margen={0} anchoMaximo={ANCHO_PANEL} bordes={["top"]}>
      <View style={estilos.raiz}>
        <View style={estilos.raiz}>
          {panel === "inicio" ? inicio : panel === "vets" ? panelVets : panel === "clinicas" ? panelClinicas : panel === "duenos" ? panelDuenos : panelActividad}
        </View>
        {escritorio ? null : <BarraNavegacion panel={panel} alElegir={setPanel} insigniaDe={insigniaDe} />}
      </View>

      <HojaVetAdmin
        vet={vetSeleccionado}
        visible={vetAbierta && !detalleOculto}
        alCerrar={() => setVetAbierta(false)}
        alVerCredencial={(v) => void verCredencial(v)}
        cargandoCredencial={cargandoCredencial}
        alAprobar={aprobar}
        alPedirRechazo={pedirRechazo}
        alPedirSuspension={pedirSuspensionVet}
        alReactivar={reactivarVet}
      />
      <HojaDuenoAdmin
        dueno={duenoSeleccionado}
        visible={duenoAbierta && !detalleOculto}
        alCerrar={() => setDuenoAbierta(false)}
        alPedirSuspension={pedirSuspensionDueno}
        alReactivar={reactivarDueno}
      />
      <HojaCuentaAdmin visible={cuentaAbierta} alCerrar={() => setCuentaAbierta(false)} />
      <DialogoMotivo pedido={pedido} alConfirmar={confirmarMotivo} alCancelar={() => setMotivo(null)} />
      <DialogoCredencial
        nombre={credencial?.nombre ?? null}
        matricula={credencial?.matricula ?? ""}
        uri={credencial?.imagen.uri ?? null}
        alCerrar={cerrarCredencial}
      />
    </PantallaBase>
    </MarcoConMenu>
  );
}

export default HomeAdmin;

// ---------- Piezas del panel ----------

/** Título de sección ("Para revisar") con el enlace "Ver todas" a la derecha. */
function CabeceraSeccion({ titulo, accion, visible, alAccion }: { titulo: string; accion: string; visible: boolean; alAccion: () => void }) {
  const foco = useFoco();
  return (
    <View style={estilos.cabeceraSeccion}>
      <Texto variante="titulo" tamano={17} style={estilos.tituloSeccion}>{titulo}</Texto>
      {visible ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={accion}
          onPress={alAccion}
          hitSlop={8}
          {...foco.props}
          style={[estilos.enlace, cursorTocable, estiloFoco(foco.enfocado)]}
        >
          <Texto variante="boton" tamano={14} color={Colores.primaryTeal}>{accion}</Texto>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Botón blanco de pastilla del hero (btnAdminHeroAccion). */
function BotonHero({ texto, onPress }: { texto: string; onPress: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={texto}
      onPress={onPress}
      {...foco.props}
      style={({ pressed }) => [estilos.botonHero, pressed ? { opacity: 0.9 } : null, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Texto variante="boton" tamano={14.5} color={Colores.brandNavy}>{texto}</Texto>
    </Pressable>
  );
}

interface EstadisticaProps {
  icono: NombreIcono;
  fondo: string;
  color: string;
  valor: number;
  etiqueta: string;
  onPress: () => void;
  /** En pantallas anchas los cuatro contadores comparten una fila: cada uno ocupa una cuarta parte. */
  ancha?: boolean;
}

/** Contador del resumen (PetStatCard). */
function Estadistica({ icono, fondo, color, valor, etiqueta, onPress, ancha }: EstadisticaProps) {
  return (
    <Tarjeta relleno={12} onPress={onPress} accessibilityLabel={`${etiqueta}: ${valor}`} estilo={[estilos.estadistica, ancha ? estilos.estadisticaAncha1 : null]}>
      <View style={[estilos.cajaEstadistica, { backgroundColor: fondo }]}>
        <Icono nombre={icono} tamano={20} color={color} />
      </View>
      <Texto variante="titulo" tamano={22} style={estilos.valorEstadistica}>{String(valor)}</Texto>
      <Texto variante="subtitulo" tamano={11.5} centrado numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>{etiqueta}</Texto>
    </Tarjeta>
  );
}

const ITEMS_NAVEGACION: { panel: Panel; titulo: string; icono: NombreIcono }[] = [
  { panel: "inicio", titulo: "Inicio", icono: "inicio" },
  { panel: "vets", titulo: "Veterinarios", icono: "botiquin" },
  { panel: "clinicas", titulo: "Veterinarias", icono: "sede" },
  { panel: "duenos", titulo: "Dueños", icono: "persona" },
  { panel: "actividad", titulo: "Actividad", icono: "historial" },
];

/** Barra inferior con las secciones (view_admin_bottom_nav); veterinarios y veterinarias llevan el contador de lo que hay por revisar. */
function BarraNavegacion({ panel, alElegir, insigniaDe }: { panel: Panel; alElegir: (p: Panel) => void; insigniaDe: (p: Panel) => number }) {
  const margenes = useMargenes();
  return (
    <View style={[estilos.barra, { paddingBottom: margenes.bottom }]}>
      {ITEMS_NAVEGACION.map((item) => (
        <ItemNavegacion
          key={item.panel}
          item={item}
          activo={panel === item.panel}
          insignia={insigniaDe(item.panel)}
          onPress={() => alElegir(item.panel)}
        />
      ))}
    </View>
  );
}

function ItemNavegacion({
  item, activo, insignia, onPress,
}: { item: { titulo: string; icono: NombreIcono }; activo: boolean; insignia: number; onPress: () => void }) {
  const foco = useFoco();
  const color = activo ? Colores.primaryTeal : Colores.textGray;
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={item.titulo}
      accessibilityState={{ selected: activo }}
      onPress={onPress}
      {...foco.props}
      style={[estilos.itemNavegacion, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <View>
        <Icono nombre={item.icono} tamano={24} color={color} />
        <Insignia cantidad={insignia} estilo={estilos.insignia} />
      </View>
      <Texto variante="etiqueta" tamano={12} color={color} peso={activo ? "bold" : "medium"} numberOfLines={1}>{item.titulo}</Texto>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  raiz: { flex: 1 },
  scrollInicio: { paddingHorizontal: MARGEN, paddingTop: MARGEN, paddingBottom: MARGEN },
  cabecera: { flexDirection: "row", alignItems: "center" },
  cabeceraTextos: { flex: 1, minWidth: 0, marginRight: 12 },
  hero: { marginTop: 18, borderRadius: 22, padding: 20, ...sombra(3) },
  heroEtiqueta: { textTransform: "uppercase", letterSpacing: 1 },
  botonHero: {
    alignSelf: "flex-start",
    marginTop: 16,
    backgroundColor: Colores.white,
    borderRadius: 22,
    paddingHorizontal: 22,
    paddingVertical: 11,
  },
  estadisticas: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 14 },
  estadisticasAncha: { flexWrap: "nowrap" },
  estadistica: { flexBasis: "47%", flexGrow: 1, alignItems: "center", minWidth: 140 },
  estadisticaAncha1: { flexBasis: 0, minWidth: 0 },
  cajaEstadistica: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  valorEstadistica: { marginTop: 8 },
  cabeceraSeccion: { flexDirection: "row", alignItems: "center", marginTop: 24 },
  tituloSeccion: { flex: 1 },
  enlace: { padding: 4, borderRadius: 8 },
  listaInicio: { marginTop: 10 },
  filaInicio: { marginBottom: 10 },
  dosColumnasInicio: { flexDirection: "row", gap: 24, alignItems: "flex-start" },
  columnaInicio: { flex: 1, minWidth: 0 },
  panel: { flex: 1, paddingHorizontal: MARGEN, paddingTop: MARGEN },
  lista: { paddingTop: 12, paddingBottom: 16 },
  columnas: { gap: SEPARACION },
  vacio: { marginTop: 12 },
  barra: {
    flexDirection: "row",
    backgroundColor: Colores.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    ...sombra(3),
  },
  itemNavegacion: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2, paddingTop: 10, paddingBottom: 12 },
  insignia: { position: "absolute", top: -6, right: -12 },
});
