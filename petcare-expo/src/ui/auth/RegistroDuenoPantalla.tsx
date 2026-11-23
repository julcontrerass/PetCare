/*
 * Migrado de ui/auth/RegistroDuenoActivity.kt (activity_registro_dueno.xml, item_mascota_registro.xml).
 * Alta de cuenta del dueño en cuatro pasos: datos personales, domicilio, mascotas y cuenta. Al terminar crea la
 * cuenta con `Registro.dueno` y le avisa al ingreso (que antes recibía el resultado de la Activity).
 */
import { useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { crearDatosRegistroDueno, type MascotaRegistro } from "../../data/datosRegistro";
import { Registro } from "../../data/registro";
import { Errores } from "../../util/errores";
import { Colores, sombra } from "../common/tema";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Campo } from "../common/Campo";
import { Icono } from "../common/Icono";
import { ImagenRemota } from "../common/ImagenRemota";
import { Texto } from "../common/Texto";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { CajaInfo, Casilla } from "./ElementosRegistro";
import { descartarFoto, elegirFoto } from "./elegirFoto";
import { cerrarPantalla, EstadoAuth } from "./estadoAuth";
import { FotoRedonda } from "./FotoRedonda";
import { MascotaRegistroDialogo } from "./MascotaRegistroDialogo";
import { CabeceraPaso, PasosRegistro } from "./PasosRegistro";
import { contarDigitos, esCorreoValido, esNombreYApellido, soloNumeros } from "./validaciones";
import { useAtras } from "./useAtras";
import type { EntradaTexto } from "./tipos";

const TITULOS = ["Datos personales", "Domicilio", "Tus mascotas", "Tu cuenta"];

type NombreCampo = "nombre" | "dni" | "telefono" | "direccion" | "ciudad" | "email" | "password" | "password2";
type ErroresCampos = Partial<Record<NombreCampo, string>>;

function detalleMascota(m: MascotaRegistro): string {
  return (
    [m.tipo, m.raza, m.sexo].filter((x) => x.trim() !== "").join(" · ") +
    (m.nacimiento.trim() !== "" ? `\nNació el ${m.nacimiento}` : "")
  );
}

