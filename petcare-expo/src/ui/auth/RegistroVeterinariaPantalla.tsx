/*
 * Registro "Mi veterinaria": para quien lleva una veterinaria sin ser veterinario (el dueño del negocio). En tres
 * pasos (como el registro de dueño): sus datos, los de la veterinaria y la cuenta. Queda como titular y la
 * veterinaria espera que el administrador verifique que existe; después suma a sus veterinarios y a su equipo.
 */
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Registro } from "../../data/registro";
import { Errores } from "../../util/errores";
import { Colores, sombra } from "../common/tema";
import { Avisos } from "../common/Avisos";
import { Campo } from "../common/Campo";
import { Texto } from "../common/Texto";
import { CajaInfo, Casilla } from "./ElementosRegistro";
import { cerrarPantalla, EstadoAuth } from "./estadoAuth";
import { CabeceraPaso, PasosRegistro } from "./PasosRegistro";
import { contarDigitos, esCorreoValido, soloNumeros } from "./validaciones";
import { useAtras } from "./useAtras";
import type { EntradaTexto } from "./tipos";

const TITULOS = ["Tus datos", "La veterinaria", "Tu cuenta"];

type NombreCampo = "nombre" | "dni" | "telefono" | "vetNombre" | "vetDireccion" | "vetTelefono" | "email" | "password" | "password2";
type ErroresCampos = Partial<Record<NombreCampo, string>>;

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
        return mostrarErrores(e, ["vetNombre", "vetDireccion", "vetTelefono"]);
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
    if (paso < TITULOS.length - 1) setPaso(paso + 1);
    else void crearCuenta();
  };

  const crearCuenta = async () => {
    const correo = t(email).toLowerCase();
    setEnviando(true);
    try {
      const resultado = await Registro.veterinaria({
        nombre: t(nombre), dni: t(dni), telefono: t(telefono), email: correo, password,
        veterinaria: { nombre: t(vetNombre), direccion: t(vetDireccion), telefono: t(vetTelefono) },
      });
      EstadoAuth.terminarRegistro({ email: correo, confirmarCorreo: !resultado.sesionIniciada, esVeterinario: false });
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

  const resumen = () =>
    [`${t(nombre)} · DNI ${t(dni)}`, `${t(vetNombre)} · ${t(vetDireccion)}`, `Teléfono de la veterinaria: ${t(vetTelefono)}`].join("\n");

  return (
    <PasosRegistro
      titulo="Registrar mi veterinaria"
      textoPaso={`Paso ${paso + 1} de ${TITULOS.length} · ${TITULOS[paso]}`}
      total={TITULOS.length}
      encendidos={paso + 1}
      clavePaso={paso}
      mostrarAtras={paso > 0}
      textoSiguiente={enviando ? "Creando cuenta..." : paso === TITULOS.length - 1 ? "Crear cuenta" : "Continuar"}
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
            onSubmitEditing={avanzar}
          />
          <CajaInfo texto="Mientras la revisamos podés entrar a la app. Cuando esté aprobada vas a poder sumar a tus veterinarios y a tu equipo." />
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
  campo: { marginTop: 14 },
  resumen: { marginTop: 18, backgroundColor: Colores.white, borderRadius: 18, padding: 16, ...sombra(1) },
});
