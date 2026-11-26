/*
 * Migrado de PerfilPantalla (ui/dueno/PerfilPantalla.kt) + pantalla_mi_perfil.xml.
 * Mi perfil: foto, datos de la cuenta y accesos a veterinarios, edición, contraseña, cambio de modo, las
 * veterinarias en las que trabaja (si está en alguna) y cierre de sesión.
 *
 * Desvíos: el `AlertDialog` de "Cambiar contraseña" y el de "Ajustar posición de la foto" son hojas del kit; el
 * recorte arrastrable es `RecortarFotoDialogo`. Arriba de "Cuenta" se muestra `TarjetaPermiso` (aviso de las
 * notificaciones apagadas): en el Kotlin la pregunta de permiso la hacía `DuenoActivity` al abrirse.
 */
import { LinearGradient } from "expo-linear-gradient";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Servicios } from "../../data/servicios";
import { Sesion } from "../../data/sesion";
import { DuenoRepo } from "../../data/repositorio/duenoRepo";
import type { AjusteFoto } from "../../model/modelos";
import { Errores } from "../../util/errores";
import { Avisos } from "../common/Avisos";
import { BajaDeCuenta } from "../common/BajaDeCuenta";
import { Boton } from "../common/Boton";
import { Campo } from "../common/Campo";
import { HojaInferior } from "../common/HojaInferior";
import { HojaLista } from "../common/HojaLista";
import { Icono, type NombreIcono } from "../common/Icono";
import { ImagenRemota } from "../common/ImagenRemota";
import { ModoDeUso } from "../common/ModoDeUso";
import { PantallaBase } from "../common/PantallaBase";
import { VeterinariasHoja } from "../common/VeterinariasHoja";
import { ClinicasRepo } from "../../data/repositorio/clinicasRepo";
import { Tarjeta } from "../common/Tarjeta";
import { TarjetaPermiso } from "../common/TarjetaPermiso";
import { Texto } from "../common/Texto";
import { Colores, sombra } from "../common/tema";
import { useDatos } from "../common/useDatos";
import { useSesionRequerida } from "../common/useSesionRequerida";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { elegirImagen } from "../common/Selectores";
import { NavDueno } from "./navegacionDueno";
import { RecortarFotoDialogo } from "./RecortarFotoDialogo";

const AJUSTE_A_ESCALA = { LLENAR: "cover", COMPLETA: "contain", CENTRADA: "none" } as const;
const ICONOS_TIPO: Record<string, NombreIcono> = { Perro: "perro", Gato: "gato", Ave: "ave", Reptil: "reptil", Pez: "pez", Roedor: "roedor" };

function Dato({ icono, etiqueta, valor, divisor }: { icono: NombreIcono; etiqueta: string; valor: string; divisor?: boolean }) {
  return (
    <>
      {divisor ? <View style={estilos.divisor} /> : null}
      <View style={estilos.filaDato}>
        <View style={estilos.cajaIcono}><Icono nombre={icono} tamano={20} color={Colores.primaryTeal} /></View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Texto variante="chico" tamano={12}>{etiqueta}</Texto>
          <Texto variante="cuerpo" peso="medium" style={{ marginTop: 1 }}>{valor}</Texto>
        </View>
      </View>
    </>
  );
}

function FilaCuenta({ icono, texto, alTocar, divisor }: { icono: NombreIcono; texto: string; alTocar: () => void; divisor?: boolean }) {
  const foco = useFoco();
  return (
    <>
      {divisor ? <View style={estilos.divisor} /> : null}
      <Pressable
        accessibilityRole="button" accessibilityLabel={texto} onPress={alTocar} {...foco.props}
        style={[estilos.filaDato, cursorTocable, estiloFoco(foco.enfocado)]}
      >
        <View style={estilos.cajaIcono}><Icono nombre={icono} tamano={20} color={Colores.primaryTeal} /></View>
        <Texto variante="cuerpo" peso="medium" style={{ flex: 1, marginLeft: 12 }}>{texto}</Texto>
        <Icono nombre="chevronDerecha" tamano={22} color={Colores.textGray} />
      </Pressable>
    </>
  );
}

