/*
 * Migrado de ui/veterinario/NuevoDuenoActivity.kt (activity_nuevo_dueno.xml y sheet_cuenta_creada.xml). Alta de un
 * dueño y su mascota desde el consultorio, sin pasar por un turno; con la cuenta creada el dueño ingresa después desde
 * su casa. También sirve para crearle la cuenta al dueño de pacientes ya cargados.
 * Ruta: `/vet/dueno-nuevo` con parámetros opcionales `correo`, `dni` y `pacientes` (ids separados por coma, el
 * `EXTRA_PACIENTE_IDS` de Android). El resultado (`EXTRA_PACIENTE_ID`) vuelve por `EstadoVet`.
 *
 * Desvío: en Android la hoja con la contraseña llevaba FLAG_SECURE (sin capturas). `expo-screen-capture` no está
 * instalado, así que no se bloquea la captura; la contraseña vive solo en el estado de la pantalla (si se recarga la
 * página en la web ya no se muestra) y no se guarda en ningún lado.
 */
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Switch, View } from "react-native";
import { PacientesRepo, type CuentaCreada } from "../../data/repositorio/pacientesRepo";
import { PerfilVetRepo } from "../../data/repositorio/perfilVetRepo";
import type { MascotaParaCuentaDto } from "../../data/remoto/dtos";
import { ValidacionDueno } from "../../data/validacionDueno";
import { TiposMascota } from "../../model/tiposMascota";
import { Errores } from "../../util/errores";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Campo } from "../common/Campo";
import { Contacto } from "../common/Contacto";
import { HojaInferior } from "../common/HojaInferior";
import { PantallaBase } from "../common/PantallaBase";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";
import { useSesionRequerida } from "../common/useSesionRequerida";
import { CajaForm, CampoSeleccion, EtiquetaForm, SeccionTitulo } from "./ElementosVet";
import { cerrarPantalla, EstadoVet } from "./estadoVet";

const SEXOS = ["Macho", "Hembra"];

function avisarQueNoAtiende(tipo: string): void {
  const animales = TiposMascota.plural(TiposMascota.normalizar(tipo)).toLowerCase();
  Avisos.informar({
    titulo: `No atendés ${animales}`,
    mensaje: 'No tenés ese tipo de animal entre los que atendés. Podés agregarlo desde tu perfil, en "Animales que atiendo".',
    icono: "advertencia",
  });
}

const dato = (valor: string): string => (valor.trim() !== "" && valor !== "Sin datos" ? valor : "");

