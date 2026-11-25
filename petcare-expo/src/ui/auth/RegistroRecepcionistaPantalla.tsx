/*
 * Alta de cuenta para trabajar en la recepción de un veterinario, en tres pasos (como el registro de dueño): datos
 * personales, el veterinario y la cuenta. Al pasar del segundo paso se confirma el veterinario por su correo o su
 * matrícula; el servidor deja el pedido hecho al crear la cuenta y el veterinario lo acepta desde su perfil.
 * El veterinario se puede dejar para más tarde: se pide desde Perfil → Trabajo en recepción.
 */
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Registro } from "../../data/registro";
import type { VeterinarioParaRecepcionDto } from "../../data/remoto/dtos";
import { Errores } from "../../util/errores";
import { Avisos } from "../common/Avisos";
import { Campo } from "../common/Campo";
import { Colores, sombra } from "../common/tema";
import { Texto } from "../common/Texto";
import { CajaInfo, Casilla } from "./ElementosRegistro";
import { descartarFoto, elegirFoto } from "./elegirFoto";
import { cerrarPantalla, EstadoAuth } from "./estadoAuth";
import { FotoRedonda } from "./FotoRedonda";
import { CabeceraPaso, PasosRegistro } from "./PasosRegistro";
import { contarDigitos, esCorreoValido, soloNumeros } from "./validaciones";
import { useAtras } from "./useAtras";
import type { EntradaTexto } from "./tipos";

const TITULOS = ["Datos personales", "Tu veterinario", "Tu cuenta"];

type NombreCampo = "nombre" | "dni" | "telefono" | "veterinario" | "email" | "password" | "password2";
type ErroresCampos = Partial<Record<NombreCampo, string>>;

