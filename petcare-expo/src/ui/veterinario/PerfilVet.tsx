/*
 * Migrado de ui/veterinario/PerfilVetSeccion.kt + seccion_vet_perfil.xml + item_sede_vet.xml: perfil profesional del
 * veterinario (foto, matrícula, contacto, lugares de atención, especialidades, animales que atiende, duración de los
 * turnos, recepción, preferencias, cambiar contraseña, modo dueño, cerrar sesión y eliminar la cuenta). Los formularios y hojas
 * están en DialogosPerfilVet.tsx y EditorSede.tsx.
 */
import { LinearGradient } from "expo-linear-gradient";
import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AgendaRepo } from "../../data/repositorio/agendaRepo";
import { PerfilVetRepo } from "../../data/repositorio/perfilVetRepo";
import { Servicios } from "../../data/servicios";
import { Sesion } from "../../data/sesion";
import type { SedeVet } from "../../model/modelos";
import { LocalDate } from "../../util/tiempo";
import { Avisos } from "../common/Avisos";
import { BajaDeCuenta } from "../common/BajaDeCuenta";
import { Icono, type NombreIcono } from "../common/Icono";
import { ModoDeUso } from "../common/ModoDeUso";
import { PantallaBase } from "../common/PantallaBase";
import { RecepcionHoja, resumenRecepcion } from "../common/RecepcionHoja";
import { Tarjeta } from "../common/Tarjeta";
import { Texto } from "../common/Texto";
import { Colores, sombra } from "../common/tema";
import { useDatos } from "../common/useDatos";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { FotoVet } from "../common/VetUi";
import {
  DialogoCambiarPassword, DialogoEditarPerfil, DialogoMultiple, HojaDuraciones, HojaTiposAnimales,
} from "./DialogosPerfilVet";
import { detalleSede, EditorSede } from "./EditorSede";
import { EstadoCascaron } from "./estadoCascaronVet";
import { NavVet } from "./navegacionVet";

const CLAVES = ["solicitudes", "turnos", "cancelaciones"];
const ETIQUETAS = ["Nuevas solicitudes de acceso", "Recordatorios de turnos", "Cancelaciones de turnos"];

type Dialogo =
  | { tipo: "ninguno" }
  | { tipo: "sede"; sede: SedeVet | null }
  | { tipo: "especialidades" } | { tipo: "tipos" } | { tipo: "duraciones" }
  | { tipo: "perfil" } | { tipo: "password" } | { tipo: "notificaciones" } | { tipo: "recepcion" };

function Seccion({ titulo }: { titulo: string }) {
  return <Texto variante="titulo" tamano={17} style={{ marginTop: 22, marginBottom: 10 }}>{titulo}</Texto>;
}

function Divisor() {
  return <View style={estilos.divisor} />;
}