export default function NuevoDuenoPantalla() {
  useSesionRequerida();
  const params = useLocalSearchParams<{ correo?: string; dni?: string; pacientes?: string }>();

  // Pacientes ya cargados (sin cuenta de dueño) a los que se les crea la cuenta; vacío si se carga una mascota nueva
  const [pacientes] = useState(() =>
    (typeof params.pacientes === "string" ? params.pacientes.split(",") : [])
      .map((id) => PacientesRepo.porId(id))
      .filter((p) => p !== null && !p.tieneCuenta),
  );
  const existentes = pacientes.map((p) => p!.id);
  const primero = pacientes[0] ?? null;

  const [nombre, setNombre] = useState(primero ? dato(primero.propietario) : "");
  const [dni, setDni] = useState(primero ? dato(primero.dniPropietario) : (typeof params.dni === "string" ? params.dni : ""));
  const [telefono, setTelefono] = useState(primero ? dato(primero.telefono) : "");
  const [correo, setCorreo] = useState(primero ? dato(primero.email) : (typeof params.correo === "string" ? params.correo : ""));
  const [mascota, setMascota] = useState("");
  const [raza, setRaza] = useState("");
  const [tipoIdx, setTipoIdx] = useState(0);
  const [sexoIdx, setSexoIdx] = useState(0);
  const [crearCuenta, setCrearCuenta] = useState(true);
  const [errores, setErrores] = useState<Record<string, string | null>>({});
  const [trabajando, setTrabajando] = useState(false);
  const [cuenta, setCuenta] = useState<{ datos: CuentaCreada; dueno: string; telefono: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const conCuenta = existentes.length > 0 || crearCuenta;
  const textoBoton = existentes.length > 0 ? "Crear cuenta del dueño" : crearCuenta ? "Crear cuenta y mascota" : "Guardar paciente";
  const ayuda = crearCuenta
    ? "Se le crea un usuario con una contraseña temporal y le pasás los datos por WhatsApp. " +
      "Cuando ingrese ve el historial, las vacunas y los turnos que completes."
    : "Solo queda cargado en tus pacientes, sin cuenta del dueño. Podés crearle la cuenta más adelante desde la ficha del paciente.";

  const limpiarError = (campo: string) => setErrores((e) => ({ ...e, [campo]: null }));

  const crear = async () => {
    const n = nombre.trim();
    const d = dni.trim();
    const t = telefono.trim();
    const c = correo.trim();
    const nuevos: Record<string, string | null> = {};
    let ok = true;
    const exigir = (campo: string, error: string | null) => {
      if (error !== null) {
        nuevos[campo] = error;
        ok = false;
      }
    };
    exigir("nombre", ValidacionDueno.nombre(n));
    if (conCuenta) {
      exigir("dni", ValidacionDueno.dni(d));
      exigir("telefono", ValidacionDueno.telefono(t));
      exigir("correo", ValidacionDueno.correo(c));
    } else {
      if (d !== "") exigir("dni", ValidacionDueno.dni(d));
      if (c !== "") exigir("correo", ValidacionDueno.correo(c));
    }
    const tipo = TiposMascota.TODOS[tipoIdx];
    const m = mascota.trim();
    if (existentes.length === 0) {
      if (m === "") {
        nuevos.mascota = "Requerido";
        ok = false;
      }
      if (ok && !PerfilVetRepo.atiende(tipo)) {
        avisarQueNoAtiende(tipo);
        return;
      }
    }
    setErrores(nuevos);
    if (!ok) return;

    if (!conCuenta) {
      const paciente = PacientesRepo.agregarManual(m, tipo, raza.trim(), SEXOS[sexoIdx], n, t, c, d);
      EstadoVet.terminarAltaDeDueno(paciente.id);
      Avisos.mostrar("Paciente guardado");
      cerrarPantalla();
      return;
    }

    setTrabajando(true);
    try {
      const nuevas: MascotaParaCuentaDto[] =
        existentes.length === 0
          ? [{ nombre: m, tipo, sexo: SEXOS[sexoIdx].toLowerCase(), raza: raza.trim() === "" ? null : raza.trim() }]
          : [];
      const datos = await PacientesRepo.crearCuentaDueno(n, d, t, c, "", nuevas, existentes);
      setCuenta({ datos, dueno: n, telefono: t });
    } catch (e) {
      setTrabajando(false);
      Avisos.error(Errores.mensaje(e), "No se pudo crear la cuenta");
    }
  };

  const mensaje = cuenta
    ? Contacto.mensajeDeAcceso(cuenta.dueno, cuenta.datos.mascotas, cuenta.datos.email, cuenta.datos.passwordTemporal, PerfilVetRepo.nombre, PerfilVetRepo.clinica)
    : "";

  return (
    <PantallaBase
      titulo={existentes.length > 0 ? "Crear cuenta del dueño" : "Nuevo dueño y mascota"}
      subtitulo={existentes.length > 0 ? "Para que vea la ficha desde su casa" : "Cargalos acá, sin necesidad de dar un turno"}
      alVolver={cerrarPantalla}
      pie={<Boton titulo={textoBoton} alto={56} cargando={trabajando} deshabilitado={trabajando} onPress={() => void crear()} />}
    >
      <SeccionTitulo texto="Dueño" estilo={{ marginTop: 0 }} />
      <CajaForm>
        <EtiquetaForm texto="Nombre y apellido *" primera />
        <Campo
          placeholder="Nombre y apellido del dueño" accessibilityLabel="Nombre y apellido" value={nombre} error={errores.nombre}
          onChangeText={(x) => { setNombre(x); limpiarError("nombre"); }} autoCapitalize="words"
        />
        <EtiquetaForm texto="DNI *" />
        <Campo
          placeholder="Sin puntos" accessibilityLabel="DNI" value={dni} error={errores.dni} keyboardType="number-pad"
          onChangeText={(x) => { setDni(x); limpiarError("dni"); }}
        />
        <EtiquetaForm texto="Teléfono (WhatsApp) *" />
        <Campo
          placeholder="Ej: 11 2345 6789" accessibilityLabel="Teléfono (WhatsApp)" value={telefono} error={errores.telefono} keyboardType="phone-pad"
          onChangeText={(x) => { setTelefono(x); limpiarError("telefono"); }}
        />
        <EtiquetaForm texto="Correo *" />
        <Campo
          placeholder="Con este correo ingresa a la app" accessibilityLabel="Correo" value={correo} error={errores.correo}
          keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
          onChangeText={(x) => { setCorreo(x); limpiarError("correo"); }}
        />
      </CajaForm>

      {existentes.length === 0 ? (
        <View>
          <SeccionTitulo texto="Mascota" />
          <CajaForm>
            <EtiquetaForm texto="Nombre *" primera />
            <Campo
              placeholder="Nombre de la mascota" accessibilityLabel="Nombre de la mascota" value={mascota} error={errores.mascota}
              onChangeText={(x) => { setMascota(x); limpiarError("mascota"); }} autoCapitalize="words"
            />
            <View style={{ flexDirection: "row", marginTop: 12 }}>
              <View style={{ flex: 1 }}>
                <CampoSeleccion titulo="Tipo de animal" accesibilidad="Tipo de animal" opciones={TiposMascota.TODOS} indice={tipoIdx} alElegir={setTipoIdx} />
              </View>
              <View style={{ flex: 1, marginLeft: 8 }}>
                <CampoSeleccion titulo="Sexo" accesibilidad="Sexo" opciones={SEXOS} indice={sexoIdx} alElegir={setSexoIdx} />
              </View>
            </View>
            <Campo
              placeholder="Raza (ej: Golden Retriever)" accessibilityLabel="Raza" value={raza} onChangeText={setRaza}
              autoCapitalize="words" estilo={{ marginTop: 8 }}
            />
          </CajaForm>
        </View>
      ) : (
        <View style={{ backgroundColor: Colores.white, borderRadius: 18, padding: 16, marginTop: 18 }}>
          <Texto variante="cuerpo" tamano={14}>
            {(existentes.length === 1 ? "Va a ver la ficha de " : "Va a ver las fichas de ") +
              pacientes.map((p) => p!.nombre).join(", ") + ", con todo lo que ya cargaste."}
          </Texto>
        </View>
      )}

      {existentes.length === 0 ? (
        <View style={{ backgroundColor: Colores.white, borderRadius: 18, padding: 16, marginTop: 22 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Texto variante="etiqueta" tamano={15} style={{ flex: 1 }}>Crear cuenta para el dueño</Texto>
            <Switch
              accessibilityLabel="Crear cuenta para el dueño" value={crearCuenta} onValueChange={setCrearCuenta}
              trackColor={{ true: Colores.primaryTeal, false: Colores.dividerColor }} thumbColor={Colores.white}
            />
          </View>
          <Texto variante="chico" tamano={13} style={{ marginTop: 6 }}>{ayuda}</Texto>
        </View>
      ) : null}

      <HojaInferior visible={cuenta !== null} alCerrar={() => {}} cancelable={false}>
        {cuenta ? (
          <View>
            <Texto variante="titulo" tamano={21} accessibilityRole="header">Cuenta creada</Texto>
            <Texto variante="subtitulo" tamano={14} style={{ marginTop: 6 }}>
              {`Ya puede ingresar ${cuenta.dueno} y ver ` +
                (cuenta.datos.mascotas.length === 1 ? `la ficha de ${cuenta.datos.mascotas[0]}` : "las fichas de sus mascotas") +
                ". Mandale estos datos para que entre desde su casa."}
            </Texto>
            <View style={{ backgroundColor: Colores.white, borderRadius: 16, borderWidth: 1, borderColor: Colores.loginFieldStroke, padding: 14, marginTop: 16 }}>
              <Texto variante="chico" tamano={12}>Correo</Texto>
              <Texto variante="titulo" tamano={16} selectable>{cuenta.datos.email}</Texto>
              <Texto variante="chico" tamano={12} style={{ marginTop: 12 }}>Contraseña temporal</Texto>
              <Texto variante="titulo" tamano={20} selectable>{cuenta.datos.passwordTemporal}</Texto>
            </View>
            <Texto variante="chico" tamano={12.5} style={{ marginTop: 10 }}>
              Esta contraseña se muestra una sola vez. El dueño tiene que cambiarla la primera vez que ingresa.
            </Texto>
            <Boton
              titulo="Enviar por WhatsApp" alto={52} estilo={{ marginTop: 16 }}
              onPress={() => void Contacto.abrir(Contacto.whatsApp(cuenta.telefono, mensaje) ?? Contacto.compartirTexto(mensaje), "No pudimos abrir WhatsApp")}
            />
            <Boton
              titulo={copiado ? "Datos copiados" : "Copiar datos"} variante="secundario" alto={50} estilo={{ marginTop: 8 }}
              onPress={() => {
                void Clipboard.setStringAsync(mensaje);
                setCopiado(true);
                Avisos.mostrar("Datos copiados");
              }}
            />
            <Boton
              titulo="Listo" variante="texto" alto={50} estilo={{ marginTop: 4 }}
              onPress={() => {
                const id = cuenta.datos.mascotaIds[0] ?? null;
                setCuenta(null);
                EstadoVet.terminarAltaDeDueno(id);
                cerrarPantalla();
              }}
            />
          </View>
        ) : null}
      </HojaInferior>
    </PantallaBase>
  );
}
