/*
 * Migrado de ui/auth/AuthActivity.kt (activity_auth.xml, pantalla_iniciar_sesion.xml, pantalla_registro.xml,
 * pantalla_recuperar_password.xml). Puerta de entrada de la app: bienvenida, ingreso, elección del tipo de registro y
 * pedido de enlace para recuperar la contraseña. Según la cuenta, deriva al panel del dueño, del veterinario o del
 * administrador. En Android cada vista era un `setContentView`; acá son las vistas de una misma ruta (`/auth`).
 * El enlace de recuperación del correo y la contraseña nueva viven en la ruta `/auth/recuperar` (NuevaPasswordPantalla).
 */
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Servicios } from "../../data/servicios";
import { Sesion } from "../../data/sesion";
import { Errores } from "../../util/errores";
import { Colores, sombra } from "../common/tema";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { BotonIcono } from "../common/BotonIcono";
import { Campo } from "../common/Campo";
import { PantallaBase } from "../common/PantallaBase";
import { Texto } from "../common/Texto";
import { cursorTocable, estiloFoco, useEscritorio, useFoco } from "../common/Web";
import { EstadoAuth, type RegistroTerminado } from "./estadoAuth";
import { FondoLogin } from "./FondoLogin";
import { MarcoIngreso } from "./MarcoIngreso";
import { useAtenderCuenta } from "./useAtenderCuenta";
import { esCorreoValido } from "./validaciones";
import type { EntradaTexto } from "./tipos";

 
const LOGO = require("../../../assets/images/logo_petcare.png") as number;
 
const MASCOTAS = require("../../../assets/images/mascotas_inicio.png") as number;

type Vista = "inicio" | "login" | "registro" | "recuperar";