function Contador({ valor, etiqueta, alTocar }: { valor: number; etiqueta: string; alTocar: () => void }) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={`${valor} ${etiqueta}`} onPress={alTocar} {...foco.props}
      style={[estilos.contador, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <Texto variante="titulo" tamano={20} color={Colores.white}>{String(valor)}</Texto>
      <Texto variante="chico" tamano={12} color="#FFFFFFE6">{etiqueta}</Texto>
    </Pressable>
  );
}

/** Pide el alta como veterinario sobre la misma cuenta (RegistroVeterinarioActivity con EXTRA_CUENTA_EXISTENTE). */
function pedirAltaVeterinario() {
  router.push({ pathname: "/auth/registro-veterinario", params: { cuentaExistente: "1" } });
}

export default function PerfilPantalla() {
  useSesionRequerida();
  useDatos();
  const [, setTick] = useState(0);
  const redibujar = () => setTick((t) => t + 1);
  const perfil = DuenoRepo.perfil;

  const [hojaMascotas, setHojaMascotas] = useState(false);
  const [hojaVets, setHojaVets] = useState(false);
  const [hojaRecepcion, setHojaRecepcion] = useState(false);
  const [hojaAjuste, setHojaAjuste] = useState(false);
  const [aRecortar, setARecortar] = useState<string | null>(null);
  const [hojaPassword, setHojaPassword] = useState(false);
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Entre que se abre el perfil y se revisa el alta puede haber cambiado (o se volvió de pedirla): se pide al servidor
  useFocusEffect(
    useCallback(() => {
      let vigente = true;
      void (async () => {
        try {
          await Sesion.actualizarRoles();
          if (vigente) redibujar();
        } catch {
          // se queda con lo que había
        }
      })();
      Servicios.avisarCambio();
      return () => {
        vigente = false;
      };
    }, []),
  );

  const mascotas = DuenoRepo.mascotas;
  const vetsActivos = DuenoRepo.autorizados.filter((v) => v.estado === "ACTIVO");

  // ---------- Modo veterinario ----------

  const revision = Sesion.perfil?.veterinarios ?? null;
  const motivo = revision?.motivo_revision && revision.motivo_revision.trim() !== "" ? `\n\nMotivo: ${revision.motivo_revision}` : "";
  const modo = (() => {
    // Su rol principal es veterinario: el cambio de modo está en el perfil de veterinario
    if (Sesion.perfil?.rol === "veterinario") return null;
    if (Sesion.rolesDisponibles.includes("VETERINARIO")) {
      return { texto: "Pasar al modo veterinario", alTocar: () => void ModoDeUso.cambiar("VETERINARIO") };
    }
    if (revision == null || revision.estado_revision === "rechazado") {
      return {
        texto: revision == null ? "Soy veterinario/a: pedir el alta" : "Alta rechazada: volver a presentarla",
        alTocar: () => {
          if (revision == null) pedirAltaVeterinario();
          else {
            Avisos.confirmar({
              titulo: "Alta rechazada",
              mensaje: `El administrador no aprobó tu solicitud.${motivo}\n\n¿Querés volver a presentarla con tus datos y tu carnet?`,
              textoAceptar: "Volver a presentarla",
              textoCancelar: "Ahora no",
              peligro: false,
              icono: "srvEstetoscopio",
              alAceptar: pedirAltaVeterinario,
            });
          }
        },
      };
    }
    if (revision.estado_revision === "pendiente_revision") {
      return {
        texto: "Alta como veterinario/a en revisión",
        alTocar: () =>
          Avisos.informar({
            titulo: "Alta en revisión",
            mensaje: "El administrador está verificando tu matrícula. Cuando la apruebe vas a poder ingresar también como veterinario, y te avisamos.",
            icono: "info",
          }),
      };
    }
    return {
      texto: "Rol de veterinario/a suspendido",
      alTocar: () => Avisos.informar({ titulo: "Rol suspendido", mensaje: `El administrador suspendió tu rol de veterinario.${motivo}`, icono: "info" }),
    };
  })();

  // ---------- Foto ----------

  const tocarFoto = () => {
    if (perfil.fotoUri == null && perfil.fotoPath == null) {
      Avisos.mostrar("Primero elegí una foto tocando el ícono del lápiz");
      return;
    }
    setHojaAjuste(true);
  };

  const elegirAjuste = (ajuste: AjusteFoto, aviso: string) => {
    setHojaAjuste(false);
    DuenoRepo.perfil.ajusteFoto = ajuste;
    DuenoRepo.guardarAjusteFoto();
    Avisos.mostrar(aviso);
    redibujar();
  };

  const guardarRecorte = (uri: string, x: number, y: number) => {
    // La imagen de la vista previa mide 400 y la del perfil 120: el desplazamiento se escala 0,3
    perfil.desplazamientoFotoX = x * 0.3;
    perfil.desplazamientoFotoY = y * 0.3;
    DuenoRepo.cambiarFotoPerfil(uri);
    Avisos.mostrar("Foto de perfil actualizada");
    setARecortar(null);
    redibujar();
  };

  // ---------- Contraseña ----------

  const abrirPassword = () => {
    setActual("");
    setNueva("");
    setConfirmar("");
    setHojaPassword(true);
  };

  const guardarPassword = async () => {
    if (guardando) return;
    const error =
      actual === "" ? "Ingresá tu contraseña actual"
      : nueva.length < 6 ? "La nueva contraseña debe tener al menos 6 caracteres"
      : nueva !== confirmar ? "Las contraseñas no coinciden"
      : nueva === actual ? "La nueva contraseña debe ser distinta a la actual"
      : null;
    if (error) {
      Avisos.mostrar(error);
      return;
    }
    setGuardando(true);
    try {
      await Servicios.fuente.cambiarPassword(DuenoRepo.perfil.email, actual, nueva);
      Avisos.mostrar("Contraseña actualizada");
      setHojaPassword(false);
    } catch (e) {
      const mensaje = Errores.mensaje(e);
      Avisos.mostrar(mensaje.startsWith("Correo o contraseña") ? "La contraseña actual es incorrecta" : mensaje);
    } finally {
      setGuardando(false);
    }
  };

  // ---------- Listas ----------

  const abrirMascotas = () => {
    if (mascotas.length === 0) {
      Avisos.confirmar({
        titulo: "Todavía no tenés mascotas",
        mensaje: "Podés agregar la primera desde la sección Mascotas.",
        textoAceptar: "Ir a Mascotas", textoCancelar: "Cerrar", peligro: false, icono: "perro",
        alAceptar: () => NavDueno.irAMascotas(),
      });
      return;
    }
    setHojaMascotas(true);
  };

  const abrirVets = () => {
    if (vetsActivos.length === 0) {
      Avisos.confirmar({
        titulo: "Sin veterinarios con acceso",
        mensaje: "Todavía ningún veterinario tiene acceso a tus mascotas. Podés autorizar profesionales desde la sección Veterinarios.",
        textoAceptar: "Ir a Veterinarios", textoCancelar: "Cerrar", peligro: false, icono: "medico",
        alAceptar: () => NavDueno.irAVeterinarios(),
      });
      return;
    }
    setHojaVets(true);
  };

  const escala = AJUSTE_A_ESCALA[perfil.ajusteFoto];

  return (
    <PantallaBase formulario titulo="Mi Perfil" alVolver={() => NavDueno.irAHome()}>
      <LinearGradient colors={["#02797A", "#17A58F"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={estilos.hero}>
        <Icono nombre="perro" tamano={150} color="#FFFFFF1F" estilo={estilos.marcaAgua} />
        <View style={{ alignItems: "center" }}>
          <View style={estilos.marcoFoto}>
            <Pressable accessibilityRole="button" accessibilityLabel="Ajustar posición de la foto" onPress={tocarFoto} style={[estilos.circuloFoto, cursorTocable]}>
              <View
                style={{ width: "100%", height: "100%", transform: [{ translateX: perfil.desplazamientoFotoX }, { translateY: perfil.desplazamientoFotoY }] }}
              >
                <ImagenRemota
                  fotoUri={perfil.fotoUri} fotoPath={perfil.fotoPath} ajuste={escala}
                  estilo={{ width: "100%", height: "100%", borderRadius: 0 }}
                  respaldo={<Icono nombre="persona" tamano={64} color={Colores.tealDark} />}
                />
              </View>
            </Pressable>
            <Pressable
              accessibilityRole="button" accessibilityLabel="Cambiar foto de perfil"
              onPress={() => {
                void (async () => {
                  const uri = await elegirImagen();
                  if (uri) setARecortar(uri);
                })();
              }}
              style={[estilos.botonFoto, cursorTocable]}
            >
              <Icono nombre="camara" tamano={18} color={Colores.primaryTeal} />
            </Pressable>
          </View>
          <Texto variante="titulo" color={Colores.white} centrado style={{ marginTop: 12 }}>{perfil.nombre}</Texto>
          <Texto variante="chico" tamano={12} color="#FFFFFFE6">Propietario</Texto>
          <View style={estilos.contadores}>
            <Contador valor={mascotas.length} etiqueta="Mascotas" alTocar={abrirMascotas} />
            <Contador valor={vetsActivos.length} etiqueta="Veterinarios" alTocar={abrirVets} />
          </View>
        </View>
      </LinearGradient>

      <Texto variante="titulo" tamano={17} style={{ marginTop: 22 }} accessibilityRole="header">Información de la cuenta</Texto>
      <Tarjeta relleno={16} estilo={{ marginTop: 10, paddingVertical: 4 }}>
        <Dato icono="correo" etiqueta="Correo electrónico" valor={perfil.email} />
        <Dato icono="telefono" etiqueta="Teléfono" valor={perfil.telefono} divisor />
        <Dato icono="ubicacion" etiqueta="Dirección" valor={perfil.direccion} divisor />
      </Tarjeta>

      <TarjetaPermiso estilo={{ marginTop: 16 }} />

      <Texto variante="titulo" tamano={17} style={{ marginTop: 22 }} accessibilityRole="header">Cuenta</Texto>
      <Tarjeta relleno={16} estilo={{ marginTop: 10, paddingVertical: 4 }}>
        <FilaCuenta icono="editar" texto="Editar datos personales" alTocar={() => NavDueno.irAEditarPerfil()} />
        {modo ? <FilaCuenta icono="veterinario" texto={modo.texto} alTocar={modo.alTocar} divisor /> : null}
        <FilaCuenta icono="candado" texto="Cambiar contraseña" alTocar={abrirPassword} divisor />
        <FilaCuenta icono="medico" texto="Veterinarios con acceso" alTocar={() => NavDueno.irAVeterinarios()} divisor />
        {/* Solo para quien trabaja en una veterinaria (o tiene una invitación): un dueño no se suma por su cuenta */}
        {ClinicasRepo.activas.length > 0 || ClinicasRepo.invitaciones.length > 0 ? (
          <FilaCuenta icono="sede" texto="Mis veterinarias" alTocar={() => setHojaRecepcion(true)} divisor />
        ) : null}
        {Sesion.rolesDisponibles.includes("RECEPCIONISTA") ? (
          <FilaCuenta icono="calendario" texto="Pasar al modo recepción" alTocar={() => void ModoDeUso.cambiar("RECEPCIONISTA")} divisor />
        ) : null}
      </Tarjeta>

      <Boton
        titulo="Cerrar sesión" variante="peligroContorno" icono="salir" alto={54} estilo={{ marginTop: 22, borderWidth: 1.5 }}
        onPress={() => NavDueno.cerrarSesion()}
      />
      <Pressable accessibilityRole="button" accessibilityLabel="Eliminar mi cuenta" onPress={() => BajaDeCuenta.confirmar()} style={[estilos.eliminar, cursorTocable]}>
        <Texto variante="cuerpo" tamano={14} centrado>Eliminar mi cuenta</Texto>
      </Pressable>

      <HojaLista
        visible={hojaMascotas} alCerrar={() => setHojaMascotas(false)} titulo="Mis mascotas"
        subtitulo={mascotas.length === 1 ? "Tenés 1 mascota registrada." : `Tenés ${mascotas.length} mascotas registradas.`}
        filas={mascotas.map((m) => ({
          titulo: m.nombre,
          subtitulo: `${m.tipoRazaTexto} · ${m.edadTexto() ?? "Edad sin especificar"}`,
          icono: ICONOS_TIPO[m.tipo] ?? "mascotas",
          fotoUri: m.fotoUri, fotoPath: m.fotoPath,
          alTocar: () => NavDueno.irADetalleMascota(m),
        }))}
      />
      <HojaLista
        visible={hojaVets} alCerrar={() => setHojaVets(false)} titulo="Veterinarios con acceso"
        subtitulo={vetsActivos.length === 1 ? "1 veterinario puede ver la ficha de tus mascotas." : `${vetsActivos.length} veterinarios pueden ver la ficha de tus mascotas.`}
        filas={vetsActivos.map((v) => ({
          titulo: v.nombre,
          subtitulo: `${v.especialidad}\n${v.mascotas.size > 0 ? `Acceso a: ${[...v.mascotas].join(", ")}` : "Acceso activo"}`,
          icono: "medico", fotoPath: v.fotoPath,
          alTocar: () => NavDueno.irAVeterinarios(),
        }))}
        textoPrincipal="Ir a Veterinarios" alPrincipal={() => NavDueno.irAVeterinarios()}
      />

      <HojaInferior visible={hojaAjuste} alCerrar={() => setHojaAjuste(false)}>
        <Texto variante="titulo" tamano={20} accessibilityRole="header">Ajustar posición de la foto</Texto>
        <View style={{ marginTop: 8 }}>
          {([
            ["LLENAR", "Llenar círculo (Center Crop)", "Ajustado: Llenar círculo"],
            ["COMPLETA", "Ajustar completa (Fit Center)", "Ajustado: Mostrar completa"],
            ["CENTRADA", "Centrar imagen", "Ajustado: Centrar imagen"],
          ] as const).map(([ajuste, texto, aviso]) => (
            <Pressable key={ajuste} accessibilityRole="button" accessibilityLabel={texto} onPress={() => elegirAjuste(ajuste, aviso)} style={[estilos.opcion, cursorTocable]}>
              <Texto variante="cuerpo">{texto}</Texto>
            </Pressable>
          ))}
        </View>
        <Boton titulo="Cancelar" variante="texto" estilo={{ marginTop: 8 }} onPress={() => setHojaAjuste(false)} />
      </HojaInferior>

      <HojaInferior
        visible={hojaPassword} alCerrar={() => setHojaPassword(false)}
        pie={
          <View style={{ flexDirection: "row" }}>
            <Boton titulo="Cancelar" variante="secundario" estilo={{ flex: 1, marginRight: 10 }} onPress={() => setHojaPassword(false)} />
            <Boton titulo="Guardar" estilo={{ flex: 1 }} cargando={guardando} onPress={() => void guardarPassword()} />
          </View>
        }
      >
        <Texto variante="titulo" tamano={20} accessibilityRole="header">Cambiar contraseña</Texto>
        <Campo estilo={{ marginTop: 12 }} placeholder="Contraseña actual" value={actual} onChangeText={setActual} contrasena returnKeyType="next" />
        <Campo estilo={{ marginTop: 8 }} placeholder="Nueva contraseña" value={nueva} onChangeText={setNueva} contrasena returnKeyType="next" />
        <Campo
          estilo={{ marginTop: 8 }} placeholder="Confirmar nueva contraseña" value={confirmar} onChangeText={setConfirmar} contrasena
          returnKeyType="go" onSubmitEditing={() => void guardarPassword()}
        />
      </HojaInferior>

      {hojaRecepcion ? <VeterinariasHoja alCerrar={() => setHojaRecepcion(false)} /> : null}

      <RecortarFotoDialogo uri={aRecortar} alCancelar={() => setARecortar(null)} alGuardar={guardarRecorte} />
    </PantallaBase>
  );
}

const estilos = StyleSheet.create({
  hero: { borderRadius: 22, paddingHorizontal: 18, paddingTop: 22, paddingBottom: 20, overflow: "hidden", marginTop: 8, ...sombra(2) },
  marcaAgua: { position: "absolute", right: -16, bottom: -22, transform: [{ rotate: "-10deg" }] },
  marcoFoto: { width: 108, height: 108 },
  circuloFoto: { width: 108, height: 108, borderRadius: 54, overflow: "hidden", backgroundColor: Colores.lightTeal, borderWidth: 3, borderColor: Colores.white },
  botonFoto: { position: "absolute", right: 0, bottom: 0, width: 36, height: 36, borderRadius: 18, backgroundColor: Colores.white, alignItems: "center", justifyContent: "center", ...sombra(2) },
  contadores: { flexDirection: "row", gap: 12, marginTop: 16, alignSelf: "stretch" },
  contador: { flex: 1, alignItems: "center", backgroundColor: "#FFFFFF33", borderRadius: 16, paddingVertical: 10 },
  filaDato: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  cajaIcono: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
  divisor: { height: 1, marginLeft: 50, backgroundColor: Colores.dividerLight },
  eliminar: { marginTop: 8, padding: 14 },
  opcion: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: Colores.dividerLight },
});
