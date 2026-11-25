/*
 * Migrado de ui/veterinario/AgregarConsultaActivity.kt (activity_agregar_consulta.xml). Agenda un turno al paciente
 * (o registra una consulta pasada). Si el veterinario todavía no ve la ficha del dueño buscado, se le pide acceso y el
 * turno viaja como propuesta. Ruta: `/vet/consulta-nueva?paciente=ID`. El alta de un dueño nuevo sale a
 * `/vet/dueno-nuevo` y vuelve por `EstadoVet` (en Android era `registerForActivityResult`).
 */
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { DisponibilidadVet } from "../../data/repositorio/disponibilidadVet";
import { AgendaRepo, type EstadoEvento } from "../../data/repositorio/agendaRepo";
import { estaActiva, PacientesRepo, razaYSexo, type Paciente } from "../../data/repositorio/pacientesRepo";
import { PerfilVetRepo } from "../../data/repositorio/perfilVetRepo";
import { SaludRepo, type TipoRegistro } from "../../data/repositorio/saludRepo";
import type { Json, JsonObject } from "../../data/remoto/dtos";
import { Servicios } from "../../data/servicios";
import { textoLugarSede } from "../../model/modelos";
import { TiposMascota } from "../../model/tiposMascota";
import { Errores } from "../../util/errores";
import { Fechas } from "../../util/fechas";
import { LocalDate } from "../../util/tiempo";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Campo } from "../common/Campo";
import { PantallaBase } from "../common/PantallaBase";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";
import { useDatos } from "../common/useDatos";
import { useSesionRequerida } from "../common/useSesionRequerida";
import { CajaForm, CampoSeleccion, CampoTocable, EtiquetaForm, SeccionTitulo } from "./ElementosVet";
import { cerrarPantalla, EstadoVet } from "./estadoVet";
import { NavVet } from "./navegacionVet";
import { SelectorFechaVet, SelectorHoraVet } from "./SelectoresVet";

/** Mascota que aparece al buscar un dueño: [paciente] es null si todavía no fue compartida con el veterinario. */
interface Candidata {
  mascotaId: string;
  etiqueta: string;
  paciente: Paciente | null;
}

interface Encontrada {
  candidata: Candidata;
  etiquetaDueno: string;
}

const texto = (v: Json | undefined): string | null => (typeof v === "string" ? v : v == null ? null : String(v));

/** Mascotas de un dueño buscado por correo o DNI: primero entre los pacientes propios y después en toda la plataforma. */
export async function buscarMascotas(q: string, propios: Paciente[]): Promise<Encontrada[]> {
  const ql = q.toLowerCase();
  const locales = propios.filter(
    (p) => p.email.toLowerCase() === ql || p.propietario.toLowerCase().includes(ql) || p.telefono.includes(q),
  );
  if (locales.length > 0) {
    const primero = locales[0];
    const etiqueta = `Dueño encontrado: ${primero.propietario} (${primero.email})`;
    return locales.map((p) => ({ candidata: { mascotaId: p.id, etiqueta: `${p.nombre} (${razaYSexo(p)})`, paciente: p }, etiquetaDueno: etiqueta }));
  }
  if (q.length < 6) return [];
  const duenos = await Servicios.fuente.buscarDueno(q);
  return duenos.flatMap((dueno) => {
    const etiqueta = `Dueño encontrado: ${dueno.nombre} (${dueno.email ?? ""})`;
    return dueno.mascotas.flatMap((m) => {
      if (m === null || typeof m !== "object" || Array.isArray(m)) return [];
      const datos = m as JsonObject;
      const id = texto(datos.id);
      const nombre = texto(datos.nombre);
      if (id === null || nombre === null) return [];
      const razaDato = texto(datos.raza);
      const raza = razaDato !== null && razaDato !== "null" ? razaDato : (texto(datos.tipo) ?? "");
      const propio = propios.find((p) => p.id === id) ?? null;
      return [{ candidata: { mascotaId: id, etiqueta: `${nombre} (${raza})` + (propio === null ? " · sin acceso" : ""), paciente: propio }, etiquetaDueno: etiqueta }];
    });
  });
}