/** Enlace de texto tocable (¿Olvidaste tu contraseña?, Crear Cuenta). */
function Enlace({ texto, alTocar, negrita, tamano = 14 }: { texto: string; alTocar: () => void; negrita?: boolean; tamano?: number }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={texto}
      onPress={alTocar}
      hitSlop={8}
      {...foco.props}
      style={[estilos.enlace, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Texto variante="cuerpo" tamano={tamano} color={Colores.primaryTeal} negrita={negrita}>{texto}</Texto>
    </Pressable>
  );
}

// ---------- Bienvenida ----------

function BienvenidaVista({ alIngresar, alRegistrarse }: { alIngresar: () => void; alRegistrarse: () => void }) {
  // Las imágenes llevan el alto calculado: en la web `aspectRatio` junto con `width: "100%"` deja la imagen con su alto natural
  // Solo en formato teléfono: en escritorio el ingreso va directo al formulario (MarcoIngreso)
  const { width: anchoVentana } = useWindowDimensions();
  const columna = Math.min(anchoVentana, 480);
  const anchoLogo = Math.min(360, columna);
  const anchoMascotas = columna - 48;
  return (
    <PantallaBase fondo={Colores.white} margen={0} scroll={false} bordes={["top"]}>
      <View style={estilos.bienvenida}>
        <Image source={LOGO} resizeMode="contain" accessibilityLabel="Logo de PetCare" style={[estilos.bienvenidaLogo, { width: anchoLogo, height: (anchoLogo * 648) / 840 }]} />
        <View style={estilos.bienvenidaMascotas}>
          <Image source={MASCOTAS} resizeMode="contain" accessibilityLabel="mascotaInicio" style={[estilos.mascotas, { width: anchoMascotas, height: (anchoMascotas * 754) / 1100 }]} />
        </View>
        <View style={estilos.panel}>
          <Texto variante="titulo" tamano={28} centrado accessibilityRole="header">Bienvenido a PetCare</Texto>
          <Texto variante="subtitulo" tamano={16} centrado style={{ marginTop: 8 }}>
            {"El historial clínico de tus mascotas,\nsiempre a mano y en un solo lugar."}
          </Texto>
          <Boton titulo="Iniciar Sesión" alto={56} estilo={{ marginTop: 32 }} onPress={alIngresar} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Crear Cuenta"
            onPress={alRegistrarse}
            style={[estilos.contorno, cursorTocable]}
          >
            <Texto variante="boton" tamano={18} color={Colores.primaryTeal}>Crear Cuenta</Texto>
          </Pressable>
        </View>
      </View>
    </PantallaBase>
  );
}

// ---------- Ingreso ----------

function LoginVista({
  emailInicial, alOlvido, alRegistrarse, atender,
}: { emailInicial: string; alOlvido: () => void; alRegistrarse: () => void; atender: ReturnType<typeof useAtenderCuenta>["atender"] }) {
  const [email, setEmail] = useState(emailInicial);
  const [password, setPassword] = useState("");
  const [errorEmail, setErrorEmail] = useState<string | null>(null);
  const [errorPassword, setErrorPassword] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const refPassword = useRef<EntradaTexto>(null);
  const escritorio = useEscritorio();

  const intentarIngresar = async () => {
    if (cargando) return;
    const correo = email.trim().toLowerCase();
    if (!esCorreoValido(correo)) {
      setErrorEmail("Ingresá un correo válido");
      return;
    }
    if (password.length === 0) {
      setErrorPassword("Ingresá tu contraseña");
      return;
    }
    setCargando(true);
    try {
      atender(await Sesion.ingresar(correo, password));
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
    } finally {
      setCargando(false);
    }
  };

  if (escritorio) {
    return (
      <PantallaBase pantallaCompleta scroll={false} margen={0} bordes={[]}>
        <MarcoIngreso>
          <Texto tamano={30} peso="extrabold" color={Colores.brandNavy} accessibilityRole="header">Ingresá a PetCare</Texto>
          <Texto variante="subtitulo" tamano={15} style={{ marginTop: 6 }}>Usá el correo y la contraseña de tu cuenta.</Texto>
          <Campo
            etiqueta="Correo electrónico" icono="correo" placeholder="nombre@correo.com" estilo={{ marginTop: 28 }}
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setErrorEmail(null);
            }}
            error={errorEmail}
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress"
            returnKeyType="next" onSubmitEditing={() => refPassword.current?.focus()}
          />
          <Campo
            ref={refPassword} etiqueta="Contraseña" icono="candado" placeholder="Tu contraseña" estilo={{ marginTop: 16 }}
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setErrorPassword(null);
            }}
            error={errorPassword}
            contrasena autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={() => void intentarIngresar()}
          />
          <View style={estilos.olvido}>
            <Enlace texto="¿Olvidaste tu contraseña?" alTocar={alOlvido} />
          </View>
          <Boton titulo="Iniciar sesión" alto={52} estilo={{ marginTop: 14 }} cargando={cargando} onPress={() => void intentarIngresar()} />
          <View style={estilos.registrarseEscritorio}>
            <Texto variante="cuerpo" color={Colores.textGray}>¿Todavía no tenés cuenta?</Texto>
            <View style={{ marginLeft: 4 }}>
              <Enlace texto="Crear una cuenta" alTocar={alRegistrarse} negrita tamano={15} />
            </View>
          </View>
        </MarcoIngreso>
      </PantallaBase>
    );
  }

  return (
    <PantallaBase formulario scroll={false} margen={0}>
      <View style={estilos.loginRaiz}>
        <FondoLogin />
        <ScrollView contentContainerStyle={estilos.loginContenido} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={estilos.logoCaja}>
            <Image source={LOGO} resizeMode="contain" accessibilityLabel="Logo de PetCare" style={estilos.logo} />
            <Text style={estilos.lema} accessibilityElementsHidden importantForAccessibility="no">
              {"La salud\nde tu mascota\nen buenas\nmanos ♡"}
            </Text>
          </View>
          <Texto variante="titulo" tamano={28} color={Colores.tealDark} centrado style={{ marginTop: 24 }} accessibilityRole="header">
            ¡Bienvenido de nuevo!
          </Texto>
          <Texto variante="subtitulo" centrado style={{ marginTop: 4 }}>
            {"Iniciá sesión para continuar con\nla historia clínica de tu mascota."}
          </Texto>
          <Campo
            forma="pildora" icono="correo" placeholder="Correo electrónico" accessibilityLabel="Correo electrónico" estilo={{ marginTop: 24 }}
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setErrorEmail(null);
            }}
            error={errorEmail}
            keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress"
            returnKeyType="next" onSubmitEditing={() => refPassword.current?.focus()}
          />
          <Campo
            ref={refPassword} forma="pildora" icono="candado" placeholder="Contraseña" accessibilityLabel="Contraseña" estilo={{ marginTop: 10 }}
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setErrorPassword(null);
            }}
            error={errorPassword}
            contrasena autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={() => void intentarIngresar()}
          />
          <View style={estilos.olvido}>
            <Enlace texto="¿Olvidaste tu contraseña?" alTocar={alOlvido} />
          </View>
          <Boton titulo="Iniciar sesión" icono="adelante" alto={54} estilo={{ marginTop: 12 }} cargando={cargando} onPress={() => void intentarIngresar()} />
          <View style={estilos.registrarse}>
            <Texto variante="cuerpo">¿No tenés cuenta?</Texto>
            <View style={{ marginLeft: 4 }}>
              <Enlace texto="Crear Cuenta" alTocar={alRegistrarse} negrita tamano={15} />
            </View>
          </View>
        </ScrollView>
      </View>
    </PantallaBase>
  );
}

