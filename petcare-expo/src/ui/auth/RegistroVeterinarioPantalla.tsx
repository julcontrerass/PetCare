/*
 * Migrado de ui/auth/RegistroVeterinarioActivity.kt (activity_registro_vet.xml). Alta de cuenta del veterinario en
 * cinco pasos: datos personales, matrícula y lugares de atención, especialidades y tipos de animales, días y
 * horarios, y cuenta. Con el parámetro de ruta `cuentaExistente=1` (EXTRA_CUENTA_EXISTENTE) un dueño con cuenta
 * activa pide el alta como veterinario: se saltea el primer paso y no se crea usuario, solo se mandan los datos.
 */
import { useLocalSearchParams } from "expo-router";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { CredencialVet } from "../../data/credencialVet";
import { crearDatosRegistroVeterinario } from "../../data/datosRegistro";
import { borrarArchivoLocal, Imagenes } from "../../data/imagenes";
import { Registro } from "../../data/registro";
import { DisponibilidadVet } from "../../data/repositorio/disponibilidadVet";
import { PerfilVetRepo } from "../../data/repositorio/perfilVetRepo";
import { Servicios } from "../../data/servicios";
import { Sesion } from "../../data/sesion";
import { textoLugarSede, type SedeVet } from "../../model/modelos";
import { TiposMascota } from "../../model/tiposMascota";
import { Errores } from "../../util/errores";
import { Colores } from "../common/tema";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Campo } from "../common/Campo";
import { Icono } from "../common/Icono";
import { ImagenRemota } from "../common/ImagenRemota";
import { Texto } from "../common/Texto";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { ChipRegistro, GrupoChips } from "./ChipRegistro";
import { CajaInfo, Casilla } from "./ElementosRegistro";
import { descartarFoto, elegirFoto } from "./elegirFoto";
import { detalleSede, EditorSedeRegistro } from "./EditorSedeRegistro";
import { cerrarPantalla, EstadoAuth } from "./estadoAuth";
import { FotoRedonda } from "./FotoRedonda";
import { CabeceraPaso, PasosRegistro } from "./PasosRegistro";
import { SelectorHoraLibre } from "./SelectorHoraLibre";
import { contarDigitos, esCorreoValido, soloNumeros } from "./validaciones";
import { useAtras } from "./useAtras";
import type { EntradaTexto } from "./tipos";

const TITULOS = ["Datos personales", "Profesión y veterinaria", "Especialidades", "Días y horarios", "Tu cuenta"];
const TITULOS_PROFESIONALES = ["Dr.", "Dra."];

/** Cuántos lugares extra se pueden cargar al registrarse (con el primero son 3, como en el perfil). */
const MAX_EXTRA = PerfilVetRepo.MAX_SEDES - 1;

type NombreCampo = "nombre" | "dni" | "telefono" | "matricula" | "clinica" | "direccion" | "email" | "password" | "password2";
type ErroresCampos = Partial<Record<NombreCampo, string>>;

const minutos = (hora: string): number => {
  const [h, m] = hora.split(":");
  return Number(h) * 60 + Number(m);
};

function FilaSede({ sede, alTocar }: { sede: SedeVet; alTocar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${sede.nombre}. Editar veterinaria`}
      onPress={alTocar}
      {...foco.props}
      style={[estilos.sede, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <View style={estilos.sedeIcono}>
        <Icono nombre="ubicacion" tamano={20} color={Colores.tealDark} />
      </View>
      <View style={estilos.sedeTextos}>
        <Texto variante="cuerpo" peso="bold">{sede.nombre}</Texto>
        <Texto variante="subtitulo" tamano={13}>{detalleSede(sede)}</Texto>
      </View>
      <Icono nombre="chevronDerecha" tamano={22} color={Colores.textGray} />
    </Pressable>
  );
}

function CampoHora({ etiqueta, valor, onPress }: { etiqueta: string; valor: string; onPress: () => void }) {
  const foco = useFoco();
  return (
    <View style={{ flex: 1 }}>
      <Texto variante="etiqueta" style={estilos.etiqueta}>{etiqueta}</Texto>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${etiqueta}: ${valor} hs`}
        onPress={onPress}
        {...foco.props}
        style={[estilos.hora, cursorTocable, estiloFoco(foco.enfocado)]}
      >
        <Texto variante="cuerpo">{`${valor} hs`}</Texto>
      </Pressable>
    </View>
  );
}

