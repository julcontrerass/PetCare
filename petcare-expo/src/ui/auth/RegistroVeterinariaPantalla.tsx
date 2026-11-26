/*
 * Registro "Mi veterinaria": para quien lleva una veterinaria sin ser veterinario (el dueño del negocio). En cinco
 * pasos (como el registro de dueño): sus datos; los de la veterinaria (con su logo, opcional, y su CUIT); el director
 * técnico (el veterinario matriculado responsable); las habilitaciones comercial y sanitaria; y la cuenta. Queda como
 * titular y la veterinaria espera que el administrador verifique todo; después suma a sus veterinarios y a su equipo.
 */
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { ArchivoHabilitacion } from "../../data/habilitaciones";
import { Registro } from "../../data/registro";
import { Errores } from "../../util/errores";
import { Colores, sombra } from "../common/tema";
import { Avisos } from "../common/Avisos";
import { Campo } from "../common/Campo";
import { LogoVeterinaria } from "../common/LogoVeterinaria";
import { SelectorHabilitacion } from "../common/SelectorHabilitacion";
import { Texto } from "../common/Texto";
import { CajaInfo, Casilla } from "./ElementosRegistro";
import { descartarFoto, elegirFoto } from "./elegirFoto";
import { cerrarPantalla, EstadoAuth } from "./estadoAuth";
import { CabeceraPaso, PasosRegistro } from "./PasosRegistro";
import { contarDigitos, errorDeCuit, esCorreoValido, esCuitValido, soloNumeros } from "./validaciones";
import { useAtras } from "./useAtras";
import type { EntradaTexto } from "./tipos";

const TITULOS = ["Tus datos", "La veterinaria", "Director técnico", "Habilitaciones", "Tu cuenta"];
const PASO_CUENTA = TITULOS.length - 1;

type NombreCampo =
  | "nombre" | "dni" | "telefono" | "vetNombre" | "vetDireccion" | "vetTelefono" | "cuit"
  | "dirNombre" | "dirDni" | "dirMatricula" | "comercial" | "sanitaria" | "email" | "password" | "password2";
type ErroresCampos = Partial<Record<NombreCampo, string>>;

/** "20-12345678-6" mientras se escribe. */
function formatoCuit(texto: string): string {
  const d = soloNumeros(texto).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 10) return `${d.slice(0, 2)}-${d.slice(2)}`;
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