function Fila({ icono, etiqueta, valor, onPress, chevron, color, fondoIcono, colorIcono, titulo }: {
  icono: NombreIcono; etiqueta?: string; valor?: string; onPress?: () => void; chevron?: boolean; color?: string;
  fondoIcono?: string; colorIcono?: string; titulo?: string;
}) {
  const foco = useFoco();
  const contenido: ReactNode = (
    <>
      <View style={[estilos.cajaIcono, fondoIcono ? { backgroundColor: fondoIcono } : null]}>
        <Icono nombre={icono} tamano={20} color={colorIcono ?? Colores.tealDark} />
      </View>
      <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
        {etiqueta ? <Texto variante="chico" tamano={12}>{etiqueta}</Texto> : null}
        <Texto variante="cuerpo" peso="medium" color={color ?? Colores.brandNavy}>{(valor ?? titulo) as string}</Texto>
      </View>
      {chevron ? <Icono nombre="chevronDerecha" tamano={20} color={Colores.textGray} /> : null}
    </>
  );
  if (!onPress) return <View style={estilos.fila}>{contenido}</View>;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={etiqueta ? `${etiqueta}: ${valor}` : valor ?? titulo} onPress={onPress}
      {...foco.props} style={[estilos.fila, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      {contenido}
    </Pressable>
  );
}

function Grupo({ children }: { children: ReactNode }) {
  return (
    <Tarjeta relleno={0}>
      <View style={{ paddingHorizontal: 12, paddingVertical: 2 }}>{children}</View>
    </Tarjeta>
  );
}

export function PerfilVet() {
  useDatos();
  const [dialogo, setDialogo] = useState<Dialogo>({ tipo: "ninguno" });
  const cerrar = () => setDialogo({ tipo: "ninguno" });
  /** `mostrarPerfil`: los datos están en el repositorio; se avisa para volver a dibujar. */
  const mostrarPerfil = () => Servicios.avisarCambio();
  const total = PerfilVetRepo.sedes.length;

  const elegirFoto = () =>
    EstadoCascaron.pedirFoto((uri) => {
      PerfilVetRepo.cambiarFoto(uri);
      mostrarPerfil();
      Avisos.mostrar("Foto de perfil actualizada correctamente");
    });

  const agregarSede = () => {
    if (total >= PerfilVetRepo.MAX_SEDES) Avisos.mostrar(`Podés cargar hasta ${PerfilVetRepo.MAX_SEDES} lugares de atención`);
    else setDialogo({ tipo: "sede", sede: null });
  };

  const guardarSede = (sede: SedeVet | null, nuevo: SedeVet) => {
    if (sede == null) PerfilVetRepo.agregarSede(nuevo);
    else PerfilVetRepo.guardarSede(nuevo);
    mostrarPerfil();
    Avisos.mostrar(sede == null ? "Lugar de atención agregado" : "Lugar de atención actualizado");
  };

  const borrarSede = (sede: SedeVet, cerrarHoja: () => void) => {
    const hoy = LocalDate.now();
    const conTurnos = AgendaRepo.eventos.some((e) => e.sedeId === sede.id && e.estado === "PENDIENTE" && !e.fecha.isBefore(hoy));
    if (conTurnos) {
      Avisos.mostrar("Ese lugar tiene turnos pendientes: cancelalos o pasalos a otro lugar antes de borrarlo");
      return;
    }
    Avisos.confirmar({
      titulo: "¿Eliminar este lugar?", mensaje: `Los dueños ya no van a poder sacar turnos en ${sede.nombre}.`,
      textoAceptar: "Eliminar", textoCancelar: "Cancelar", peligro: true, icono: "advertencia",
      alAceptar: () => {
        PerfilVetRepo.eliminarSede(sede.id);
        mostrarPerfil();
        cerrarHoja();
      },
    });
  };

  const configurarDuraciones = () => {
    if (PerfilVetRepo.serviciosOfrecidos().length === 0) Avisos.mostrar("Primero elegí tus especialidades y prácticas");
    else setDialogo({ tipo: "duraciones" });
  };

  return (
    <PantallaBase bordes={["top"]} estiloContenido={{ paddingTop: 20 }}>
      <Texto variante="titulo" accessibilityRole="header">Perfil profesional</Texto>

      <LinearGradient colors={["#02797A", "#17A58F"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={estilos.hero}>
        <View style={{ width: 104, height: 104 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Cambiar foto de perfil" onPress={elegirFoto} style={cursorTocable}>
            <FotoVet tamano={104} estilo={{ borderWidth: 3, borderColor: Colores.white }} />
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Cambiar foto de perfil" onPress={elegirFoto} style={[estilos.lapiz, cursorTocable]}>
            <Icono nombre="editar" tamano={18} color={Colores.tealDark} />
          </Pressable>
        </View>
        <Texto variante="titulo" tamano={22} color={Colores.white} style={{ marginTop: 12 }}>{PerfilVetRepo.nombre}</Texto>
        <View style={estilos.cristal}>
          <Texto variante="etiqueta" tamano={12} color={Colores.white}>{`Matrícula ${PerfilVetRepo.matricula}`}</Texto>
        </View>
      </LinearGradient>

      <Seccion titulo="Veterinaria y contacto" />
      <Grupo>
        <Fila icono="persona" etiqueta="DNI" valor={PerfilVetRepo.dni} />
        <Divisor />
        <Fila icono="telefono" etiqueta="Teléfono" valor={PerfilVetRepo.telefono} />
        <Divisor />
        <Fila icono="correo" etiqueta="Correo electrónico" valor={PerfilVetRepo.email} />
      </Grupo>

      <Seccion titulo="Disponibilidad y especialidades" />
      <Grupo>
        {/* Lugares de atención: cada uno con su dirección, sus días y sus horarios */}
        {PerfilVetRepo.sedes.map((sede, i) => (
          <View key={sede.id || String(i)}>
            <SedeFila sede={sede} principal={total > 1 && i === 0} alTocar={() => setDialogo({ tipo: "sede", sede })} />
            <Divisor />
          </View>
        ))}
        {total < PerfilVetRepo.MAX_SEDES ? (
          <>
            <Fila icono="mas" valor="Agregar otro lugar de atención" color={Colores.primaryTeal} onPress={agregarSede} />
            <Divisor />
          </>
        ) : null}
        <Fila icono="editar" etiqueta="Especialidades" valor={PerfilVetRepo.textoEspecialidades()} chevron onPress={() => setDialogo({ tipo: "especialidades" })} />
        <Divisor />
        <Fila icono="perro" etiqueta="Animales que atiendo" valor={PerfilVetRepo.textoTiposAnimales()} chevron onPress={() => setDialogo({ tipo: "tipos" })} />
        <Divisor />
        <Fila icono="reloj" etiqueta="Duración de los turnos" valor={PerfilVetRepo.textoDuraciones()} chevron onPress={configurarDuraciones} />
      </Grupo>

      <Seccion titulo="Recepción" />
      <Grupo>
        <Fila
          icono="personas" etiqueta="Personas que manejan tu agenda" valor={resumenRecepcion("veterinario")} chevron
          onPress={() => setDialogo({ tipo: "recepcion" })}
        />
      </Grupo>

      <Seccion titulo="Cuenta" />
      <Grupo>
        <Fila icono="editar" titulo="Editar perfil profesional" chevron fondoIcono={Colores.lightTeal} onPress={() => setDialogo({ tipo: "perfil" })} />
        {/* Todo veterinario puede cargar sus propias mascotas: el modo dueño está siempre disponible */}
        {Sesion.rolesDisponibles.includes("DUENO") ? (
          <>
            <Divisor />
            <Fila icono="perro" titulo="Pasar al modo dueño de mascotas" chevron onPress={() => void ModoDeUso.cambiar("DUENO")} />
          </>
        ) : null}
        {/* Un veterinario también puede trabajar en la recepción de otro */}
        {Sesion.rolesDisponibles.includes("RECEPCIONISTA") ? (
          <>
            <Divisor />
            <Fila icono="calendario" titulo="Pasar al modo recepción" chevron onPress={() => void ModoDeUso.cambiar("RECEPCIONISTA")} />
          </>
        ) : null}
        <Divisor />
        <Fila icono="llave" titulo="Cambiar contraseña" chevron onPress={() => setDialogo({ tipo: "password" })} />
        <Divisor />
        <Fila icono="notificacion" titulo="Notificaciones" chevron onPress={() => setDialogo({ tipo: "notificaciones" })} />
        <Divisor />
        <Fila icono="salir" titulo="Cerrar sesión" chevron color={Colores.dangerRed} fondoIcono={Colores.lightRed} colorIcono={Colores.dangerRed} onPress={NavVet.cerrarSesion} />
        <Divisor />
        <Pressable accessibilityRole="button" accessibilityLabel="Eliminar mi cuenta" onPress={BajaDeCuenta.confirmar} style={[{ padding: 14, alignItems: "center" }, cursorTocable]}>
          <Texto variante="cuerpo" tamano={14} color={Colores.textGray}>Eliminar mi cuenta</Texto>
        </Pressable>
      </Grupo>

      {dialogo.tipo === "sede" ? (
        <EditorSede
          sede={dialogo.sede} alCerrar={cerrar} alGuardar={(n) => guardarSede((dialogo as { sede: SedeVet | null }).sede, n)}
          alEliminar={dialogo.sede && total > 1 ? (cerrarHoja) => borrarSede((dialogo as { sede: SedeVet }).sede, cerrarHoja) : undefined}
        />
      ) : null}
      {dialogo.tipo === "especialidades" ? (
        <DialogoMultiple
          titulo="Especialidades y prácticas que realizás" opciones={PerfilVetRepo.todasLasEspecialidades}
          marcadas={PerfilVetRepo.especialidadesSeleccionadas} alCerrar={cerrar}
          alGuardar={(m) => {
            m.forEach((v, i) => { PerfilVetRepo.especialidadesSeleccionadas[i] = v; });
            PerfilVetRepo.guardarEspecialidades();
            mostrarPerfil();
            Avisos.mostrar("Especialidades actualizadas");
          }}
        />
      ) : null}
      {dialogo.tipo === "tipos" ? <HojaTiposAnimales alCerrar={cerrar} alGuardado={mostrarPerfil} /> : null}
      {dialogo.tipo === "duraciones" ? <HojaDuraciones servicios={PerfilVetRepo.serviciosOfrecidos()} alCerrar={cerrar} alGuardado={mostrarPerfil} /> : null}
      {dialogo.tipo === "perfil" ? <DialogoEditarPerfil alCerrar={cerrar} alGuardado={mostrarPerfil} /> : null}
      {dialogo.tipo === "password" ? <DialogoCambiarPassword alCerrar={cerrar} /> : null}
      {dialogo.tipo === "recepcion" ? <RecepcionHoja lado="veterinario" alCerrar={cerrar} /> : null}
      {dialogo.tipo === "notificaciones" ? (
        <DialogoMultiple
          titulo="Notificaciones" opciones={ETIQUETAS} marcadas={CLAVES.map((c) => PerfilVetRepo.preferencia(c))} alCerrar={cerrar}
          alGuardar={(m) => {
            CLAVES.forEach((c, i) => { PerfilVetRepo.preferencias[c] = m[i]; });
            PerfilVetRepo.guardarPreferencias();
            Avisos.mostrar("Preferencias guardadas");
          }}
        />
      ) : null}
    </PantallaBase>
  );
}

/** Una fila por lugar de atención, con su dirección, sus días y su horario (item_sede_vet.xml). */
function SedeFila({ sede, principal, alTocar }: { sede: SedeVet; principal: boolean; alTocar: () => void }) {
  const foco = useFoco();
  const nombre = principal ? `${sede.nombre} (principal)` : sede.nombre;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={nombre} onPress={alTocar} {...foco.props} style={[estilos.fila, cursorTocable, estiloFoco(foco.enfocado)]}>
      <View style={estilos.cajaIcono}>
        <Icono nombre="ubicacion" tamano={20} color={Colores.tealDark} />
      </View>
      <View style={{ flex: 1, marginLeft: 12, minWidth: 0 }}>
        <Texto variante="cuerpo" peso="medium">{nombre}</Texto>
        <Texto variante="chico" tamano={12}>{detalleSede(sede)}</Texto>
      </View>
      <Icono nombre="chevronDerecha" tamano={20} color={Colores.textGray} />
    </Pressable>
  );
}

export default PerfilVet;

const estilos = StyleSheet.create({
  hero: { marginTop: 16, borderRadius: 22, padding: 20, alignItems: "center", overflow: "hidden", ...sombra(2) },
  lapiz: { position: "absolute", right: 0, bottom: 0, width: 34, height: 34, borderRadius: 17, backgroundColor: Colores.white, alignItems: "center", justifyContent: "center", ...sombra(1) },
  cristal: { marginTop: 8, backgroundColor: "#FFFFFF33", borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4 },
  fila: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  cajaIcono: { width: 38, height: 38, borderRadius: 12, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
  divisor: { height: 1, marginLeft: 50, backgroundColor: Colores.dividerLight },
});
