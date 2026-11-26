/*
 * Vínculos de recepción, desde cualquiera de los dos lados (como la hoja de dueños de una mascota):
 * - el veterinario ve a las personas de su recepción, responde los pedidos, invita por DNI o correo, le crea la
 *   cuenta a quien todavía no usa PetCare (con contraseña temporal) y quita a quien ya no trabaja con él;
 * - quien trabaja en recepción ve a sus veterinarios, responde las invitaciones, pide sumarse a la recepción de otro
 *   (por correo, DNI o matrícula) y puede dejar de trabajar para uno.
 */
import * as Clipboard from "expo-clipboard";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { PerfilVetRepo } from "../../data/repositorio/perfilVetRepo";
import { RecepcionRepo } from "../../data/repositorio/recepcionRepo";
import type { CuentaRecepcionCreadaDto, VinculoRecepcionDto } from "../../data/remoto/dtos";
import { Servicios } from "../../data/servicios";
import { Errores } from "../../util/errores";
import { contarDigitos, esCorreoValido, soloNumeros } from "../auth/validaciones";
import { Avatar } from "./Avatar";
import { Avisos } from "./Avisos";
import { Boton } from "./Boton";
import { Campo } from "./Campo";
import { Chip } from "./Chip";
import { Contacto } from "./Contacto";
import { HojaInferior } from "./HojaInferior";
import { Colores } from "./tema";
import { Texto } from "./Texto";
import { useDatos } from "./useDatos";
import { cursorTocable, estiloFoco, useFoco } from "./Web";

/** Desde qué lado se mira: la cuenta es el veterinario o la persona que trabaja en su recepción. */
export type LadoRecepcion = "veterinario" | "recepcionista";

const TEXTOS: Record<LadoRecepcion, {
  titulo: string; explicacion: string; vacio: string; tituloInvitar: string; ayudaInvitar: string;
  placeholder: string; etiquetaCampo: string; boton: string; minimo: number; errorCorto: string; enviado: string;
}> = {
  veterinario: {
    titulo: "Recepción",
    explicacion:
      "Las personas de tu recepción ven y manejan tu agenda (sacan, mueven y cancelan turnos y marcan la llegada) y " +
      "responden los pedidos de acceso. No ven la historia clínica, las recetas ni los informes.",
    vacio: "Todavía no tenés a nadie en tu recepción.",
    tituloInvitar: "Invitar a alguien a tu recepción",
    ayudaInvitar: "Tiene que tener una cuenta en PetCare. Le llega una invitación para aceptar.",
    placeholder: "DNI o correo",
    etiquetaCampo: "DNI o correo de la persona a invitar",
    boton: "Enviar invitación",
    minimo: 6,
    errorCorto: "Ingresá el DNI o el correo de la otra persona",
    enviado: "Le mandamos la invitación",
  },
  recepcionista: {
    titulo: "Trabajo en recepción",
    explicacion:
      "Manejás la agenda de estos veterinarios: sus turnos, la llegada de los pacientes y los pedidos de acceso. " +
      "No ves la historia clínica, las recetas ni los informes.",
    vacio: "Todavía no trabajás en la recepción de ningún veterinario.",
    tituloInvitar: "Sumarme a la recepción de un veterinario",
    ayudaInvitar: "Escribí el correo, el DNI o la matrícula del veterinario. Le llega tu pedido para aceptar.",
    placeholder: "Correo, DNI o matrícula",
    etiquetaCampo: "Correo, DNI o matrícula del veterinario",
    boton: "Enviar pedido",
    minimo: 3,
    errorCorto: "Ingresá el correo, el DNI o la matrícula del veterinario",
    enviado: "Le mandamos tu pedido",
  },
};