function FilaMascota({ mascota, alTocar, alQuitar }: { mascota: MascotaRegistro; alTocar: () => void; alQuitar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${mascota.nombre}. Editar mascota`}
      onPress={alTocar}
      {...foco.props}
      style={({ pressed }) => [estilos.fila, pressed ? { opacity: 0.92 } : null, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <View style={estilos.miniatura}>
        {mascota.fotoPath ? (
          <ImagenRemota fotoUri={mascota.fotoPath} estilo={{ width: 56, height: 56 }} />
        ) : (
          <Icono nombre="perro" tamano={28} color={Colores.tealDark} />
        )}
      </View>
      <View style={estilos.textos}>
        <Texto variante="cuerpo" tamano={16} peso="bold" numberOfLines={1}>{mascota.nombre}</Texto>
        <Texto variante="subtitulo" tamano={13} numberOfLines={2}>{detalleMascota(mascota)}</Texto>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel="Quitar mascota" onPress={alQuitar} hitSlop={4} style={[estilos.quitar, cursorTocable]}>
        <Icono nombre="cancelar" tamano={22} color={Colores.dangerRed} />
      </Pressable>
    </Pressable>
  );
}

export default function RegistroDuenoPantalla() {
  const [paso, setPaso] = useState(0);
  const [fotoPath, setFotoPath] = useState<string | null>(null);
  const [mascotas, setMascotas] = useState<MascotaRegistro[]>([]);
  const [dialogo, setDialogo] = useState<{ indice: number | null } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errores, setErrores] = useState<ErroresCampos>({});

  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [piso, setPiso] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [terminos, setTerminos] = useState(false);

  const refs = useRef<Partial<Record<NombreCampo, EntradaTexto | null>>>({});
  const ref = (n: NombreCampo) => (r: EntradaTexto | null) => {
    refs.current[n] = r;
  };
  /** Cambia un campo y le quita su error (como el `setError` de Android, que se va al escribir). */
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

  /** Muestra los errores y manda el foco al primer campo con error (en orden de pantalla). */
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
        if (t(direccion).length < 5) e.direccion = "Ingresá tu calle y número";
        if (t(ciudad).length < 3) e.ciudad = "Ingresá tu ciudad o localidad";
        return mostrarErrores(e, ["direccion", "ciudad"]);
      case 2:
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

  const avanzar = () => {
    if (enviando || !validarPasoActual()) return;
    if (paso < TITULOS.length - 1) setPaso(paso + 1);
    else void crearCuenta();
  };

  // ---------- Fotos y mascotas ----------

  const cambiarFoto = async () => {
    const path = await elegirFoto({ recortar: true });
    if (!path) return;
    descartarFoto(fotoPath);
    setFotoPath(path);
  };

  const guardarMascota = (nueva: MascotaRegistro) => {
    const indice = dialogo?.indice ?? null;
    setMascotas((lista) => (indice != null ? lista.map((m, i) => (i === indice ? nueva : m)) : [...lista, nueva]));
  };

  const quitarMascota = (indice: number) => {
    const m = mascotas[indice];
    Avisos.confirmar({
      titulo: "Quitar mascota",
      mensaje: `¿Querés quitar a ${m.nombre} de tu cuenta?`,
      textoAceptar: "Quitar",
      textoCancelar: "Cancelar",
      alAceptar: () => {
        descartarFoto(m.fotoPath);
        setMascotas((lista) => lista.filter((_, i) => i !== indice));
      },
    });
  };

  // ---------- Paso 4: resumen y alta ----------

  const domicilio = () => [t(direccion), t(piso), t(ciudad)].filter((s) => s !== "").join(", ");

  const resumen = () =>
    [
      `${t(nombre)} · DNI ${t(dni)}`,
      domicilio(),
      mascotas.length === 0
        ? "Sin mascotas por ahora"
        : "Mascotas: " + mascotas.map((m) => `${m.nombre} (${m.tipo.toLowerCase()})`).join(", "),
    ].join("\n");

  const crearCuenta = async () => {
    const datos = crearDatosRegistroDueno({
      nombre: t(nombre), dni: t(dni), telefono: t(telefono), direccion: domicilio(), email: t(email).toLowerCase(),
      password, fotoPath, mascotas: [...mascotas],
    });
    setEnviando(true);
    try {
      const resultado = await Registro.dueno(datos);
      EstadoAuth.terminarRegistro({ email: datos.email, confirmarCorreo: !resultado.sesionIniciada, esVeterinario: false });
      cerrarPantalla();
    } catch (e) {
      setEnviando(false);
      if (e instanceof Registro.CorreoYaRegistrado) {
        setPaso(3);
        mostrarErrores({ email: "Ese correo ya está registrado" }, ["email"]);
      } else {
        Avisos.error(Errores.mensaje(e));
      }
    }
  };

  const textoSiguiente =
    enviando ? "Creando cuenta..." : paso === TITULOS.length - 1 ? "Crear cuenta" : paso === 2 && mascotas.length === 0 ? "Omitir por ahora" : "Continuar";

  return (
    <>
      <PasosRegistro
        titulo="Crear cuenta"
        textoPaso={`Paso ${paso + 1} de ${TITULOS.length} · ${TITULOS[paso]}`}
        total={TITULOS.length}
        encendidos={paso + 1}
        clavePaso={paso}
        mostrarAtras={paso > 0}
        textoSiguiente={textoSiguiente}
        enviando={enviando}
        alVolver={irAlPasoAnterior}
        alAtras={irAlPasoAnterior}
        alSiguiente={avanzar}
      >
        {paso === 0 ? (
          <View>
            <CabeceraPaso icono="persona" titulo="Contanos quién sos" subtitulo="Con estos datos armamos tu perfil de dueño." />
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
              onSubmitEditing={avanzar}
            />
          </View>
        ) : null}

        {paso === 1 ? (
          <View>
            <CabeceraPaso icono="ubicacion" titulo="Dónde vivís" subtitulo="El veterinario usa estos datos para contactarte." />
            <Campo
              ref={ref("direccion")} estilo={estilos.campoPrimero} etiqueta="Calle y número" placeholder="Ej: Av. Santa Fe 1234"
              value={direccion} onChangeText={editar("direccion", setDireccion)} error={errores.direccion} autoCapitalize="words"
            />
            <Campo estilo={estilos.campo} etiqueta="Piso y departamento (opcional)" placeholder="Ej: 3° B" value={piso} onChangeText={setPiso} />
            <Campo
              ref={ref("ciudad")} estilo={estilos.campo} etiqueta="Ciudad o localidad" placeholder="Ej: Ciudad Autónoma de Buenos Aires"
              value={ciudad} onChangeText={editar("ciudad", setCiudad)} error={errores.ciudad} autoCapitalize="words" onSubmitEditing={avanzar}
            />
          </View>
        ) : null}

        {paso === 2 ? (
          <View>
            <CabeceraPaso icono="perro" titulo="Tus mascotas" subtitulo="Cargá a tus compañeros. Después podés sumar más desde la app." />
            <View style={{ marginTop: 20 }}>
              {mascotas.map((m, i) => (
                <FilaMascota key={`${m.nombre}-${i}`} mascota={m} alTocar={() => setDialogo({ indice: i })} alQuitar={() => quitarMascota(i)} />
              ))}
            </View>
            {mascotas.length === 0 ? (
              <CajaInfo texto="Todavía no cargaste ninguna mascota. Podés agregarlas ahora o más tarde." />
            ) : null}
            <Boton titulo="Agregar mascota" icono="mas" variante="secundario" alto={52} estilo={{ marginTop: 12 }} onPress={() => setDialogo({ indice: null })} />
          </View>
        ) : null}

        {paso === 3 ? (
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

      {dialogo ? (
        <MascotaRegistroDialogo
          existente={dialogo.indice != null ? mascotas[dialogo.indice] : null}
          alGuardar={guardarMascota}
          alCerrar={() => setDialogo(null)}
        />
      ) : null}
    </>
  );
}

const estilos = StyleSheet.create({
  opcional: { marginTop: 8 },
  campoPrimero: { marginTop: 18 },
  campo: { marginTop: 14 },
  fila: {
    flexDirection: "row", alignItems: "center", backgroundColor: Colores.white, borderRadius: 18, padding: 12, marginBottom: 10, ...sombra(1),
  },
  miniatura: { width: 56, height: 56, borderRadius: 16, backgroundColor: Colores.lightTeal, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  textos: { flex: 1, minWidth: 0, marginHorizontal: 12 },
  quitar: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  resumen: { marginTop: 18, backgroundColor: Colores.white, borderRadius: 18, padding: 16, ...sombra(1) },
});
