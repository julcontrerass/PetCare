/*
 * "Mis veterinarias": las veterinarias de la cuenta (con sus roles), las invitaciones para responder y, para un
 * veterinario aprobado, crear otra veterinaria. Tocar una abre su equipo: quien la administra (titular o
 * administración) invita por DNI o correo eligiendo los roles, le crea la cuenta a quien todavía no usa PetCare,
 * cambia roles y saca personas; el resto ve el equipo y puede salir. Mismo formato que la hoja de dueños de una
 * mascota (HojaInferior, filas con avatar, chips y acciones de texto).
 */
import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { ClinicasRepo, NOMBRE_ROL } from "../../data/repositorio/clinicasRepo";
import type { ClinicaDto, CuentaMiembroCreadaDto, MiembroClinicaDto, RolClinica } from "../../data/remoto/dtos";
import { Sesion } from "../../data/sesion";
import { Errores } from "../../util/errores";
import { contarDigitos, esCorreoValido, soloNumeros } from "../auth/validaciones";
import { Avatar } from "./Avatar";
import { Avisos } from "./Avisos";
import { Boton } from "./Boton";
import { Campo } from "./Campo";
import { Chip } from "./Chip";
import { Contacto } from "./Contacto";
import { HojaInferior } from "./HojaInferior";
import { Icono } from "./Icono";
import { Colores } from "./tema";
import { Texto } from "./Texto";
import { useDatos } from "./useDatos";
import { cursorTocable, estiloFoco, useFoco } from "./Web";

const ROLES_INVITAR: RolClinica[] = ["recepcion", "administrador", "veterinario"];
const ROLES_CUENTA_NUEVA: RolClinica[] = ["recepcion", "administrador"];

function AccionFila({ texto, color = Colores.dangerRed, alTocar, deshabilitada }: {
  texto: string; color?: string; alTocar: () => void; deshabilitada?: boolean;
}) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={texto} onPress={alTocar} hitSlop={8} disabled={deshabilitada}
      accessibilityState={{ disabled: deshabilitada }} {...foco.props}
      style={[estilos.accion, cursorTocable, estiloFoco(foco.enfocado), deshabilitada ? { opacity: 0.5 } : null]}
    >
      <Texto tamano={13} negrita color={color}>{texto}</Texto>
    </Pressable>
  );
}

/** Chips para elegir uno o varios roles. */
function SelectorRoles({ opciones, elegidos, alCambiar }: {
  opciones: RolClinica[]; elegidos: RolClinica[]; alCambiar: (r: RolClinica[]) => void;
}) {
  return (
    <View style={estilos.chips}>
      {opciones.map((r) => {
        const si = elegidos.includes(r);
        return (
          <Chip
            key={r} texto={NOMBRE_ROL[r]} tono={si ? "seleccionado" : "sinSeleccionar"}
            onPress={() => alCambiar(si ? elegidos.filter((x) => x !== r) : [...elegidos, r])}
          />
        );
      })}
    </View>
  );
}

function ChipsRoles({ roles, pendiente }: { roles: RolClinica[]; pendiente?: boolean }) {
  return (
    <View style={estilos.chips}>
      {roles.map((r) => <Chip key={r} texto={NOMBRE_ROL[r]} tono={r === "titular" ? "info" : "neutro"} />)}
      {pendiente ? <Chip texto="Invitación pendiente" tono="aviso" /> : null}
    </View>
  );
}

// ---------- Lista de veterinarias ----------

