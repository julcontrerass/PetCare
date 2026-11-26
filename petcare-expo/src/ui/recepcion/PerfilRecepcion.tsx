/*
 * Perfil en el modo recepción: los veterinarios para los que trabaja (y los pedidos o invitaciones pendientes), el
 * cambio a los otros modos de la cuenta y el cierre de sesión. Los datos personales se editan desde el modo dueño.
 */
import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Sesion } from "../../data/sesion";
import { Avatar } from "../common/Avatar";
import { Icono, type NombreIcono } from "../common/Icono";
import { ModoDeUso } from "../common/ModoDeUso";
import { PantallaBase } from "../common/PantallaBase";
import { VeterinariasHoja, resumenVeterinarias } from "../common/VeterinariasHoja";
import { Tarjeta } from "../common/Tarjeta";
import { Colores } from "../common/tema";
import { Texto } from "../common/Texto";
import { useDatos } from "../common/useDatos";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";
import { NavRecepcion } from "./navegacionRecepcion";

/** Una fila de la tarjeta (como `FilaCuenta` del perfil del dueño), con un dato chico debajo si hace falta. */
function Fila({ icono, texto, detalle, color, alTocar, divisor }: {
  icono: NombreIcono; texto: string; detalle?: string; color?: string; alTocar: () => void; divisor?: boolean;
}) {
  const foco = useFoco();
  return (
    <>
      {divisor ? <View style={estilos.divisor} /> : null}
      <Pressable
        accessibilityRole="button" accessibilityLabel={detalle ? `${texto}: ${detalle}` : texto} onPress={alTocar} {...foco.props}
        style={[estilos.fila, cursorTocable, estiloFoco(foco.enfocado)]}
      >
        <View style={estilos.cajaIcono}><Icono nombre={icono} tamano={20} color={color ?? Colores.primaryTeal} /></View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Texto variante="cuerpo" peso="medium" color={color}>{texto}</Texto>
          {detalle ? <Texto variante="chico" tamano={12.5}>{detalle}</Texto> : null}
        </View>
        <Icono nombre="chevronDerecha" tamano={22} color={Colores.textGray} />
      </Pressable>
    </>
  );
}

export function PerfilRecepcion() {
  useDatos();
  const [hoja, setHoja] = useState(false);
  const perfil = Sesion.perfil;
  const roles = Sesion.rolesDisponibles;

  return (
    <PantallaBase bordes={["top"]} estiloContenido={{ paddingTop: 20 }}>
      <Texto variante="titulo" accessibilityRole="header">Perfil</Texto>
      <View style={estilos.cabecera}>
        <Avatar nombre={perfil?.nombre} fotoPath={perfil?.foto_path ?? null} tamano={64} />
        <View style={{ flex: 1, marginLeft: 14, minWidth: 0 }}>
          <Texto variante="titulo" tamano={19} numberOfLines={1}>{perfil?.nombre ?? ""}</Texto>
          <Texto variante="chico" tamano={13} numberOfLines={1}>{perfil?.email ?? ""}</Texto>
        </View>
      </View>

      <Texto variante="titulo" tamano={17} style={estilos.seccion} accessibilityRole="header">Trabajo</Texto>
      <Tarjeta relleno={16} estilo={{ paddingVertical: 4 }}>
        <Fila icono="sede" texto="Mis veterinarias" detalle={resumenVeterinarias()} alTocar={() => setHoja(true)} />
      </Tarjeta>

      <Texto variante="titulo" tamano={17} style={estilos.seccion} accessibilityRole="header">Cuenta</Texto>
      <Tarjeta relleno={16} estilo={{ paddingVertical: 4 }}>
        {roles.includes("DUENO") ? (
          <Fila icono="perro" texto="Pasar al modo dueño de mascotas" detalle="Tus mascotas y tus datos personales" alTocar={() => void ModoDeUso.cambiar("DUENO")} />
        ) : null}
        {roles.includes("VETERINARIO") ? (
          <Fila icono="veterinario" texto="Pasar al modo veterinario" divisor alTocar={() => void ModoDeUso.cambiar("VETERINARIO")} />
        ) : null}
        <Fila icono="salir" texto="Cerrar sesión" color={Colores.dangerRed} divisor={roles.length > 1} alTocar={NavRecepcion.cerrarSesion} />
      </Tarjeta>

      {hoja ? <VeterinariasHoja alCerrar={() => setHoja(false)} /> : null}
    </PantallaBase>
  );
}

export default PerfilRecepcion;

const estilos = StyleSheet.create({
  cabecera: { flexDirection: "row", alignItems: "center", marginTop: 16 },
  seccion: { marginTop: 22, marginBottom: 10 },
  fila: { flexDirection: "row", alignItems: "center", paddingVertical: 14 },
  cajaIcono: { width: 40, height: 40, borderRadius: 12, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
  divisor: { height: 1, backgroundColor: Colores.dividerLight },
});