/** Lo que se anota en el carnet cuando el tipo de turno es de salud. */
function registrarEnCarnet(mascotaId: string, tipo: string, motivo: string, notas: string, fecha: LocalDate): void {
  const detalle = notas === "" ? "Registrado por el veterinario" : notas;
  const t: TipoRegistro | null =
    tipo === "Vacuna" ? "VACUNA" : tipo === "Desparasitación" ? "DESPARASITACION" : tipo === "Tratamiento" ? "TRATAMIENTO" : tipo === "Cirugía" ? "CIRUGIA" : null;
  if (t !== null) SaludRepo.agregar(t, mascotaId, motivo, detalle, fecha);
}

function avisarQueNoAtiende(tipo: string): void {
  const animales = TiposMascota.plural(TiposMascota.normalizar(tipo)).toLowerCase();
  Avisos.informar({
    titulo: `No atendés ${animales}`,
    mensaje:
      "No tenés ese tipo de animal entre los que atendés, así que no podés agendar este turno. " +
      'Podés agregarlo desde tu perfil, en "Animales que atiendo".',
    icono: "advertencia",
  });
}

export default function AgregarConsultaPantalla() {
  useSesionRequerida();
  useDatos();
  const { paciente: preseleccionado } = useLocalSearchParams<{ paciente?: string }>();

  // Solo las activas: a las inactivas y a las fallecidas no se les agendan turnos
  const pacientes = PacientesRepo.pacientes.filter(estaActiva);
  const tipos = AgendaRepo.tipos();
  const sedes = PerfilVetRepo.sedes.slice();

  const [pacienteId, setPacienteId] = useState<string | null>(typeof preseleccionado === "string" ? preseleccionado : null);
  const [tipoIdx, setTipoIdx] = useState(0);
  const [sedeIdx, setSedeIdx] = useState(0);
  const [fecha, setFecha] = useState<LocalDate | null>(null);
  const [hora, setHora] = useState("");
  const [motivo, setMotivo] = useState("");
  const [notas, setNotas] = useState("");
  const [errorFecha, setErrorFecha] = useState<string | null>(null);
  const [errorHora, setErrorHora] = useState<string | null>(null);
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null);
  const [selFecha, setSelFecha] = useState(false);
  const [selHora, setSelHora] = useState(false);

  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [candidatas, setCandidatas] = useState<Candidata[]>([]);
  const [etiquetaDueno, setEtiquetaDueno] = useState("");
  const [candidataIdx, setCandidataIdx] = useState(0);
  const [guardando, setGuardando] = useState(false);

  const tipo = tipos[tipoIdx] ?? tipos[0];
  const sede = sedes[sedeIdx] ?? null;
  const duracion = () => PerfilVetRepo.duracionDe(tipo);
  const pacienteElegido = pacientes.find((p) => p.id === pacienteId) ?? pacientes[0] ?? null;
  const duenoEncontrado = candidatas.length > 0;

  // El dueño nuevo se carga en su propia pantalla: al volver queda elegida su mascota
  const alAltaRef = useRef((id: string) => {
    setPacienteId(id);
    setCandidatas([]);
    Avisos.mostrar("Listo, ya podés agendar el turno");
  });
  useEffect(() => {
    const alAlta = (id: string) => alAltaRef.current(id);
    EstadoVet.alTerminarAltaDeDueno = alAlta;
    const pendiente = EstadoVet.tomarPendiente();
    if (pendiente !== null) alAlta(pendiente);
    return () => {
      if (EstadoVet.alTerminarAltaDeDueno === alAlta) EstadoVet.alTerminarAltaDeDueno = null;
    };
  }, []);

  const buscar = async () => {
    const q = busqueda.trim();
    if (q === "") {
      Avisos.mostrar("Ingresá un DNI o Email para buscar");
      return;
    }
    setBuscando(true);
    try {
      const encontradas = await buscarMascotas(q, pacientes);
      if (encontradas.length > 0) {
        setCandidatas(encontradas.map((e) => e.candidata));
        setCandidataIdx(0);
        setEtiquetaDueno(encontradas[0].etiquetaDueno);
        Avisos.mostrar(`Dueño encontrado con ${encontradas.length} mascota(s)`);
      } else {
        setCandidatas([]);
        Avisos.mostrar('No hay un dueño con ese dato. Registralo con el botón "Registrar dueño y mascota nuevos".');
      }
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
    } finally {
      setBuscando(false);
    }
  };

  // El correo o el DNI que se buscó sirve de punto de partida para el alta
  const registrarNuevo = () => {
    const buscado = busqueda.trim();
    if (buscado.includes("@")) router.push({ pathname: "/vet/dueno-nuevo", params: { correo: buscado } });
    else if (/^\d+$/.test(buscado) && buscado.length >= 7 && buscado.length <= 8) router.push({ pathname: "/vet/dueno-nuevo", params: { dni: buscado } });
    else NavVet.nuevoDueno();
  };

  /** El veterinario todavía no puede ver la mascota: se le pide acceso al dueño y se agenda cuando lo acepte. */
  const pedirAcceso = async (candidata: Candidata, propuesta: JsonObject) => {
    try {
      const resultado = await Servicios.fuente.solicitarAcceso(candidata.mascotaId, propuesta);
      if (resultado === "activo") {
        await PacientesRepo.cargar();
        Servicios.avisarCambio();
        Avisos.mostrar("Ya tenés acceso. Volvé a buscar para agendar.");
      } else {
        const f = Fechas.iso(typeof propuesta.fecha === "string" ? propuesta.fecha : null);
        const h = typeof propuesta.hora === "string" ? propuesta.hora.slice(0, 5) : "";
        const cuando = f ? `${Fechas.corta(f)} a las ${h}` : null;
        Avisos.informar({
          titulo: "Pedido enviado al dueño",
          mensaje: "Le pedimos acceso a la mascota. El turno" + (cuando ? ` del ${cuando} hs` : "") + " se agenda solo apenas el dueño lo acepte, y te llega el aviso.",
          cancelable: false,
          alAceptar: cerrarPantalla,
        });
      }
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
    }
  };

  const guardar = async () => {
    let ok = true;
    if (fecha === null) { setErrorFecha("Requerido"); ok = false; }
    if (hora === "") { setErrorHora("Requerido"); ok = false; }
    if (motivo.trim() === "") { setErrorMotivo("Requerido"); ok = false; }
    if (!ok || fecha === null) return;

    const problema = DisponibilidadVet.validar(fecha, hora, duracion(), null, sede);
    if (problema !== null) {
      setErrorHora(problema);
      Avisos.mostrar(problema);
      return;
    }

    let elegido: Paciente | null = null;
    // 1. Si se buscó un dueño existente
    if (duenoEncontrado) {
      const candidata = candidatas[candidataIdx] ?? null;
      if (candidata !== null && candidata.paciente === null) {
        // El turno queda pedido junto con el acceso: se agenda solo cuando el dueño acepta
        const propuesta: JsonObject = {
          categoria: tipo,
          motivo: motivo.trim(),
          fecha: fecha.toString(),
          hora: `${hora}:00`,
          notas: notas.trim(),
          ...(sede && sede.id.trim() ? { sede_id: sede.id } : {}),
        };
        setGuardando(true);
        await pedirAcceso(candidata, propuesta);
        setGuardando(false);
        return;
      }
      elegido = candidata?.paciente ?? null;
    } else {
      // 2. Selección de la lista general
      elegido = pacienteElegido;
    }

    if (elegido === null) {
      Avisos.mostrar("Seleccioná o registrá una mascota");
      return;
    }
    if (!PerfilVetRepo.atiende(elegido.especie)) {
      avisarQueNoAtiende(elegido.especie);
      return;
    }
    const estado: EstadoEvento = fecha.isBefore(LocalDate.now()) ? "COMPLETADO" : "PENDIENTE";
    AgendaRepo.agregar(elegido.id, tipo, motivo.trim(), fecha, hora, estado, notas.trim(), sede?.id ?? null);
    registrarEnCarnet(elegido.id, tipo, motivo.trim(), notas.trim(), fecha);
    Avisos.mostrar("Consulta guardada");
    cerrarPantalla();
  };

  return (
    <PantallaBase formulario
      titulo="Nuevo turno" subtitulo="Otorgá un turno o registrá una consulta" alVolver={cerrarPantalla}
      pie={<Boton titulo="Guardar consulta" alto={56} cargando={guardando} onPress={() => void guardar()} />}
    >
      <SeccionTitulo texto="Paciente" estilo={{ marginTop: 0 }} />
      <CajaForm>
        <EtiquetaForm texto="Buscar dueño (DNI o email)" primera />
        <View style={estilos.fila}>
          <Campo
            placeholder="Correo del dueño o DNI" accessibilityLabel="Buscar dueño" value={busqueda} onChangeText={setBusqueda}
            autoCapitalize="none" estilo={{ flex: 1 }} returnKeyType="search" onSubmitEditing={() => void buscar()}
          />
          <Boton titulo="Buscar" alto={50} cargando={buscando} deshabilitado={buscando} onPress={() => void buscar()} estilo={estilos.botonBuscar} />
        </View>

        {duenoEncontrado ? (
          <View style={estilos.encontrado}>
            <Texto variante="etiqueta" tamano={13.5} color={Colores.tealDark}>{etiquetaDueno}</Texto>
            <EtiquetaForm texto="Mascota de este dueño" />
            <CampoSeleccion
              titulo="Mascota de este dueño" opciones={candidatas.map((c) => c.etiqueta)} indice={candidataIdx} alElegir={setCandidataIdx}
            />
          </View>
        ) : (
          <View>
            <EtiquetaForm texto="O elegí de tus pacientes" />
            <CampoSeleccion
              titulo="Elegí el paciente" accesibilidad="Paciente"
              opciones={pacientes.map((p) => `${p.nombre} (${p.propietario})`)}
              indice={Math.max(0, pacientes.findIndex((p) => p.id === pacienteElegido?.id))}
              alElegir={(i) => setPacienteId(pacientes[i]?.id ?? null)}
            />
          </View>
        )}
        <Boton titulo="Registrar dueño y mascota nuevos" variante="secundario" alto={50} estilo={{ marginTop: 16 }} onPress={registrarNuevo} />
      </CajaForm>

      <SeccionTitulo texto="Detalles del turno" />
      <CajaForm>
        <EtiquetaForm texto="Tipo de evento" primera />
        <CampoSeleccion titulo="Tipo de evento" opciones={tipos} indice={tipoIdx} alElegir={(i) => {
          setTipoIdx(i);
        }} />
        {sedes.length > 0 ? (
          <View>
            <EtiquetaForm texto="Lugar de atención" />
            <CampoSeleccion titulo="Lugar de atención" opciones={sedes.map(textoLugarSede)} indice={sedeIdx} alElegir={setSedeIdx} />
          </View>
        ) : null}
        <View style={estilos.fila}>
          <View style={{ flex: 1 }}>
            <EtiquetaForm texto="Fecha" />
            <CampoTocable
              valor={fecha ? Fechas.corta(fecha) : ""} marcador="Elegir fecha" accesibilidad="Fecha" icono="calendario" error={errorFecha}
              alTocar={() => setSelFecha(true)}
            />
          </View>
          <View style={{ flex: 1, marginLeft: 6 }}>
            <EtiquetaForm texto="Hora" />
            <CampoTocable
              valor={hora} marcador="Elegir hora" accesibilidad="Hora" icono="reloj" error={errorHora}
              alTocar={() => {
                if (fecha === null) {
                  setErrorFecha("Elegí primero la fecha");
                  Avisos.mostrar("Elegí primero la fecha");
                } else setSelHora(true);
              }}
            />
          </View>
        </View>
        <EtiquetaForm texto="Motivo / diagnóstico" />
        <Campo
          placeholder="Ej: Revisión anual" accessibilityLabel="Motivo / diagnóstico" value={motivo} error={errorMotivo}
          onChangeText={(t) => { setMotivo(t); setErrorMotivo(null); }} autoCapitalize="sentences"
        />
        <EtiquetaForm texto="Notas" />
        <Campo
          multilinea placeholder="Observaciones, plan de tratamiento..." accessibilityLabel="Notas" value={notas} onChangeText={setNotas}
          autoCapitalize="sentences" numberOfLines={5}
        />
      </CajaForm>

      <SelectorFechaVet
        visible={selFecha} inicial={fecha} sede={sede} alCerrar={() => setSelFecha(false)}
        alElegir={(elegida) => {
          setFecha(elegida);
          setErrorFecha(null);
          // Si el horario ya cargado no sirve para el nuevo día, hay que elegirlo de nuevo
          if (hora !== "" && DisponibilidadVet.validar(elegida, hora, duracion(), null, sede) !== null) {
            setHora("");
            Avisos.mostrar("Elegí otro horario para ese día");
          }
        }}
      />
      {fecha ? (
        <SelectorHoraVet
          visible={selHora} fecha={fecha} horaActual={hora || null} duracionMin={duracion()} sede={sede}
          alCerrar={() => setSelHora(false)} alElegir={(h) => { setHora(h); setErrorHora(null); }}
        />
      ) : null}
    </PantallaBase>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "flex-start" },
  botonBuscar: { alignSelf: "flex-start", marginLeft: 8, paddingHorizontal: 18 },
  encontrado: { backgroundColor: Colores.lightTeal, borderRadius: 14, padding: 12, marginTop: 12 },
});