function AccionFila({ texto, color, alTocar, deshabilitada }: {
  texto: string; color: string; alTocar: () => void; deshabilitada?: boolean;
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

/** Estado del vínculo en palabras, desde el lado de la cuenta (null si ya está activo). */
function chipDe(v: VinculoRecepcionDto, lado: LadoRecepcion): string | null {
  if (v.estado === "activo") return null;
  if (v.me_toca_responder) return lado === "veterinario" ? "Quiere sumarse" : "Te invitó";
  return lado === "veterinario" ? "Invitación pendiente" : "Pedido pendiente";
}

function FilaVinculo({ vinculo: v, lado, ocupado, alResponder, alQuitar }: {
  vinculo: VinculoRecepcionDto; lado: LadoRecepcion; ocupado: boolean;
  alResponder: (aceptar: boolean) => void; alQuitar: () => void;
}) {
  const chip = chipDe(v, lado);
  const detalle = lado === "recepcionista" && v.clinica ? v.clinica : v.email;
  return (
    <View style={estilos.fila}>
      <Avatar nombre={v.nombre} fotoPath={v.foto_path ?? null} tamano={42} />
      <View style={estilos.textos}>
        <Texto tamano={15} negrita numberOfLines={1}>{v.nombre}</Texto>
        <Texto variante="chico" tamano={12} numberOfLines={1}>{detalle}</Texto>
        {chip ? (
          <View style={estilos.chips}>
            <Chip texto={chip} tono={v.me_toca_responder ? "info" : "aviso"} />
          </View>
        ) : null}
      </View>
      {v.me_toca_responder ? (
        <View style={estilos.acciones}>
          <AccionFila texto="Rechazar" color={Colores.dangerRed} deshabilitada={ocupado} alTocar={() => alResponder(false)} />
          <AccionFila texto="Aceptar" color={Colores.primaryTeal} deshabilitada={ocupado} alTocar={() => alResponder(true)} />
        </View>
      ) : (
        <AccionFila
          texto={v.estado === "pendiente" ? "Cancelar" : lado === "veterinario" ? "Quitar" : "Dejar"}
          color={Colores.dangerRed} deshabilitada={ocupado} alTocar={alQuitar}
        />
      )}
    </View>
  );
}

type CampoCuenta = "nombre" | "dni" | "telefono" | "email";

/** El veterinario crea la cuenta de una persona de su recepción que todavía no usa PetCare. */
function FormularioCuenta({ alCreada, alVolver }: {
  alCreada: (c: CuentaRecepcionCreadaDto & { nombre: string; telefono: string }) => void; alVolver: () => void;
}) {
  const [datos, setDatos] = useState<Record<CampoCuenta, string>>({ nombre: "", dni: "", telefono: "", email: "" });
  const [errores, setErrores] = useState<Partial<Record<CampoCuenta, string>>>({});
  const [creando, setCreando] = useState(false);
  const cambiar = (c: CampoCuenta, filtro?: (t: string) => string) => (texto: string) => {
    setDatos((d) => ({ ...d, [c]: filtro ? filtro(texto) : texto }));
    if (errores[c]) setErrores((e) => ({ ...e, [c]: undefined }));
  };

  const crear = async () => {
    const e: Partial<Record<CampoCuenta, string>> = {};
    const nombre = datos.nombre.trim();
    if (nombre.length < 3 || !nombre.includes(" ")) e.nombre = "Ingresá el nombre y el apellido";
    if (datos.dni.trim().length < 7 || datos.dni.trim().length > 8) e.dni = "El DNI debe tener 7 u 8 números";
    if (contarDigitos(datos.telefono) < 8) e.telefono = "Ingresá un teléfono válido";
    if (!esCorreoValido(datos.email.trim().toLowerCase())) e.email = "Correo inválido";
    setErrores(e);
    if (Object.keys(e).length > 0) return;
    setCreando(true);
    try {
      const creada = await RecepcionRepo.crearCuenta(datos);
      alCreada({ ...creada, nombre, telefono: datos.telefono.trim() });
    } catch (err) {
      Avisos.error(Errores.mensaje(err));
      setCreando(false);
    }
  };

  return (
    <View>
      <Texto tamano={20} negrita accessibilityRole="header">Crear su cuenta</Texto>
      <Texto variante="chico" tamano={13} style={{ marginTop: 4 }}>
        Para alguien que todavía no usa PetCare. Se crea con una contraseña temporal, queda en tu recepción al instante
        y le pasás los datos por WhatsApp.
      </Texto>
      <Campo
        estilo={{ marginTop: 14 }} etiqueta="Nombre y apellido" placeholder="Nombre y apellido" value={datos.nombre}
        onChangeText={cambiar("nombre")} error={errores.nombre} autoCapitalize="words"
      />
      <Campo
        estilo={{ marginTop: 12 }} etiqueta="DNI" placeholder="Sin puntos" value={datos.dni}
        onChangeText={cambiar("dni", soloNumeros)} error={errores.dni} keyboardType="number-pad"
      />
      <Campo
        estilo={{ marginTop: 12 }} etiqueta="Teléfono (WhatsApp)" placeholder="Ej: 11 2345 6789" value={datos.telefono}
        onChangeText={cambiar("telefono")} error={errores.telefono} keyboardType="phone-pad"
      />
      <Campo
        estilo={{ marginTop: 12 }} etiqueta="Correo electrónico" placeholder="nombre@correo.com" value={datos.email}
        onChangeText={cambiar("email")} error={errores.email} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
        returnKeyType="send" onSubmitEditing={() => void crear()}
      />
      <Boton titulo="Crear cuenta" icono="persona" alto={50} estilo={{ marginTop: 16 }} cargando={creando} onPress={() => void crear()} />
      <Boton titulo="Volver" variante="texto" alto={46} estilo={{ marginTop: 4 }} deshabilitado={creando} onPress={alVolver} />
    </View>
  );
}

/** Los datos de ingreso de la cuenta recién creada: se muestran una sola vez (como en el alta de dueños). */
function CuentaCreada({ cuenta, alTerminar }: {
  cuenta: CuentaRecepcionCreadaDto & { nombre: string; telefono: string }; alTerminar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const mensaje = Contacto.mensajeDeAccesoRecepcion(
    cuenta.nombre, cuenta.email, cuenta.password_temporal, PerfilVetRepo.nombre, PerfilVetRepo.clinica,
  );
  return (
    <View>
      <Texto variante="titulo" tamano={21} accessibilityRole="header">Cuenta creada</Texto>
      <Texto variante="subtitulo" tamano={14} style={{ marginTop: 6 }}>
        {`${cuenta.nombre} ya está en tu recepción. Mandale estos datos para que entre.`}
      </Texto>
      <View style={estilos.credenciales}>
        <Texto variante="chico" tamano={12}>Correo</Texto>
        <Texto variante="titulo" tamano={16} selectable>{cuenta.email}</Texto>
        <Texto variante="chico" tamano={12} style={{ marginTop: 12 }}>Contraseña temporal</Texto>
        <Texto variante="titulo" tamano={20} selectable>{cuenta.password_temporal}</Texto>
      </View>
      <Texto variante="chico" tamano={12.5} style={{ marginTop: 10 }}>
        Esta contraseña se muestra una sola vez. La tiene que cambiar la primera vez que ingresa.
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
      <Boton titulo="Listo" variante="texto" alto={50} estilo={{ marginTop: 4 }} onPress={alTerminar} />
    </View>
  );
}

export function RecepcionHoja({ lado, alCerrar }: { lado: LadoRecepcion; alCerrar: () => void }) {
  useDatos();
  const t = TEXTOS[lado];
  const [vista, setVista] = useState<"lista" | "crear">("lista");
  const [creada, setCreada] = useState<(CuentaRecepcionCreadaDto & { nombre: string; telefono: string }) | null>(null);
  const [cargado, setCargado] = useState(false);
  const [dato, setDato] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const vinculos = lado === "veterinario" ? RecepcionRepo.miRecepcion : RecepcionRepo.misVeterinarios;

  // Se vuelve a pedir al abrir: puede haber llegado un pedido desde la última carga
  useEffect(() => {
    void RecepcionRepo.cargar().then(() => {
      setCargado(true);
      Servicios.avisarCambio();
    });
  }, []);

  const enviar = async () => {
    const texto = dato.trim();
    if (texto.length < t.minimo) {
      setError(t.errorCorto);
      return;
    }
    setEnviando(true);
    try {
      const estado = lado === "veterinario" ? await RecepcionRepo.invitar(texto) : await RecepcionRepo.pedir(texto);
      setDato("");
      // Si la otra persona ya lo había pedido, el vínculo queda activo en el momento
      Avisos.exito(estado === "activo" ? "Listo: ya quedaron vinculados" : t.enviado);
    } catch (e) {
      setError(Errores.mensaje(e));
    } finally {
      setEnviando(false);
    }
  };

  const responder = async (v: VinculoRecepcionDto, aceptar: boolean) => {
    setOcupado(v.id);
    try {
      await RecepcionRepo.responder(v, aceptar);
      if (aceptar) {
        Avisos.exito(lado === "veterinario" ? `${v.nombre} ya está en tu recepción` : `Ya estás en la recepción de ${v.nombre}`);
      } else {
        Avisos.mostrar(lado === "veterinario" ? "Rechazaste el pedido" : "Rechazaste la invitación");
      }
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
    } finally {
      setOcupado(null);
    }
  };

  const quitar = (v: VinculoRecepcionDto) => {
    const pendiente = v.estado === "pendiente";
    let titulo: string;
    let mensaje: string;
    let textoAceptar: string;
    if (pendiente) {
      titulo = lado === "veterinario" ? "¿Cancelar la invitación?" : "¿Cancelar el pedido?";
      mensaje = lado === "veterinario"
        ? `${v.nombre} ya no va a poder sumarse a tu recepción con esta invitación.`
        : `${v.nombre} ya no va a ver tu pedido.`;
      textoAceptar = lado === "veterinario" ? "Cancelar invitación" : "Cancelar pedido";
    } else if (lado === "veterinario") {
      titulo = `¿Quitar a ${v.nombre}?`;
      mensaje = `${v.nombre} deja de ver tu agenda y tus pacientes. Podés volver a invitarlo/a cuando quieras.`;
      textoAceptar = "Quitar";
    } else {
      titulo = `¿Dejar la recepción de ${v.nombre}?`;
      mensaje = "Vas a dejar de ver su agenda y sus pacientes. Te puede volver a invitar cuando quiera.";
      textoAceptar = "Dejar";
    }
    Avisos.confirmar({
      titulo, mensaje, textoAceptar, textoCancelar: "Volver",
      alAceptar: () => {
        void (async () => {
          setOcupado(v.id);
          try {
            await RecepcionRepo.quitar(v);
          } catch (e) {
            Avisos.error(Errores.mensaje(e));
          } finally {
            setOcupado(null);
          }
        })();
      },
    });
  };

  if (creada) {
    // Los datos se muestran una sola vez: no se cierra tocando afuera
    return (
      <HojaInferior visible alCerrar={() => {}} cancelable={false}>
        <CuentaCreada cuenta={creada} alTerminar={() => { setCreada(null); setDato(""); setError(null); setVista("lista"); }} />
      </HojaInferior>
    );
  }
  if (vista === "crear") {
    return (
      <HojaInferior visible alCerrar={alCerrar}>
        <FormularioCuenta alCreada={setCreada} alVolver={() => { setDato(""); setError(null); setVista("lista"); }} />
      </HojaInferior>
    );
  }

  return (
    <HojaInferior
      visible alCerrar={alCerrar}
      pie={<Boton titulo={t.boton} icono="persona" alto={50} cargando={enviando} onPress={() => void enviar()} />}
    >
      <Texto tamano={20} negrita accessibilityRole="header">{t.titulo}</Texto>
      <Texto variante="chico" tamano={13} style={{ marginTop: 4 }}>{t.explicacion}</Texto>

      <View style={{ marginTop: 12 }}>
        {!cargado && vinculos.length === 0 ? (
          <ActivityIndicator color={Colores.primaryTeal} style={{ marginVertical: 16 }} />
        ) : vinculos.length === 0 ? (
          <Texto variante="chico" tamano={13} style={{ marginVertical: 8 }}>{t.vacio}</Texto>
        ) : (
          vinculos.map((v) => (
            <FilaVinculo
              key={v.id} vinculo={v} lado={lado} ocupado={ocupado === v.id}
              alResponder={(aceptar) => void responder(v, aceptar)} alQuitar={() => quitar(v)}
            />
          ))
        )}
      </View>

      <Texto tamano={15} negrita style={{ marginTop: 16 }}>{t.tituloInvitar}</Texto>
      <Texto variante="chico" tamano={13} style={{ marginTop: 2 }}>{t.ayudaInvitar}</Texto>
      <Campo
        icono="persona" placeholder={t.placeholder} accessibilityLabel={t.etiquetaCampo}
        value={dato} onChangeText={(texto) => { setDato(texto); setError(null); }} error={error}
        autoCapitalize="none" keyboardType="email-address" returnKeyType="send" onSubmitEditing={() => void enviar()}
        estilo={{ marginTop: 10 }}
      />
      {lado === "veterinario" ? (
        <Boton
          titulo="No tiene cuenta: crearla" variante="texto" alto={46} estilo={{ marginTop: 6 }}
          onPress={() => setVista("crear")}
        />
      ) : null}
    </HojaInferior>
  );
}

/** Resumen para la fila del perfil: cuántas personas o veterinarios hay y si algo espera respuesta. */
export function resumenRecepcion(lado: LadoRecepcion): string {
  const lista = lado === "veterinario" ? RecepcionRepo.miRecepcion : RecepcionRepo.misVeterinarios;
  const activos = lista.filter((v) => v.estado === "activo").length;
  const porResponder = lista.filter((v) => v.me_toca_responder).length;
  // Lo que la cuenta mandó y todavía espera la respuesta del otro lado
  const esperando = lista.filter((v) => v.estado === "pendiente" && !v.me_toca_responder).length;
  const partes: string[] = [];
  if (lado === "veterinario") {
    if (activos > 0 || (porResponder === 0 && esperando === 0)) {
      partes.push(activos === 0 ? "Nadie todavía" : activos === 1 ? "1 persona" : `${activos} personas`);
    }
    if (esperando > 0) partes.push(esperando === 1 ? "1 invitación pendiente" : `${esperando} invitaciones pendientes`);
  } else {
    if (activos > 0 || (porResponder === 0 && esperando === 0)) {
      partes.push(activos === 0 ? "Ningún veterinario" : activos === 1 ? "1 veterinario" : `${activos} veterinarios`);
    }
    if (esperando > 0) partes.push(esperando === 1 ? "1 pedido pendiente" : `${esperando} pedidos pendientes`);
  }
  if (porResponder > 0) partes.push(porResponder === 1 ? "1 para responder" : `${porResponder} para responder`);
  return partes.join(" · ");
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colores.dividerLight },
  textos: { flex: 1, minWidth: 0, marginLeft: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 },
  acciones: { flexDirection: "row" },
  accion: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  credenciales: {
    backgroundColor: Colores.white, borderRadius: 16, borderWidth: 1, borderColor: Colores.loginFieldStroke, padding: 14, marginTop: 16,
  },
});