export default function RegistroVeterinariaPantalla() {
  const [paso, setPaso] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState<ErroresCampos>({});

  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [telefono, setTelefono] = useState("");
  const [vetNombre, setVetNombre] = useState("");
  const [vetDireccion, setVetDireccion] = useState("");
  const [vetTelefono, setVetTelefono] = useState("");
  const [cuit, setCuit] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [dirNombre, setDirNombre] = useState("");
  const [dirDni, setDirDni] = useState("");
  const [dirMatricula, setDirMatricula] = useState("");
  const [comercial, setComercial] = useState<ArchivoHabilitacion | null>(null);
  const [sanitaria, setSanitaria] = useState<ArchivoHabilitacion | null>(null);
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

  const irAlPasoAnterior = () => {
    if (paso > 0) {
      setPaso(paso - 1);
    } else if ([nombre, dni, telefono].some((s) => t(s) !== "")) {
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

  const elegirLogo = async () => {
    const uri = await elegirFoto({ recortar: true, prefijo: "logo_veterinaria" });
    if (!uri) return;
    descartarFoto(logo);
    setLogo(uri);
  };

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
        if (t(vetNombre).length < 2) e.vetNombre = "Ingresá el nombre de la veterinaria";
        if (t(vetDireccion).length < 5) e.vetDireccion = "Ingresá la dirección: la usamos para verificarla";
        if (contarDigitos(t(vetTelefono)) < 8) e.vetTelefono = "Ingresá el teléfono de la veterinaria";
        if (!esCuitValido(cuit)) e.cuit = errorDeCuit(cuit);
        return mostrarErrores(e, ["vetNombre", "vetDireccion", "vetTelefono", "cuit"]);
      case 2:
        if (t(dirNombre).length < 3 || !t(dirNombre).includes(" ")) e.dirNombre = "Ingresá el nombre y el apellido del director técnico";
        if (t(dirDni).length < 7 || t(dirDni).length > 8) e.dirDni = "El DNI debe tener 7 u 8 números";
        if (t(dirMatricula).length < 2) e.dirMatricula = "Ingresá su matrícula";
        return mostrarErrores(e, ["dirNombre", "dirDni", "dirMatricula"]);
      case 3:
        if (!comercial) e.comercial = "Sumá la habilitación comercial";
        if (!sanitaria) e.sanitaria = "Sumá la habilitación sanitaria";
        setErrores(e);
        return Object.keys(e).length === 0;
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

  const avanzar = () => {
    if (enviando || !validarPasoActual()) return;
    if (paso < PASO_CUENTA) setPaso(paso + 1);
    else void crearCuenta();
  };

  const crearCuenta = async () => {
    if (!comercial || !sanitaria) return;
    const correo = t(email).toLowerCase();
    setEnviando(true);
    try {
      const resultado = await Registro.veterinaria({
        nombre: t(nombre), dni: t(dni), telefono: t(telefono), email: correo, password,
        veterinaria: { nombre: t(vetNombre), direccion: t(vetDireccion), telefono: t(vetTelefono), cuit },
        director: { nombre: t(dirNombre), dni: t(dirDni), matricula: t(dirMatricula) },
        habilitaciones: { comercial, sanitaria },
        logoPath: logo,
      });
      EstadoAuth.terminarRegistro({ email: correo, confirmarCorreo: !resultado.sesionIniciada, esVeterinario: false });
      cerrarPantalla();
    } catch (e) {
      setEnviando(false);
      if (e instanceof Registro.CorreoYaRegistrado) {
        setPaso(PASO_CUENTA);
        mostrarErrores({ email: "Ese correo ya está registrado" }, ["email"]);
      } else {
        Avisos.error(Errores.mensaje(e));
      }
    }
  };

  const resumen = () =>
    [
      `${t(nombre)} · DNI ${t(dni)}`,
      `${t(vetNombre)} · CUIT ${formatoCuit(cuit)}`,
      t(vetDireccion),
      `Director técnico: ${t(dirNombre)} · Matrícula ${t(dirMatricula)}`,
      "Habilitaciones comercial y sanitaria cargadas",
    ].join("\n");

  return (
    <PasosRegistro
      titulo="Registrar mi veterinaria"
      textoPaso={`Paso ${paso + 1} de ${TITULOS.length} · ${TITULOS[paso]}`}
      total={TITULOS.length}
      encendidos={paso + 1}
      clavePaso={paso}
      mostrarAtras={paso > 0}
      textoSiguiente={enviando ? "Creando cuenta..." : paso === PASO_CUENTA ? "Crear cuenta" : "Continuar"}
      enviando={enviando}
      alVolver={irAlPasoAnterior}
      alAtras={irAlPasoAnterior}
      alSiguiente={avanzar}
    >
      {paso === 0 ? (
        <View>
          <CabeceraPaso icono="persona" titulo="Quién lleva la veterinaria" subtitulo="Vas a quedar como titular: sumás a los veterinarios y al equipo." />
          <Campo
            ref={ref("nombre")} estilo={estilos.campoPrimero} etiqueta="Nombre y apellido" placeholder="Nombre y apellido"
            value={nombre} onChangeText={editar("nombre", setNombre)} error={errores.nombre} autoCapitalize="words" textContentType="name"
          />
          <Campo
            ref={ref("dni")} estilo={estilos.campo} etiqueta="DNI" placeholder="Sin puntos" value={dni}
            onChangeText={editar("dni", setDni, soloNumeros)} error={errores.dni} keyboardType="number-pad"
          />
          <Campo
            ref={ref("telefono")} estilo={estilos.campo} etiqueta="Tu teléfono" placeholder="Ej: 11 4444-5555" value={telefono}
            onChangeText={editar("telefono", setTelefono)} error={errores.telefono} keyboardType="phone-pad" textContentType="telephoneNumber"
            onSubmitEditing={avanzar}
          />
        </View>
      ) : null}

      {paso === 1 ? (
        <View>
          <CabeceraPaso icono="sede" titulo="Tu veterinaria" subtitulo="Con estos datos el administrador de PetCare verifica que exista." />
          <View style={estilos.logo}>
            <LogoVeterinaria uri={logo} nombre={t(vetNombre) || undefined} tamano={104} alTocar={() => void elegirLogo()} />
            <Texto variante="chico" centrado style={{ marginTop: 8 }}>Logo de la veterinaria (opcional)</Texto>
            <Texto variante="chico" tamano={12} centrado>Lo ve tu equipo en la app, junto al nombre de la veterinaria.</Texto>
          </View>
          <Campo
            ref={ref("vetNombre")} estilo={estilos.campoPrimero} etiqueta="Nombre de la veterinaria" placeholder="Ej: Veterinaria Panda"
            value={vetNombre} onChangeText={editar("vetNombre", setVetNombre)} error={errores.vetNombre} autoCapitalize="words"
          />
          <Campo
            ref={ref("vetDireccion")} estilo={estilos.campo} etiqueta="Dirección" placeholder="Calle, número y localidad"
            value={vetDireccion} onChangeText={editar("vetDireccion", setVetDireccion)} error={errores.vetDireccion} autoCapitalize="words"
          />
          <Campo
            ref={ref("vetTelefono")} estilo={estilos.campo} etiqueta="Teléfono de la veterinaria" placeholder="Ej: 11 4444-5555"
            value={vetTelefono} onChangeText={editar("vetTelefono", setVetTelefono)} error={errores.vetTelefono} keyboardType="phone-pad"
          />
          <Campo
            ref={ref("cuit")} estilo={estilos.campo} etiqueta="CUIT" placeholder="Ej: 30-12345678-9" value={cuit}
            onChangeText={editar("cuit", setCuit, formatoCuit)} error={errores.cuit} keyboardType="number-pad" onSubmitEditing={avanzar}
          />
        </View>
      ) : null}

      {paso === 2 ? (
        <View>
          <CabeceraPaso
            icono="veterinario" titulo="Director técnico"
            subtitulo="Toda veterinaria necesita un veterinario matriculado que sea su director técnico (o asesor técnico)."
          />
          <Campo
            ref={ref("dirNombre")} estilo={estilos.campoPrimero} etiqueta="Nombre y apellido" placeholder="Ej: Dra. Ana Gómez"
            value={dirNombre} onChangeText={editar("dirNombre", setDirNombre)} error={errores.dirNombre} autoCapitalize="words"
          />
          <Campo
            ref={ref("dirDni")} estilo={estilos.campo} etiqueta="DNI" placeholder="Sin puntos" value={dirDni}
            onChangeText={editar("dirDni", setDirDni, soloNumeros)} error={errores.dirDni} keyboardType="number-pad"
          />
          <Campo
            ref={ref("dirMatricula")} estilo={estilos.campo} etiqueta="Matrícula" placeholder="Ej: MP 12345" value={dirMatricula}
            onChangeText={editar("dirMatricula", setDirMatricula)} error={errores.dirMatricula} autoCapitalize="characters" onSubmitEditing={avanzar}
          />
          <CajaInfo texto="Si ya usa PetCare como veterinario lo reconocemos por su matrícula o su DNI y le llega una invitación para sumarse a tu equipo." />
        </View>
      ) : null}

      {paso === 3 ? (
        <View>
          <CabeceraPaso icono="documento" titulo="Habilitaciones" subtitulo="Subí un PDF o una foto de cada una. Solo las ve el administrador de PetCare." />
          <View style={{ marginTop: 8 }}>
            <SelectorHabilitacion
              tipo="comercial" archivo={comercial} error={errores.comercial}
              alElegir={(a) => { setComercial(a); setErrores((x) => ({ ...x, comercial: undefined })); }}
            />
            <SelectorHabilitacion
              tipo="sanitaria" archivo={sanitaria} error={errores.sanitaria}
              alElegir={(a) => { setSanitaria(a); setErrores((x) => ({ ...x, sanitaria: undefined })); }}
            />
          </View>
          <CajaInfo texto="Mientras revisamos todo podés entrar a la app. Cuando esté aprobada vas a poder sumar a tus veterinarios y a tu equipo." />
        </View>
      ) : null}

      {paso === PASO_CUENTA ? (
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
            onChangeText={editar("password2", setPassword2)} error={errores.password2} contrasena textContentType="newPassword" onSubmitEditing={avanzar}
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
  campoPrimero: { marginTop: 18 },
  logo: { alignItems: "center", marginTop: 20 },
  campo: { marginTop: 14 },
  resumen: { marginTop: 18, backgroundColor: Colores.white, borderRadius: 18, padding: 16, ...sombra(1) },
});