// ---------- Registro ----------

function SelectorRol({ texto, elegido, alTocar }: { texto: string; elegido: boolean; alTocar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={texto}
      accessibilityState={{ selected: elegido }}
      onPress={alTocar}
      {...foco.props}
      style={[estilos.rol, { backgroundColor: elegido ? Colores.primaryTeal : Colores.white }, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Texto variante="boton" tamano={14} peso="medium" color={elegido ? Colores.white : Colores.textGray}>{texto}</Texto>
    </Pressable>
  );
}

// La recepción y la administración de una veterinaria no se registran acá: las suma la veterinaria (invitación o
// cuenta creada por ella), así nadie queda como "recepcionista" sin trabajar para nadie. "Veterinaria" es para quien
// lleva el negocio sin ser veterinario: queda como titular y la veterinaria la verifica el administrador.
type TipoCuenta = "dueno" | "veterinario" | "veterinaria";

function RegistroVista({ alVolver }: { alVolver: () => void }) {
  const [tipo, setTipo] = useState<TipoCuenta>("dueno");
  const escritorio = useEscritorio();
  const contenido = (
    <>
        <BotonIcono icono="volver" accessibilityLabel="Volver atrás" onPress={alVolver} />
        <Texto variante="titulo" tamano={28} style={{ marginTop: 18 }} accessibilityRole="header">Crear cuenta</Texto>
        <Texto variante="subtitulo" tamano={14} style={{ marginTop: 2 }}>Elegí cómo vas a usar PetCare</Texto>
        <View style={estilos.roles}>
          <SelectorRol texto="Dueño" elegido={tipo === "dueno"} alTocar={() => setTipo("dueno")} />
          <SelectorRol texto="Veterinario" elegido={tipo === "veterinario"} alTocar={() => setTipo("veterinario")} />
          <SelectorRol texto="Veterinaria" elegido={tipo === "veterinaria"} alTocar={() => setTipo("veterinaria")} />
        </View>
        {tipo === "veterinaria" ? (
          <View style={estilos.tarjetaRegistro}>
            <Texto variante="titulo" tamano={19}>Registrar mi veterinaria</Texto>
            <Texto variante="subtitulo" tamano={14} style={{ marginTop: 4 }}>
              Para quien lleva una veterinaria. Quedás como titular y sumás a tus veterinarios y a tu equipo de recepción.
            </Texto>
            <Texto variante="cuerpo" tamano={14} color={Colores.tealDark} style={estilos.pasos}>
              {"1  ·  Tus datos\n2  ·  La veterinaria y su CUIT\n3  ·  Director técnico (veterinario matriculado)\n4  ·  Habilitaciones comercial y sanitaria\n5  ·  Correo y contraseña"}
            </Texto>
            <Texto variante="chico" tamano={13} style={{ marginTop: 10 }}>
              {"Si sos veterinario y atendés solo, elegí \"Veterinario\": tu consultorio se arma solo."}
            </Texto>
            <Boton titulo="Comenzar" alto={56} estilo={{ marginTop: 18 }} onPress={() => router.push("/auth/registro-veterinaria")} />
          </View>
        ) : tipo === "veterinario" ? (
          <View style={estilos.tarjetaRegistro}>
            <Texto variante="titulo" tamano={19}>Registro profesional</Texto>
            <Texto variante="subtitulo" tamano={14} style={{ marginTop: 4 }}>
              Te pedimos unos datos para armar tu perfil. Son 5 pasos y lleva un par de minutos.
            </Texto>
            <Texto variante="cuerpo" tamano={14} color={Colores.tealDark} style={estilos.pasos}>
              {"1  ·  Datos personales y foto\n2  ·  Matrícula y veterinaria\n3  ·  Especialidades\n4  ·  Días y horarios de atención\n5  ·  Correo y contraseña"}
            </Texto>
            <Boton titulo="Comenzar" alto={56} estilo={{ marginTop: 18 }} onPress={() => router.push("/auth/registro-veterinario")} />
          </View>
        ) : (
          <View style={estilos.tarjetaRegistro}>
            <Texto variante="titulo" tamano={19}>Registro de dueño</Texto>
            <Texto variante="subtitulo" tamano={14} style={{ marginTop: 4 }}>
              Armamos tu cuenta y la de tus mascotas en 4 pasos. Lleva un par de minutos.
            </Texto>
            <Texto variante="cuerpo" tamano={14} color={Colores.tealDark} style={estilos.pasos}>
              {"1  ·  Datos personales y foto\n2  ·  Domicilio\n3  ·  Tus mascotas\n4  ·  Correo y contraseña"}
            </Texto>
            <Boton titulo="Comenzar" alto={56} estilo={{ marginTop: 18 }} onPress={() => router.push("/auth/registro-dueno")} />
          </View>
        )}
    </>
  );
  if (escritorio) {
    return (
      <PantallaBase pantallaCompleta scroll={false} margen={0} bordes={[]}>
        <MarcoIngreso>{contenido}</MarcoIngreso>
      </PantallaBase>
    );
  }
  return (
    <PantallaBase formulario scroll={false} margen={0}>
      <ScrollView contentContainerStyle={estilos.registroContenido} showsVerticalScrollIndicator={false}>
        {contenido}
      </ScrollView>
    </PantallaBase>
  );
}

// ---------- Recuperar contraseña ----------

function RecuperarVista({ alVolver }: { alVolver: () => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [cargando, setCargando] = useState(false);
  const escritorio = useEscritorio();

  const enviar = async () => {
    if (cargando) return;
    const correo = email.trim();
    if (!esCorreoValido(correo)) {
      setError("Correo inválido");
      setEnviado(false);
      return;
    }
    setCargando(true);
    try {
      await Servicios.fuente.recuperarPassword(correo);
      setEnviado(true);
    } catch (e) {
      setEnviado(false);
      Avisos.error(Errores.mensaje(e));
    } finally {
      setCargando(false);
    }
  };

  if (escritorio) {
    return (
      <PantallaBase pantallaCompleta scroll={false} margen={0} bordes={[]}>
        <MarcoIngreso>
          <Texto tamano={30} peso="extrabold" color={Colores.brandNavy} accessibilityRole="header">Recuperar contraseña</Texto>
          <Texto variante="subtitulo" tamano={15} style={{ marginTop: 6 }}>
            Ingresá tu correo y te enviamos un enlace para elegir una contraseña nueva.
          </Texto>
          <Campo
            etiqueta="Correo electrónico" icono="correo" placeholder="nombre@correo.com" estilo={{ marginTop: 28 }} value={email}
            onChangeText={(t) => {
              setEmail(t);
              setError(null);
            }}
            error={error} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress"
            returnKeyType="send" onSubmitEditing={() => void enviar()}
          />
          {enviado ? (
            <Texto variante="cuerpo" color={Colores.successGreen} style={{ marginTop: 16 }} accessibilityLiveRegion="polite">
              Si el correo está registrado, vas a recibir un enlace en unos minutos.
            </Texto>
          ) : null}
          <Boton titulo="Enviar enlace" alto={52} estilo={{ marginTop: 22 }} cargando={cargando} onPress={() => void enviar()} />
          <View style={estilos.registrarseEscritorio}>
            <Enlace texto="Volver a iniciar sesión" alTocar={alVolver} negrita tamano={15} />
          </View>
        </MarcoIngreso>
      </PantallaBase>
    );
  }

  return (
    <PantallaBase formulario titulo="Recuperar contraseña" alVolver={alVolver} fondo={Colores.white} margen={24}>
      <Texto variante="subtitulo" style={{ marginTop: 8 }}>Ingresá tu correo y te enviaremos un enlace para restablecerla.</Texto>
      <Campo
        estilo={{ marginTop: 24 }} placeholder="ejemplo@correo.com" accessibilityLabel="Correo electrónico" value={email}
        onChangeText={(t) => {
          setEmail(t);
          setError(null);
        }}
        error={error} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress"
        returnKeyType="send" onSubmitEditing={() => void enviar()}
      />
      {enviado ? (
        <Texto variante="cuerpo" color={Colores.successGreen} style={{ marginTop: 16 }} accessibilityLiveRegion="polite">
          Si el correo está registrado, vas a recibir un enlace en unos minutos.
        </Texto>
      ) : null}
      <Boton titulo="Enviar enlace" alto={56} estilo={{ marginTop: 24 }} cargando={cargando} onPress={() => void enviar()} />
    </PantallaBase>
  );
}

// ---------- Pantalla ----------

export default function AuthPantalla() {
  // `vista=login` lo usa la pantalla de nueva contraseña para volver directo al ingreso
  const { vista: vistaInicial } = useLocalSearchParams<{ vista?: string }>();
  const [vista, setVista] = useState<Vista>(vistaInicial === "login" ? "login" : "inicio");
  const [emailInicial, setEmailInicial] = useState("");
  const { atender, hojaModo } = useAtenderCuenta();
  // En escritorio no hay paso de bienvenida: el formulario de ingreso ya ocupa la pantalla con la marca al costado
  const escritorio = useEscritorio();
  const vistaVisible: Vista = escritorio && vista === "inicio" ? "login" : vista;

  const irALogin = useCallback((email = "") => {
    setEmailInicial(email);
    setVista("login");
  }, []);

  /** Tras crear una cuenta: confirma el correo, deja entrar (dueño) o la deja en revisión (veterinario). */
  const cuentaCreada = useCallback(
    async ({ email, confirmarCorreo, esVeterinario }: RegistroTerminado) => {
      if (confirmarCorreo) {
        irALogin(email);
        Avisos.informar({
          titulo: "Confirmá tu correo",
          mensaje: `Te mandamos un mensaje a ${email}. Abrilo para activar la cuenta y después iniciá sesión.`,
        });
        return;
      }
      if (esVeterinario) {
        // La cuenta queda en revisión hasta que el administrador verifique la matrícula
        await Sesion.cerrar();
        irALogin(email);
        return;
      }
      let resultado = null;
      try {
        resultado = await Sesion.restaurar();
      } catch {
        resultado = null;
      }
      if (resultado) atender(resultado);
      else irALogin(email);
    },
    [atender, irALogin],
  );

  const ultimaCuentaCreada = useRef(cuentaCreada);
  ultimaCuentaCreada.current = cuentaCreada;

  useEffect(() => {
    EstadoAuth.alTerminarRegistro = (r) => void ultimaCuentaCreada.current(r);
    // Si la app se abrió con un registro ya terminado se sigue ese camino; si no, se retoma la sesión guardada
    const pendiente = EstadoAuth.tomarPendiente();
    if (pendiente) {
      void ultimaCuentaCreada.current(pendiente);
    } else {
      /** Si el teléfono todavía tiene una sesión abierta, entra directo al panel que corresponde. */
      void (async () => {
        try {
          const resultado = await Sesion.restaurar();
          if (resultado) atender(resultado);
        } catch {
          // sin sesión que retomar
        }
      })();
    }
    return () => {
      EstadoAuth.alTerminarRegistro = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {vistaVisible === "inicio" ? <BienvenidaVista alIngresar={() => irALogin()} alRegistrarse={() => setVista("registro")} /> : null}
      {vistaVisible === "login" ? (
        <LoginVista emailInicial={emailInicial} alOlvido={() => setVista("recuperar")} alRegistrarse={() => setVista("registro")} atender={atender} />
      ) : null}
      {vistaVisible === "registro" ? <RegistroVista alVolver={() => setVista("inicio")} /> : null}
      {vistaVisible === "recuperar" ? <RecuperarVista alVolver={() => irALogin()} /> : null}
      {hojaModo}
    </>
  );
}

const estilos = StyleSheet.create({
  enlace: { minHeight: 36, justifyContent: "center" },
  bienvenida: { flex: 1 },
  bienvenidaLogo: { alignSelf: "center", marginTop: 24 },
  bienvenidaMascotas: { flex: 1, justifyContent: "flex-end", alignItems: "center", marginTop: 8, minHeight: 0, overflow: "hidden" },
  mascotas: { transform: [{ translateY: 12 }] },
  panel: {
    backgroundColor: Colores.lightTeal, borderTopLeftRadius: 40, borderTopRightRadius: 40,
    paddingHorizontal: 24, paddingTop: 40, paddingBottom: 32,
  },
  contorno: {
    marginTop: 16, height: 56, borderRadius: 28, borderWidth: 2, borderColor: Colores.primaryTeal, backgroundColor: Colores.white,
    alignItems: "center", justifyContent: "center",
  },
  loginRaiz: { flex: 1 },
  loginContenido: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 28, paddingTop: 28, paddingBottom: 24 },
  logoCaja: { alignSelf: "center", alignItems: "center", width: 170 },
  logo: { width: 170, aspectRatio: 840 / 648 },
  lema: {
    position: "absolute", right: -70, top: -4, transform: [{ rotate: "-12deg" }], color: Colores.tealDark, fontSize: 14, fontStyle: "italic",
    lineHeight: 15, fontFamily: Platform.select({ web: "cursive", ios: "Snell Roundhand", default: "serif" }),
  },
  olvido: { alignItems: "flex-end", marginTop: 8 },
  registrarse: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 22 },
  registrarseEscritorio: { flexDirection: "row", alignItems: "center", marginTop: 24 },
  registroContenido: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 24 },
  roles: { flexDirection: "row", gap: 8, marginTop: 20 },
  rol: { flex: 1, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  tarjetaRegistro: { marginTop: 20, backgroundColor: Colores.white, borderRadius: 18, padding: 18, ...sombra(1) },
  pasos: { marginTop: 14, lineHeight: 26 },
});