export default function RegistroRecepcionistaPantalla() {
  const [paso, setPaso] = useState(0);
  const [fotoPath, setFotoPath] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [errores, setErrores] = useState<ErroresCampos>({});

  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [telefono, setTelefono] = useState("");
  const [datoVet, setDatoVet] = useState("");
  /** Veterinario confirmado con [datoVet]; null mientras no se buscó o si se deja para más tarde. */
  const [veterinario, setVeterinario] = useState<VeterinarioParaRecepcionDto | null>(null);
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

  // ---------- Navegación entre pasos ----------

  const hayDatosCargados = () => [nombre, dni, telefono].some((s) => t(s) !== "") || fotoPath != null;

  const irAlPasoAnterior = () => {
    if (paso > 0) {
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
      case 0:
        if (t(nombre).length < 3 || !t(nombre).includes(" ")) e.nombre = "Ingresá tu nombre y apellido";
        if (t(dni).length < 7 || t(dni).length > 8) e.dni = "El DNI debe tener 7 u 8 números";
        if (contarDigitos(t(telefono)) < 8) e.telefono = "Ingresá un teléfono válido";
        return mostrarErrores(e, ["nombre", "dni", "telefono"]);
      case 1:
        return true;
      default: {
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

  /** Confirma el veterinario antes de pasar a la cuenta; vacío, se deja para más tarde. */
  const confirmarVeterinario = async (): Promise<boolean> => {
    if (t(datoVet) === "") {
      setVeterinario(null);
      return true;
    }
    if (t(datoVet).length < 3) return mostrarErrores({ veterinario: "Ingresá el correo o la matrícula del veterinario" }, ["veterinario"]);
    setBuscando(true);
    try {
      const encontrado = await Registro.buscarVeterinario(datoVet);
      if (!encontrado) {
        return mostrarErrores({ veterinario: "No encontramos un veterinario activo con ese correo o matrícula" }, ["veterinario"]);
      }
      setVeterinario(encontrado);
      return true;
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
      return false;
    } finally {
      setBuscando(false);
    }
  };

  const avanzar = async () => {
    if (enviando || buscando || !validarPasoActual()) return;
    if (paso === 1 && !(await confirmarVeterinario())) return;
    if (paso < TITULOS.length - 1) setPaso(paso + 1);
    else void crearCuenta();
  };

  const cambiarFoto = async () => {
    const path = await elegirFoto({ recortar: true });
    if (!path) return;
    descartarFoto(fotoPath);
    setFotoPath(path);
  };

  // ---------- Paso 3: resumen y alta ----------

  const resumen = () =>
    [
      `${t(nombre)} · DNI ${t(dni)}`,
      veterinario
        ? `Recepción de ${veterinario.nombre}${veterinario.clinica ? ` (${veterinario.clinica})` : ""}`
        : "Sin veterinario por ahora",
    ].join("\n");

  const crearCuenta = async () => {
    setEnviando(true);
    try {
      const resultado = await Registro.recepcionista({
        nombre: t(nombre), dni: t(dni), telefono: t(telefono), email: t(email).toLowerCase(), password, fotoPath,
        recepcionDe: veterinario ? t(datoVet) : null,
      });
      EstadoAuth.terminarRegistro({ email: t(email).toLowerCase(), confirmarCorreo: !resultado.sesionIniciada, esVeterinario: false });
      cerrarPantalla();
    } catch (e) {
      setEnviando(false);
      if (e instanceof Registro.CorreoYaRegistrado) {
        setPaso(2);
        mostrarErrores({ email: "Ese correo ya está registrado" }, ["email"]);
      } else {
        Avisos.error(Errores.mensaje(e));
      }
    }
  };

  let textoSiguiente: string;
  if (enviando) textoSiguiente = "Creando cuenta...";
  else if (buscando) textoSiguiente = "Buscando...";
  else if (paso === TITULOS.length - 1) textoSiguiente = "Crear cuenta";
  else if (paso === 1 && t(datoVet) === "") textoSiguiente = "Omitir por ahora";
  else textoSiguiente = "Continuar";

  return (
    <PasosRegistro
      titulo="Crear cuenta"
      textoPaso={`Paso ${paso + 1} de ${TITULOS.length} · ${TITULOS[paso]}`}
      total={TITULOS.length}
      encendidos={paso + 1}
      clavePaso={paso}
      mostrarAtras={paso > 0}
      textoSiguiente={textoSiguiente}
      enviando={enviando || buscando}
      alVolver={irAlPasoAnterior}
      alAtras={irAlPasoAnterior}
      alSiguiente={() => void avanzar()}
    >
      {paso === 0 ? (
        <View>
          <CabeceraPaso icono="persona" titulo="Contanos quién sos" subtitulo="Con estos datos te reconoce el veterinario." />
          <View style={{ marginTop: 22 }}>
            <FotoRedonda tamano={104} uri={fotoPath} icono="persona" descripcion="Foto de perfil" bordeBlanco onPress={cambiarFoto} />
          </View>
          <Texto variante="chico" centrado style={estilos.opcional}>Foto de perfil (opcional)</Texto>
          <Campo
            ref={ref("nombre")} estilo={estilos.campoPrimero} etiqueta="Nombre y apellido" placeholder="Nombre y apellido"
            value={nombre} onChangeText={editar("nombre", setNombre)} error={errores.nombre} autoCapitalize="words" textContentType="name"
          />
          <Campo
            ref={ref("dni")} estilo={estilos.campo} etiqueta="DNI" placeholder="Sin puntos" value={dni}
            onChangeText={editar("dni", setDni, soloNumeros)} error={errores.dni} keyboardType="number-pad"
          />
          <Campo
            ref={ref("telefono")} estilo={estilos.campo} etiqueta="Teléfono de contacto" placeholder="Ej: 11 4444-5555" value={telefono}
            onChangeText={editar("telefono", setTelefono)} error={errores.telefono} keyboardType="phone-pad" textContentType="telephoneNumber"
            onSubmitEditing={() => void avanzar()}
          />
        </View>
      ) : null}

      {paso === 1 ? (
        <View>
          <CabeceraPaso
            icono="veterinario" titulo="¿Para quién trabajás?"
            subtitulo="Le mandamos tu pedido al veterinario y te suma a su recepción cuando lo acepte."
          />
          <Campo
            ref={ref("veterinario")} estilo={estilos.campoPrimero} etiqueta="Correo o matrícula del veterinario"
            placeholder="Ej: vera@clinica.com o MP-1234" value={datoVet}
            onChangeText={(texto) => { editar("veterinario", setDatoVet)(texto); setVeterinario(null); }}
            error={errores.veterinario} autoCapitalize="none" autoCorrect={false} onSubmitEditing={() => void avanzar()}
          />
          <CajaInfo
            texto="Si todavía no lo sabés, podés omitir este paso y pedirlo después desde tu perfil, en Trabajo en recepción."
            estilo={estilos.campo}
          />
        </View>
      ) : null}

      {paso === 2 ? (
        <View>
          <CabeceraPaso icono="candado" titulo="Creá tu cuenta" subtitulo="Con estos datos vas a iniciar sesión." />
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
            onChangeText={editar("password2", setPassword2)} error={errores.password2} contrasena textContentType="newPassword"
            onSubmitEditing={() => void avanzar()}
          />
          <View style={estilos.resumen}>
            <Texto variante="cuerpo" tamano={13.5}>{resumen()}</Texto>
          </View>
          <Casilla texto="Acepto los términos y condiciones" marcada={terminos} alCambiar={setTerminos} estilo={{ marginTop: 12 }} />
        </View>
      ) : null}
    </PasosRegistro>
  );
}

const estilos = StyleSheet.create({
  opcional: { marginTop: 8 },
  campoPrimero: { marginTop: 18 },
  campo: { marginTop: 14 },
  resumen: { marginTop: 18, backgroundColor: Colores.white, borderRadius: 18, padding: 16, ...sombra(1) },
});