export default function RegistroVeterinarioPantalla() {
  const params = useLocalSearchParams<{ cuentaExistente?: string | string[] }>();
  const valorParam = Array.isArray(params.cuentaExistente) ? params.cuentaExistente[0] : params.cuentaExistente;
  /** Cuenta de dueño que suma el rol de veterinario: se salta lo personal y la creación del usuario. */
  const cuentaExistente = valorParam === "1" || valorParam === "true";
  const primerPaso = cuentaExistente ? 1 : 0;

  const [paso, setPaso] = useState(primerPaso);
  const [especialidades, setEspecialidades] = useState<boolean[]>(() => PerfilVetRepo.todasLasEspecialidades.map(() => false));
  const [tiposAnimales, setTiposAnimales] = useState<boolean[]>(() => TiposMascota.TODOS.map(() => false));
  const [dias, setDias] = useState<boolean[]>([true, true, true, true, true, false, false]);
  const [apertura, setApertura] = useState("09:00");
  const [cierre, setCierre] = useState("18:00");
  const [sedesExtra, setSedesExtra] = useState<SedeVet[]>([]);
  const [fotoPath, setFotoPath] = useState<string | null>(null);
  const [credencialPath, setCredencialPath] = useState<string | null>(null);
  const [titulo, setTitulo] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ indice: number | null } | null>(null);
  const [eligiendoHora, setEligiendoHora] = useState<"apertura" | "cierre" | null>(null);
  const [errorEsp, setErrorEsp] = useState(false);
  const [errorTipos, setErrorTipos] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState<ErroresCampos>({});

  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [telefono, setTelefono] = useState("");
  const [matricula, setMatricula] = useState("");
  const [clinica, setClinica] = useState("");
  const [direccion, setDireccion] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [terminos, setTerminos] = useState(false);

  const refs = useRef<Partial<Record<NombreCampo, EntradaTexto | null>>>({});
  const ref = (n: NombreCampo) => (r: EntradaTexto | null) => {
    refs.current[n] = r;
  };
  const editar = (n: NombreCampo, poner: (t: string) => void, filtro?: (t: string) => string) => (t: string) => {
    poner(filtro ? filtro(t) : t);
    if (errores[n]) setErrores((e) => ({ ...e, [n]: undefined }));
  };
  const t = (s: string) => s.trim();

  const especialidadesElegidas = () => PerfilVetRepo.todasLasEspecialidades.filter((_, i) => especialidades[i]);
  const tiposElegidos = () => TiposMascota.TODOS.filter((_, i) => tiposAnimales[i]);
  const diasElegidos = () => dias.map((d, i) => (d ? i + 1 : 0)).filter((d) => d > 0);

  // ---------- Navegación entre pasos ----------

  const hayDatosCargados = () => [nombre, dni, telefono].some((s) => t(s) !== "") || fotoPath != null || credencialPath != null;

  const irAlPasoAnterior = () => {
    if (paso > primerPaso) {
      setPaso(paso - 1);
    } else if (hayDatosCargados()) {
      Avisos.confirmar({
        titulo: "Salir del registro",
        mensaje: "Si salís ahora se pierden los datos que cargaste.",
        textoAceptar: "Salir",
        textoCancelar: "Seguir registrándome",
        alAceptar: cerrarPantalla,
      });
    } else {
      cerrarPantalla();
    }
  };
  useAtras(irAlPasoAnterior);

  // ---------- Validaciones ----------

  const mostrarErrores = (nuevos: ErroresCampos, orden: NombreCampo[]): boolean => {
    setErrores(nuevos);
    const primero = orden.find((n) => nuevos[n]);
    if (primero) refs.current[primero]?.focus();
    return primero === undefined;
  };

  const validarPasoActual = (): boolean => {
    const e: ErroresCampos = {};
    switch (paso) {
      case 0: {
        let ok = true;
        if (titulo == null) {
          Avisos.mostrar("Elegí si sos Dr. o Dra.");
          ok = false;
        }
        if (t(nombre).length < 3 || !t(nombre).includes(" ")) e.nombre = "Ingresá tu nombre y apellido";
        if (t(dni).length < 7 || t(dni).length > 8) e.dni = "El DNI debe tener 7 u 8 números";
        if (contarDigitos(t(telefono)) < 8) e.telefono = "Ingresá un teléfono válido";
        return mostrarErrores(e, ["nombre", "dni", "telefono"]) && ok;
      }
      case 1: {
        let ok = true;
        if (t(matricula).length < 3) e.matricula = "Ingresá tu matrícula";
        if (t(clinica).length < 3) e.clinica = "Ingresá el nombre de la veterinaria";
        if (t(direccion).length < 5) e.direccion = "Ingresá la dirección de la veterinaria";
        if (credencialPath == null) {
          Avisos.mostrar("Subí la foto de tu carnet o matrícula para que el administrador pueda verificarte");
          ok = false;
        }
        return mostrarErrores(e, ["matricula", "clinica", "direccion"]) && ok;
      }
      case 2: {
        const ok = especialidades.some((x) => x);
        setErrorEsp(!ok);
        const okTipos = tiposAnimales.some((x) => x);
        setErrorTipos(!okTipos);
        return ok && okTipos;
      }
      case 3:
        if (!dias.some((x) => x)) {
          Avisos.mostrar("Elegí al menos un día de atención");
          return false;
        }
        if (minutos(cierre) - minutos(apertura) < DisponibilidadVet.DURACION_MIN) {
          Avisos.mostrar("El horario de cierre tiene que ser posterior al de apertura");
          return false;
        }
        return true;
      default: {
        // La cuenta ya existe: no hay usuario ni contraseña que crear ni términos que volver a aceptar
        if (cuentaExistente) return true;
        let ok = true;
        if (!terminos) {
          Avisos.mostrar("Tenés que aceptar los términos y condiciones");
          ok = false;
        }
        if (!esCorreoValido(t(email).toLowerCase())) e.email = "Correo inválido";
        if (password.length < 6) e.password = "Mínimo 6 caracteres";
        if (password !== password2) e.password2 = "Las contraseñas no coinciden";
        return mostrarErrores(e, ["email", "password", "password2"]) && ok;
      }
    }
  };

  const avanzar = () => {
    if (enviando || !validarPasoActual()) return;
    if (paso < TITULOS.length - 1) setPaso(paso + 1);
    else void crearCuenta();
  };

  // ---------- Fotos ----------

  const cambiarFoto = async () => {
    const path = await elegirFoto({ recortar: true, prefijo: "foto_veterinario" });
    if (!path) return;
    descartarFoto(fotoPath);
    setFotoPath(path);
  };

  const cambiarCredencial = async () => {
    const path = await elegirFoto({ prefijo: "credencial_vet" });
    if (!path) return;
    descartarFoto(credencialPath);
    setCredencialPath(path);
  };

  /** Nombre tal como se muestra en la app: título y nombre completo. */
  const nombreCompleto = () => (cuentaExistente ? Sesion.perfil?.nombre ?? "" : `${titulo ?? ""} ${t(nombre)}`.trim());

  // ---------- Especialidades, animales y días ----------

  const marcar = (lista: boolean[], i: number, valor: boolean) => lista.map((x, j) => (j === i ? valor : x));

  const aplicarDias = (cantidad: number) => setDias((actuales) => actuales.map((_, i) => i < cantidad));

  const textoDias = () => {
    const activos = PerfilVetRepo.todosLosDias.filter((_, i) => dias[i]);
    return activos.length === 0 ? "ningún día" : activos.map((d) => d.slice(0, 3)).join(", ");
  };

  const resumenHorario = (): string => {
    if (!dias.some((x) => x)) return "Elegí al menos un día de atención.";
    if (minutos(cierre) - minutos(apertura) < DisponibilidadVet.DURACION_MIN) {
      return "El horario de cierre tiene que ser posterior al de apertura.";
    }
    const donde = sedesExtra.length === 0 ? "" : `En ${t(clinica) === "" ? "tu primera veterinaria" : t(clinica)}: `;
    return (
      donde +
      `Atendés ${textoDias()} de ${apertura} a ${cierre} hs. La duración de cada práctica la podés ajustar ` +
      "después desde tu perfil."
    );
  };

  // ---------- Otros lugares ----------

  const agregarLugar = () => {
    if (sedesExtra.length >= MAX_EXTRA) Avisos.mostrar(`Podés cargar hasta ${PerfilVetRepo.MAX_SEDES} lugares de atención`);
    else setEditor({ indice: null });
  };

  const guardarLugar = (sede: SedeVet) => {
    const indice = editor?.indice ?? null;
    setSedesExtra((lista) => (indice != null ? lista.map((s, i) => (i === indice ? sede : s)) : [...lista, sede]));
  };

  // ---------- Paso 5: resumen y alta ----------

  const resumenCuenta = () =>
    [
      cuentaExistente ? nombreCompleto() : `${nombreCompleto()} · DNI ${t(dni)}`,
      `Matrícula ${t(matricula)}`,
      `${t(clinica)} · ${t(direccion)}`,
      ...sedesExtra.map((s) => textoLugarSede(s)),
      especialidadesElegidas().join(", "),
      "Animales: " + tiposElegidos().map((x) => TiposMascota.plural(x)).join(", "),
      `Atención: ${textoDias()} · ${apertura} a ${cierre} hs`,
    ].join("\n");

  /** Un dueño con cuenta activa pide el alta como veterinario: sube el carnet y manda sus datos profesionales. */
  const solicitarAlta = async () => {
    const usuario = Sesion.usuarioId;
    if (!usuario) {
      Avisos.error("Tu sesión venció. Volvé a ingresar.");
      return;
    }
    const carnet = credencialPath;
    if (!carnet) return;
    setEnviando(true);
    try {
      const preparada = await Imagenes.prepararFoto(carnet);
      const ruta = await CredencialVet.subirArchivo(preparada, usuario);
      await Servicios.fuente.solicitarAltaVeterinario({
        matricula: t(matricula), clinica: t(clinica), direccionClinica: t(direccion), dias: diasElegidos(), apertura, cierre,
        especialidades: especialidadesElegidas(), tiposAnimales: tiposElegidos(), credencialPath: ruta, sedesExtra: [...sedesExtra],
      });
      borrarArchivoLocal(preparada);
      borrarArchivoLocal(carnet);
      try {
        await Sesion.actualizarRoles();
      } catch {
        // se entera la próxima vez que pida el perfil
      }
      Avisos.informar({
        titulo: "Solicitud enviada",
        mensaje:
          "Tus datos y la foto de tu carnet fueron enviados al administrador. Cuando verifique tu matrícula " +
          "vas a poder ingresar también como veterinario. Mientras tanto seguís usando la app como dueño.",
        cancelable: false,
        alAceptar: () => {
          Servicios.avisarCambio();
          cerrarPantalla();
        },
      });
    } catch (e) {
      setEnviando(false);
      Avisos.error(Errores.mensaje(e));
    }
  };

  const crearCuenta = async () => {
    if (cuentaExistente) {
      await solicitarAlta();
      return;
    }
    const nombreFinal = nombreCompleto();
    const datos = crearDatosRegistroVeterinario({
      nombre: nombreFinal, dni: t(dni), telefono: t(telefono), email: t(email).toLowerCase(), password,
      matricula: t(matricula), clinica: t(clinica), direccionClinica: t(direccion), especialidades: especialidadesElegidas(),
      tiposAnimales: tiposElegidos(), dias: diasElegidos(), apertura, cierre, fotoPath, credencialPath, sedesExtra: [...sedesExtra],
    });
    setEnviando(true);
    try {
      const resultado = await Registro.veterinario(datos);
      Avisos.informar({
        titulo: "Registro en revisión",
        mensaje:
          `¡Muchas gracias, ${nombreFinal}!\nTus datos y matrícula (${datos.matricula}) fueron enviados correctamente ` +
          "y están en proceso de revisión por el Administrador. Una vez verificados, tu cuenta será dada de alta.",
        cancelable: false,
        alAceptar: () => {
          EstadoAuth.terminarRegistro({ email: datos.email, confirmarCorreo: !resultado.sesionIniciada, esVeterinario: true });
          cerrarPantalla();
        },
      });
    } catch (e) {
      setEnviando(false);
      if (e instanceof Registro.CorreoYaRegistrado) {
        mostrarErrores({ email: "Ese correo ya está registrado" }, ["email"]);
        Avisos.informar({
          titulo: "Ese correo ya tiene una cuenta",
          mensaje:
            "Si es tu cuenta de dueño, no hace falta crear otra: ingresá con ella y, en tu perfil, tocá " +
            "\"Soy veterinario/a: pedir el alta\". Vas a poder usar la misma cuenta como dueño y como veterinario.",
        });
      } else {
        Avisos.error(Errores.mensaje(e));
      }
    }
  };

  const ultimo = paso === TITULOS.length - 1;
  const textoSiguiente = ultimo
    ? enviando
      ? cuentaExistente ? "Enviando..." : "Creando cuenta..."
      : cuentaExistente ? "Enviar solicitud" : "Crear cuenta"
    : "Continuar";

  return (
    <>
      <PasosRegistro
        titulo="Cuenta profesional"
        textoPaso={`Paso ${paso - primerPaso + 1} de ${TITULOS.length - primerPaso} · ${TITULOS[paso]}`}
        total={TITULOS.length - primerPaso}
        encendidos={paso - primerPaso + 1}
        clavePaso={paso}
        mostrarAtras={paso > primerPaso}
        textoSiguiente={textoSiguiente}
        enviando={enviando}
        alVolver={irAlPasoAnterior}
        alAtras={irAlPasoAnterior}
        alSiguiente={avanzar}
      >
        {paso === 0 ? (
          <View>
            <CabeceraPaso icono="persona" titulo="Contanos quién sos" subtitulo="Estos datos identifican tu perfil profesional." />
            <View style={{ marginTop: 22 }}>
              <FotoRedonda tamano={104} uri={fotoPath} icono="persona" descripcion="Foto de perfil" bordeBlanco onPress={cambiarFoto} />
            </View>
            <Texto variante="chico" centrado style={{ marginTop: 8 }}>Foto de perfil (opcional)</Texto>
            <Texto variante="etiqueta" style={estilos.etiqueta}>Cómo querés que te llamemos</Texto>
            <GrupoChips>
              {TITULOS_PROFESIONALES.map((p) => (
                <ChipRegistro key={p} texto={p} marcado={titulo === p} alCambiar={(m) => setTitulo(m ? p : titulo === p ? null : titulo)} />
              ))}
            </GrupoChips>
            <Campo
              ref={ref("nombre")} estilo={estilos.campo} etiqueta="Nombre y apellido" placeholder="Ej: Ana Gómez" value={nombre}
              onChangeText={editar("nombre", setNombre)} error={errores.nombre} autoCapitalize="words" textContentType="name"
            />
            <Campo
              ref={ref("dni")} estilo={estilos.campo} etiqueta="DNI" placeholder="Sin puntos" value={dni}
              onChangeText={editar("dni", setDni, soloNumeros)} error={errores.dni} keyboardType="number-pad"
            />
            <Campo
              ref={ref("telefono")} estilo={estilos.campo} etiqueta="Teléfono de contacto" placeholder="Ej: 11 4000-1234" value={telefono}
              onChangeText={editar("telefono", setTelefono)} error={errores.telefono} keyboardType="phone-pad" textContentType="telephoneNumber"
              onSubmitEditing={avanzar}
            />
          </View>
        ) : null}

        {paso === 1 ? (
          <View>
            <CabeceraPaso icono="medico" titulo="Tu práctica profesional" subtitulo="Los dueños van a ver estos datos al buscarte." />
            <Campo
              ref={ref("matricula")} estilo={estilos.campoPrimero} etiqueta="Matrícula profesional" placeholder="Ej: MP-12345" value={matricula}
              onChangeText={editar("matricula", setMatricula)} error={errores.matricula} autoCapitalize="characters"
            />
            <Campo
              ref={ref("clinica")} estilo={estilos.campo} etiqueta="Veterinaria o clínica donde atendés" placeholder="Ej: Clínica Veterinaria Central"
              value={clinica} onChangeText={editar("clinica", setClinica)} error={errores.clinica} autoCapitalize="words"
            />
            <Campo
              ref={ref("direccion")} estilo={estilos.campo} etiqueta="Dirección de la veterinaria" placeholder="Calle, número y ciudad"
              value={direccion} onChangeText={editar("direccion", setDireccion)} error={errores.direccion} autoCapitalize="words"
            />

            <View style={{ marginTop: 8 }}>
              {sedesExtra.map((s, i) => (
                <FilaSede key={`${s.nombre}-${i}`} sede={s} alTocar={() => setEditor({ indice: i })} />
              ))}
            </View>
            {sedesExtra.length < MAX_EXTRA ? (
              <Boton titulo="Agregar otra veterinaria" icono="mas" variante="texto" alto={44} estilo={{ marginTop: 4, alignSelf: "flex-start" }} onPress={agregarLugar} />
            ) : null}
            <Texto variante="chico">Si trabajás en más de una veterinaria o consultorio, sumala con su dirección, sus días y sus horarios.</Texto>

            <Texto variante="etiqueta" style={estilos.etiqueta}>Foto de tu carnet o matrícula</Texto>
            <Texto variante="chico" style={{ marginTop: 2 }}>
              Solo la ve el administrador y la usa para verificar tu matrícula antes de darte el alta.
            </Texto>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Foto del carnet o matrícula"
              onPress={cambiarCredencial}
              style={[estilos.credencial, cursorTocable]}
            >
              <ImagenRemota
                fotoUri={credencialPath}
                estilo={estilos.credencialImagen}
                respaldo={<Icono nombre="camara" tamano={74} color={Colores.textGray} />}
              />
            </Pressable>
            <Boton
              titulo={credencialPath ? "Cambiar foto" : "Elegir foto del carnet"} variante="secundario" alto={48}
              estilo={{ marginTop: 8 }} onPress={cambiarCredencial}
            />
          </View>
        ) : null}

        {paso === 2 ? (
          <View>
            <CabeceraPaso icono="vacuna" titulo="Tus especialidades" subtitulo="Elegí todas las prácticas que realizás." />
            <Texto variante="etiqueta" color={Colores.tealDark} style={{ marginTop: 18 }}>
              {(() => {
                const total = especialidades.filter((x) => x).length;
                return total === 0 ? "Ninguna seleccionada" : total === 1 ? "1 seleccionada" : `${total} seleccionadas`;
              })()}
            </Texto>
            <GrupoChips estilo={{ marginTop: 10 }} espacioVertical={4}>
              {PerfilVetRepo.todasLasEspecialidades.map((nombreEsp, i) => (
                <ChipRegistro
                  key={nombreEsp} texto={nombreEsp} marcado={especialidades[i]}
                  alCambiar={(m) => {
                    setEspecialidades((l) => marcar(l, i, m));
                    if (m) setErrorEsp(false);
                  }}
                />
              ))}
            </GrupoChips>
            {errorEsp ? <Texto variante="chico" tamano={13} color={Colores.dangerRed} style={{ marginTop: 8 }}>Elegí al menos una especialidad</Texto> : null}

            <Texto variante="titulo" tamano={18} style={{ marginTop: 24 }}>Animales que atendés</Texto>
            <Texto variante="subtitulo" tamano={14} style={{ marginTop: 4 }}>
              Los dueños solo van a poder sacarte turno para estos tipos de mascota. Lo podés cambiar después desde tu perfil.
            </Texto>
            <GrupoChips estilo={{ marginTop: 10 }}>
              {TiposMascota.TODOS.map((tipo, i) => (
                <ChipRegistro
                  key={tipo} texto={TiposMascota.plural(tipo)} marcado={tiposAnimales[i]}
                  alCambiar={(m) => {
                    setTiposAnimales((l) => marcar(l, i, m));
                    if (m) setErrorTipos(false);
                  }}
                />
              ))}
            </GrupoChips>
            {errorTipos ? <Texto variante="chico" tamano={13} color={Colores.dangerRed} style={{ marginTop: 8 }}>Elegí al menos un tipo de animal</Texto> : null}
          </View>
        ) : null}

        {paso === 3 ? (
          <View>
            <CabeceraPaso icono="reloj" titulo="Tu horario de atención" subtitulo="Los turnos solo se van a poder agendar en estos días y horarios." />
            <Texto variante="etiqueta" style={[estilos.etiqueta, { marginTop: 22 }]}>Días que atendés</Texto>
            <GrupoChips estilo={{ marginTop: 4 }} espacioVertical={4}>
              {PerfilVetRepo.todosLosDias.map((d, i) => (
                <ChipRegistro key={d} texto={d.slice(0, 3)} marcado={dias[i]} alCambiar={(m) => setDias((l) => marcar(l, i, m))} />
              ))}
            </GrupoChips>
            <View style={estilos.presets}>
              <Pressable accessibilityRole="button" onPress={() => aplicarDias(5)} style={[estilos.preset, cursorTocable]}>
                <Texto variante="etiqueta" tamano={13} color={Colores.primaryTeal}>Lunes a viernes</Texto>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => aplicarDias(6)} style={[estilos.preset, cursorTocable]}>
                <Texto variante="etiqueta" tamano={13} color={Colores.primaryTeal}>Lunes a sábado</Texto>
              </Pressable>
            </View>
            <View style={estilos.horas}>
              <CampoHora etiqueta="Desde" valor={apertura} onPress={() => setEligiendoHora("apertura")} />
              <CampoHora etiqueta="Hasta" valor={cierre} onPress={() => setEligiendoHora("cierre")} />
            </View>
            <CajaInfo estilo={{ marginTop: 16 }} texto={resumenHorario()} />
          </View>
        ) : null}

        {paso === 4 ? (
          <View>
            <CabeceraPaso
              icono="candado"
              titulo={cuentaExistente ? "Revisá y enviá" : "Creá tu cuenta"}
              subtitulo={
                cuentaExistente
                  ? "El administrador va a verificar tu matrícula. Mientras tanto seguís usando la app como dueño."
                  : "Con estos datos vas a iniciar sesión."
              }
            />
            {!cuentaExistente ? (
              <>
                <Campo
                  ref={ref("email")} estilo={estilos.campoPrimero} etiqueta="Correo electrónico" placeholder="nombre@correo.com" value={email}
                  onChangeText={editar("email", setEmail)} error={errores.email} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                  textContentType="emailAddress"
                />
                <Campo
                  ref={ref("password")} estilo={estilos.campo} etiqueta="Contraseña" placeholder="Mínimo 6 caracteres" value={password}
                  onChangeText={editar("password", setPassword)} error={errores.password} contrasena textContentType="newPassword"
                />
                <Campo
                  ref={ref("password2")} estilo={estilos.campo} etiqueta="Confirmar contraseña" placeholder="Repetí la contraseña" value={password2}
                  onChangeText={editar("password2", setPassword2)} error={errores.password2} contrasena textContentType="newPassword" onSubmitEditing={avanzar}
                />
              </>
            ) : null}
            <View style={estilos.resumen}>
              <Texto variante="cuerpo" tamano={13.5}>{resumenCuenta()}</Texto>
            </View>
            {!cuentaExistente ? <Casilla texto="Acepto los términos y condiciones" marcada={terminos} alCambiar={setTerminos} estilo={{ marginTop: 12 }} /> : null}
          </View>
        ) : null}
      </PasosRegistro>

      {editor ? (
        <EditorSedeRegistro
          sede={editor.indice != null ? sedesExtra[editor.indice] : null}
          alGuardar={guardarLugar}
          alEliminar={
            editor.indice != null
              ? () => {
                  const i = editor.indice;
                  setSedesExtra((lista) => lista.filter((_, j) => j !== i));
                }
              : undefined
          }
          alCerrar={() => setEditor(null)}
        />
      ) : null}

      <SelectorHoraLibre
        visible={eligiendoHora != null}
        valor={eligiendoHora === "cierre" ? cierre : apertura}
        titulo={eligiendoHora === "cierre" ? "Hora de cierre" : "Hora de apertura"}
        alElegir={(h) => (eligiendoHora === "cierre" ? setCierre(h) : setApertura(h))}
        alCerrar={() => setEligiendoHora(null)}
      />
    </>
  );
}

const estilos = StyleSheet.create({
  etiqueta: { marginTop: 14, marginBottom: 6 },
  campoPrimero: { marginTop: 22 },
  campo: { marginTop: 14 },
  sede: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colores.dividerLight },
  sedeIcono: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
  sedeTextos: { flex: 1, minWidth: 0, marginHorizontal: 12 },
  credencial: { marginTop: 8, height: 170, borderRadius: 16, borderWidth: 1, borderColor: Colores.loginFieldStroke, backgroundColor: Colores.white, overflow: "hidden" },
  credencialImagen: { width: "100%", height: "100%" },
  presets: { flexDirection: "row", marginTop: 4, gap: 10 },
  preset: { padding: 6, minHeight: 36, justifyContent: "center" },
  horas: { flexDirection: "row", gap: 12 },
  hora: {
    minHeight: 50, justifyContent: "center", paddingHorizontal: 16, borderRadius: 16, borderWidth: 1,
    borderColor: Colores.loginFieldStroke, backgroundColor: Colores.white,
  },
  resumen: { marginTop: 18, backgroundColor: Colores.white, borderRadius: 18, padding: 16 },
});