function FilaClinica({ clinica: c, alTocar }: { clinica: ClinicaDto; alTocar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={`${c.nombre}, ${c.roles.map((r) => NOMBRE_ROL[r]).join(", ")}`}
      onPress={alTocar} {...foco.props} style={[estilos.fila, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <View style={estilos.icono}><Icono nombre="sede" tamano={22} color={Colores.primaryTeal} /></View>
      <View style={estilos.textos}>
        <Texto tamano={15} negrita numberOfLines={1}>{c.nombre}</Texto>
        <Texto variante="chico" tamano={12} numberOfLines={1}>
          {c.veterinarios === 1 ? "1 veterinario" : `${c.veterinarios} veterinarios`}{c.direccion ? ` · ${c.direccion}` : ""}
        </Texto>
        <ChipsRoles roles={c.roles} />
      </View>
      <Icono nombre="chevronDerecha" tamano={20} color={Colores.textGray} />
    </Pressable>
  );
}

function FilaInvitacion({ clinica: c }: { clinica: ClinicaDto }) {
  const [ocupado, setOcupado] = useState(false);
  const responder = async (aceptar: boolean) => {
    setOcupado(true);
    try {
      await ClinicasRepo.responder(c, aceptar);
      Avisos.mostrar(aceptar ? `Ya sos parte de ${c.nombre}` : "Rechazaste la invitación", aceptar ? "exito" : "info");
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
      setOcupado(false);
    }
  };
  return (
    <View style={estilos.fila}>
      <View style={estilos.icono}><Icono nombre="sede" tamano={22} color={Colores.primaryTeal} /></View>
      <View style={estilos.textos}>
        <Texto tamano={15} negrita numberOfLines={1}>{c.nombre}</Texto>
        <Texto variante="chico" tamano={12}>{`${c.invitado_por_nombre ?? "Alguien"} te invitó como ${c.roles.map((r) => NOMBRE_ROL[r].toLowerCase()).join(" y ")}`}</Texto>
      </View>
      <AccionFila texto="Rechazar" deshabilitada={ocupado} alTocar={() => void responder(false)} />
      <AccionFila texto="Aceptar" color={Colores.primaryTeal} deshabilitada={ocupado} alTocar={() => void responder(true)} />
    </View>
  );
}

function CrearClinica({ alListo, alVolver }: { alListo: () => void; alVolver: () => void }) {
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [telefono, setTelefono] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const crear = async () => {
    if (nombre.trim().length < 2) {
      setError("Ingresá el nombre de la veterinaria");
      return;
    }
    setCreando(true);
    try {
      await ClinicasRepo.crearClinica(nombre, direccion, telefono);
      Avisos.mostrar(`Creaste ${nombre.trim()}. Ya podés sumar a tu equipo`, "exito");
      alListo();
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
      setCreando(false);
    }
  };
  return (
    <View>
      <Texto tamano={20} negrita accessibilityRole="header">Crear una veterinaria</Texto>
      <Texto variante="chico" tamano={13} style={{ marginTop: 4 }}>
        Quedás como titular y veterinario/a. Después sumás a tu equipo: otros veterinarios, recepción y administración.
      </Texto>
      <Campo
        estilo={{ marginTop: 14 }} etiqueta="Nombre" placeholder="Ej: Veterinaria San Roque" value={nombre}
        onChangeText={(t) => { setNombre(t); setError(null); }} error={error} autoCapitalize="words"
      />
      <Campo estilo={{ marginTop: 12 }} etiqueta="Dirección (opcional)" placeholder="Calle y número" value={direccion} onChangeText={setDireccion} autoCapitalize="words" />
      <Campo estilo={{ marginTop: 12 }} etiqueta="Teléfono (opcional)" placeholder="Ej: 11 4444-5555" value={telefono} onChangeText={setTelefono} keyboardType="phone-pad" />
      <Boton titulo="Crear veterinaria" icono="mas" alto={50} estilo={{ marginTop: 16 }} cargando={creando} onPress={() => void crear()} />
      <Boton titulo="Volver" variante="texto" alto={46} estilo={{ marginTop: 4 }} deshabilitado={creando} onPress={alVolver} />
    </View>
  );
}

// ---------- Equipo de una veterinaria ----------

type CuentaCreada = CuentaMiembroCreadaDto & { nombre: string; telefono: string; clinica: string };

function FormularioCuenta({ clinica, alCreada, alVolver }: {
  clinica: ClinicaDto; alCreada: (c: CuentaCreada) => void; alVolver: () => void;
}) {
  const [datos, setDatos] = useState({ nombre: "", dni: "", telefono: "", email: "" });
  const [roles, setRoles] = useState<RolClinica[]>(["recepcion"]);
  const [errores, setErrores] = useState<Partial<Record<keyof typeof datos | "roles", string>>>({});
  const [creando, setCreando] = useState(false);
  const cambiar = (c: keyof typeof datos, filtro?: (t: string) => string) => (texto: string) => {
    setDatos((d) => ({ ...d, [c]: filtro ? filtro(texto) : texto }));
    if (errores[c]) setErrores((e) => ({ ...e, [c]: undefined }));
  };
  const crear = async () => {
    const e: typeof errores = {};
    const nombre = datos.nombre.trim();
    if (nombre.length < 3 || !nombre.includes(" ")) e.nombre = "Ingresá el nombre y el apellido";
    if (datos.dni.trim().length < 7 || datos.dni.trim().length > 8) e.dni = "El DNI debe tener 7 u 8 números";
    if (contarDigitos(datos.telefono) < 8) e.telefono = "Ingresá un teléfono válido";
    if (!esCorreoValido(datos.email.trim().toLowerCase())) e.email = "Correo inválido";
    if (roles.length === 0) e.roles = "Elegí al menos un rol";
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setCreando(true);
    try {
      const creada = await ClinicasRepo.crearCuenta({ clinica_id: clinica.id, roles, ...datos });
      alCreada({ ...creada, nombre, telefono: datos.telefono.trim(), clinica: clinica.nombre });
    } catch (err) {
      Avisos.error(Errores.mensaje(err));
      setCreando(false);
    }
  };
  return (
    <View>
      <Texto tamano={20} negrita accessibilityRole="header">Crear su cuenta</Texto>
      <Texto variante="chico" tamano={13} style={{ marginTop: 4 }}>
        {`Para alguien que todavía no usa PetCare. Queda en ${clinica.nombre} al instante, con una contraseña temporal que le pasás por WhatsApp.`}
      </Texto>
      <Texto tamano={14} negrita style={{ marginTop: 14 }}>Va a estar en</Texto>
      <SelectorRoles opciones={ROLES_CUENTA_NUEVA} elegidos={roles} alCambiar={(r) => { setRoles(r); setErrores((x) => ({ ...x, roles: undefined })); }} />
      {errores.roles ? <Texto variante="chico" tamano={12} color={Colores.dangerRed}>{errores.roles}</Texto> : null}
      <Campo estilo={{ marginTop: 12 }} etiqueta="Nombre y apellido" placeholder="Nombre y apellido" value={datos.nombre} onChangeText={cambiar("nombre")} error={errores.nombre} autoCapitalize="words" />
      <Campo estilo={{ marginTop: 12 }} etiqueta="DNI" placeholder="Sin puntos" value={datos.dni} onChangeText={cambiar("dni", soloNumeros)} error={errores.dni} keyboardType="number-pad" />
      <Campo estilo={{ marginTop: 12 }} etiqueta="Teléfono (WhatsApp)" placeholder="Ej: 11 2345 6789" value={datos.telefono} onChangeText={cambiar("telefono")} error={errores.telefono} keyboardType="phone-pad" />
      <Campo
        estilo={{ marginTop: 12 }} etiqueta="Correo electrónico" placeholder="nombre@correo.com" value={datos.email} onChangeText={cambiar("email")}
        error={errores.email} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="send" onSubmitEditing={() => void crear()}
      />
      <Boton titulo="Crear cuenta" icono="persona" alto={50} estilo={{ marginTop: 16 }} cargando={creando} onPress={() => void crear()} />
      <Boton titulo="Volver" variante="texto" alto={46} estilo={{ marginTop: 4 }} deshabilitado={creando} onPress={alVolver} />
    </View>
  );
}

/** Los datos de ingreso de la cuenta recién creada: se muestran una sola vez (como en el alta de dueños). */
function VistaCuentaCreada({ cuenta, alTerminar }: { cuenta: CuentaCreada; alTerminar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  const primer = cuenta.nombre.split(" ")[0];
  const mensaje =
    `Hola ${primer}, te sumé al equipo de ${cuenta.clinica} en la app PetCare.\n\nPara ingresar:\n` +
    `Correo: ${cuenta.email}\nContraseña temporal: ${cuenta.password_temporal}\n\nAl entrar, la app te va a pedir que elijas tu propia contraseña.`;
  return (
    <View>
      <Texto variante="titulo" tamano={21} accessibilityRole="header">Cuenta creada</Texto>
      <Texto variante="subtitulo" tamano={14} style={{ marginTop: 6 }}>{`${cuenta.nombre} ya está en ${cuenta.clinica}. Mandale estos datos para que entre.`}</Texto>
      <View style={estilos.credenciales}>
        <Texto variante="chico" tamano={12}>Correo</Texto>
        <Texto variante="titulo" tamano={16} selectable>{cuenta.email}</Texto>
        <Texto variante="chico" tamano={12} style={{ marginTop: 12 }}>Contraseña temporal</Texto>
        <Texto variante="titulo" tamano={20} selectable>{cuenta.password_temporal}</Texto>
      </View>
      <Texto variante="chico" tamano={12.5} style={{ marginTop: 10 }}>Esta contraseña se muestra una sola vez. La tiene que cambiar la primera vez que ingresa.</Texto>
      <Boton
        titulo="Enviar por WhatsApp" alto={52} estilo={{ marginTop: 16 }}
        onPress={() => void Contacto.abrir(Contacto.whatsApp(cuenta.telefono, mensaje) ?? Contacto.compartirTexto(mensaje), "No pudimos abrir WhatsApp")}
      />
      <Boton
        titulo={copiado ? "Datos copiados" : "Copiar datos"} variante="secundario" alto={50} estilo={{ marginTop: 8 }}
        onPress={() => { void Clipboard.setStringAsync(mensaje); setCopiado(true); Avisos.mostrar("Datos copiados"); }}
      />
      <Boton titulo="Listo" variante="texto" alto={50} estilo={{ marginTop: 4 }} onPress={alTerminar} />
    </View>
  );
}

/** [unicoTitular]: la veterinaria no puede quedarse sin titular, así que esa persona no tiene "Salir". */
function FilaMiembro({ miembro: m, administra, esTitular, unicoTitular, alCambio }: {
  miembro: MiembroClinicaDto; administra: boolean; esTitular: boolean; unicoTitular: boolean; alCambio: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const [roles, setRoles] = useState<RolClinica[]>(m.roles);
  const [ocupado, setOcupado] = useState(false);
  const pendiente = m.estado === "pendiente";
  const opciones: RolClinica[] = esTitular ? ["titular", ...ROLES_INVITAR] : ROLES_INVITAR;
  // Al titular solo lo toca otro titular
  const puedeTocar = administra && !m.es_yo && (esTitular || !m.roles.includes("titular"));

  const guardarRoles = async () => {
    setOcupado(true);
    try {
      await ClinicasRepo.cambiarRoles(m.miembro_id, roles);
      Avisos.mostrar("Roles actualizados", "exito");
      setEditando(false);
      alCambio();
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
    } finally {
      setOcupado(false);
    }
  };
  const quitar = () => {
    const titulo = m.es_yo ? "¿Salir de la veterinaria?" : pendiente ? "¿Cancelar la invitación?" : `¿Sacar a ${m.nombre}?`;
    const mensaje = m.es_yo
      ? "Vas a dejar de ver su agenda y su equipo. Te pueden volver a invitar cuando quieran."
      : pendiente ? `${m.nombre} ya no va a poder sumarse con esta invitación.`
        : `${m.nombre} deja de ver la agenda y el equipo. La podés volver a invitar cuando quieras.`;
    Avisos.confirmar({
      titulo, mensaje, textoAceptar: m.es_yo ? "Salir" : pendiente ? "Cancelar invitación" : "Sacar", textoCancelar: "Volver",
      alAceptar: () => {
        void (async () => {
          try {
            await ClinicasRepo.quitar(m.miembro_id);
            alCambio();
          } catch (e) {
            Avisos.error(Errores.mensaje(e));
          }
        })();
      },
    });
  };

  return (
    <View style={estilos.filaMiembro}>
      <View style={estilos.filaInterna}>
        <Avatar nombre={m.nombre} fotoPath={m.foto_path ?? null} tamano={42} />
        <View style={estilos.textos}>
          <Texto tamano={15} negrita numberOfLines={1}>{m.es_yo ? `${m.nombre} (vos)` : m.nombre}</Texto>
          <Texto variante="chico" tamano={12} numberOfLines={1}>{m.email}</Texto>
          <ChipsRoles roles={m.roles} pendiente={pendiente} />
        </View>
        {puedeTocar && !editando ? <AccionFila texto="Roles" color={Colores.primaryTeal} alTocar={() => { setRoles(m.roles); setEditando(true); }} /> : null}
        {puedeTocar || (m.es_yo && !unicoTitular) ? <AccionFila texto={m.es_yo ? "Salir" : pendiente ? "Cancelar" : "Sacar"} alTocar={quitar} /> : null}
      </View>
      {editando ? (
        <View style={estilos.editorRoles}>
          <SelectorRoles opciones={opciones} elegidos={roles} alCambiar={setRoles} />
          <View style={estilos.botonesFila}>
            <Boton titulo="Cancelar" variante="secundario" alto={40} estilo={{ flex: 1 }} deshabilitado={ocupado} onPress={() => setEditando(false)} />
            <Boton titulo="Guardar" alto={40} estilo={{ flex: 1 }} cargando={ocupado} deshabilitado={roles.length === 0} onPress={() => void guardarRoles()} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Equipo({ clinica, alVolver, alCrearCuenta }: { clinica: ClinicaDto; alVolver: () => void; alCrearCuenta: () => void }) {
  const [equipo, setEquipo] = useState<MiembroClinicaDto[] | null>(null);
  const [dato, setDato] = useState("");
  const [roles, setRoles] = useState<RolClinica[]>(["recepcion"]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const administra = ClinicasRepo.administra(clinica.id);
  const esTitular = ClinicasRepo.esTitular(clinica.id);

  const cargar = () => {
    ClinicasRepo.equipo(clinica.id).then(setEquipo).catch((e: unknown) => {
      setEquipo([]);
      Avisos.error(Errores.mensaje(e));
    });
  };
  useEffect(cargar, [clinica.id]);

  const invitar = async () => {
    if (dato.trim().length < 6) {
      setError("Ingresá el DNI o el correo de la persona");
      return;
    }
    if (roles.length === 0) {
      setError("Elegí al menos un rol");
      return;
    }
    setEnviando(true);
    try {
      const nombre = await ClinicasRepo.invitar(clinica.id, dato, roles);
      setDato("");
      Avisos.exito(`Le mandamos la invitación a ${nombre}`);
      cargar();
    } catch (e) {
      setError(Errores.mensaje(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityLabel="Volver a mis veterinarias" onPress={alVolver} style={[estilos.volver, cursorTocable]}>
        <Icono nombre="volver" tamano={18} color={Colores.primaryTeal} />
        <Texto tamano={13} negrita color={Colores.primaryTeal}>Mis veterinarias</Texto>
      </Pressable>
      <Texto tamano={20} negrita accessibilityRole="header">{clinica.nombre}</Texto>
      <Texto variante="chico" tamano={13} style={{ marginTop: 4 }}>
        La recepción y la administración manejan la agenda de todos los veterinarios de acá. La historia clínica la ven solo los veterinarios.
      </Texto>
      <View style={{ marginTop: 10 }}>
        {equipo == null ? (
          <ActivityIndicator color={Colores.primaryTeal} style={{ marginVertical: 16 }} />
        ) : (
          // Primero el equipo activo, después las invitaciones sin responder
          [...equipo].sort((a, b) => (a.estado === b.estado ? 0 : a.estado === "activo" ? -1 : 1)).map((m) => (
            <FilaMiembro
              key={m.miembro_id} miembro={m} administra={administra} esTitular={esTitular} alCambio={cargar}
              unicoTitular={m.roles.includes("titular") && equipo.filter((x) => x.estado === "activo" && x.roles.includes("titular")).length === 1}
            />
          ))
        )}
      </View>

      {administra ? (
        <>
          <Texto tamano={15} negrita style={{ marginTop: 16 }}>Sumar a alguien</Texto>
          <Texto variante="chico" tamano={13} style={{ marginTop: 2 }}>Tiene que tener una cuenta en PetCare. Le llega una invitación para aceptar.</Texto>
          <SelectorRoles opciones={esTitular ? ["titular", ...ROLES_INVITAR] : ROLES_INVITAR} elegidos={roles} alCambiar={(r) => { setRoles(r); setError(null); }} />
          <Campo
            icono="persona" placeholder="DNI o correo" accessibilityLabel="DNI o correo de la persona a sumar" value={dato}
            onChangeText={(t) => { setDato(t); setError(null); }} error={error} autoCapitalize="none" keyboardType="email-address"
            returnKeyType="send" onSubmitEditing={() => void invitar()} estilo={{ marginTop: 10 }}
          />
          <Boton titulo="Enviar invitación" icono="persona" alto={50} estilo={{ marginTop: 12 }} cargando={enviando} onPress={() => void invitar()} />
          <Boton titulo="No tiene cuenta: crearla" variante="texto" alto={46} estilo={{ marginTop: 4 }} onPress={alCrearCuenta} />
        </>
      ) : null}
    </View>
  );
}

// ---------- La hoja ----------

type Vista =
  | { tipo: "lista" } | { tipo: "crearClinica" } | { tipo: "equipo"; clinicaId: string }
  | { tipo: "crearCuenta"; clinicaId: string } | { tipo: "creada"; cuenta: CuentaCreada; clinicaId: string };

/** [clinicaInicial]: abre directo el equipo de esa veterinaria. */
export function VeterinariasHoja({ alCerrar, clinicaInicial = null }: { alCerrar: () => void; clinicaInicial?: string | null }) {
  useDatos();
  const [vista, setVista] = useState<Vista>(clinicaInicial ? { tipo: "equipo", clinicaId: clinicaInicial } : { tipo: "lista" });
  const [cargado, setCargado] = useState(false);
  const puedeCrear = Sesion.rolesDisponibles.includes("VETERINARIO");

  // Se vuelve a pedir al abrir: puede haber llegado una invitación desde la última carga
  useEffect(() => {
    void ClinicasRepo.cargar().then(() => setCargado(true));
  }, []);

  const clinicaDe = (id: string) => ClinicasRepo.clinica(id);
  let contenido;
  if (vista.tipo === "crearClinica") {
    contenido = <CrearClinica alListo={() => setVista({ tipo: "lista" })} alVolver={() => setVista({ tipo: "lista" })} />;
  } else if (vista.tipo === "equipo" && clinicaDe(vista.clinicaId)) {
    const c = clinicaDe(vista.clinicaId)!;
    contenido = <Equipo clinica={c} alVolver={() => setVista({ tipo: "lista" })} alCrearCuenta={() => setVista({ tipo: "crearCuenta", clinicaId: c.id })} />;
  } else if (vista.tipo === "crearCuenta" && clinicaDe(vista.clinicaId)) {
    const c = clinicaDe(vista.clinicaId)!;
    contenido = (
      <FormularioCuenta
        clinica={c} alCreada={(cuenta) => setVista({ tipo: "creada", cuenta, clinicaId: c.id })}
        alVolver={() => setVista({ tipo: "equipo", clinicaId: c.id })}
      />
    );
  } else if (vista.tipo === "creada") {
    contenido = <VistaCuentaCreada cuenta={vista.cuenta} alTerminar={() => setVista({ tipo: "equipo", clinicaId: vista.clinicaId })} />;
  } else {
    const activas = ClinicasRepo.activas;
    const invitaciones = ClinicasRepo.invitaciones;
    contenido = (
      <View>
        <Texto tamano={20} negrita accessibilityRole="header">Mis veterinarias</Texto>
        <Texto variante="chico" tamano={13} style={{ marginTop: 4 }}>
          Las veterinarias en las que trabajás. Podés estar en varias, con distintos roles en cada una.
        </Texto>
        {!cargado && activas.length === 0 && invitaciones.length === 0 ? (
          <ActivityIndicator color={Colores.primaryTeal} style={{ marginVertical: 16 }} />
        ) : null}
        {invitaciones.length > 0 ? (
          <>
            <Texto tamano={15} negrita style={{ marginTop: 14 }}>Invitaciones</Texto>
            {invitaciones.map((c) => <FilaInvitacion key={c.miembro_id} clinica={c} />)}
          </>
        ) : null}
        <View style={{ marginTop: 10 }}>
          {activas.map((c) => <FilaClinica key={c.miembro_id} clinica={c} alTocar={() => setVista({ tipo: "equipo", clinicaId: c.id })} />)}
          {cargado && activas.length === 0 && invitaciones.length === 0 ? (
            <Texto variante="chico" tamano={13} style={{ marginVertical: 8 }}>
              Todavía no estás en ninguna veterinaria. Cuando te inviten, la invitación aparece acá y en tu Inicio.
            </Texto>
          ) : null}
        </View>
        {puedeCrear ? (
          <Boton titulo="Crear una veterinaria" icono="mas" variante="secundario" alto={48} estilo={{ marginTop: 14 }} onPress={() => setVista({ tipo: "crearClinica" })} />
        ) : null}
      </View>
    );
  }

  // Los datos de la cuenta creada se muestran una sola vez: no se cierra tocando afuera
  return (
    <HojaInferior visible alCerrar={vista.tipo === "creada" ? () => {} : alCerrar} cancelable={vista.tipo !== "creada"}>
      {contenido}
    </HojaInferior>
  );
}

/** Resumen para la fila del perfil: en qué veterinarias está y si hay invitaciones. */
export function resumenVeterinarias(): string {
  const activas = ClinicasRepo.activas;
  const invitaciones = ClinicasRepo.invitaciones.length;
  const partes: string[] = [];
  if (activas.length === 1) partes.push(activas[0].nombre);
  else if (activas.length > 1) partes.push(`${activas.length} veterinarias`);
  else if (invitaciones === 0) partes.push("Ninguna todavía");
  if (invitaciones > 0) partes.push(invitaciones === 1 ? "1 invitación" : `${invitaciones} invitaciones`);
  return partes.join(" · ");
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colores.dividerLight },
  filaMiembro: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colores.dividerLight },
  filaInterna: { flexDirection: "row", alignItems: "center" },
  icono: { width: 42, height: 42, borderRadius: 12, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
  textos: { flex: 1, minWidth: 0, marginLeft: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  accion: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  editorRoles: { marginTop: 8, marginLeft: 54 },
  botonesFila: { flexDirection: "row", gap: 10, marginTop: 10 },
  volver: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginBottom: 8 },
  credenciales: {
    backgroundColor: Colores.white, borderRadius: 16, borderWidth: 1, borderColor: Colores.loginFieldStroke, padding: 14, marginTop: 16,
  },
});
