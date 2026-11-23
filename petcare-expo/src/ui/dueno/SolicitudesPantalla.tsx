/*
 * Migrado de SolicitudesPantalla (al final de ui/dueno/VeterinariosPantalla.kt) + pantalla_solicitudes.xml y
 * el `SolicitudesAdapter` (item_solicitud_vet.xml): las solicitudes de acceso que recibe el dueño.
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { DuenoRepo } from "../../data/repositorio/duenoRepo";
import type { SolicitudItem } from "../../data/repositorio/solicitudesRepo";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Chip } from "../common/Chip";
import { EstadoVacio } from "../common/EstadoVacio";
import { Icono } from "../common/Icono";
import { ImagenRemota } from "../common/ImagenRemota";
import { PantallaBase } from "../common/PantallaBase";
import { Tarjeta } from "../common/Tarjeta";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";
import { useDatos } from "../common/useDatos";
import { useSesionRequerida } from "../common/useSesionRequerida";
import { NavDueno } from "./navegacionDueno";

/** Una solicitud: foto, quién la pide, de qué mascota y los botones Rechazar/Aceptar (o el estado). */
export function SolicitudTarjeta({ item, alResolver }: { item: SolicitudItem; alResolver: (item: SolicitudItem, aceptar: boolean) => void }) {
  const pendiente = item.estado === "PENDIENTE";
  // Las que pidió el propio veterinario no tienen botones: solo muestran en qué estado están
  const conBotones = pendiente && !item.enviada;
  const aceptada = item.estado === "ACEPTADA";
  const textoEstado = pendiente
    ? "Esperando la respuesta del dueño"
    : aceptada && item.enviada ? "Te dieron acceso"
    : aceptada ? "Solicitud aceptada"
    : item.enviada ? "El dueño no te dio acceso"
    : "Solicitud rechazada";
  return (
    <Tarjeta estilo={{ marginBottom: 12 }} relleno={14}>
      <View style={estilos.fila}>
        <ImagenRemota
          fotoPath={item.fotoPath} estilo={estilos.foto} accessibilityLabel={`Foto de ${item.solicitante}`}
          respaldo={<Icono nombre="persona" tamano={30} color={Colores.tealDark} />}
        />
        <View style={{ flex: 1, marginLeft: 14, minWidth: 0 }}>
          <Texto variante="titulo" tamano={16} numberOfLines={1}>{item.solicitante}</Texto>
          <Texto variante="cuerpo" tamano={13.5} color={Colores.tealDark} numberOfLines={1}>{item.mascota}</Texto>
          <Texto variante="chico" tamano={12} style={{ marginTop: 2 }}>{item.hace}</Texto>
        </View>
      </View>
      {conBotones ? (
        <View style={[estilos.fila, { marginTop: 14, gap: 16 }]}>
          <Boton titulo="Rechazar" variante="secundario" alto={48} estilo={{ flex: 1, borderColor: Colores.dangerRed }} onPress={() => alResolver(item, false)} />
          <Boton titulo="Aceptar" alto={48} estilo={{ flex: 1 }} onPress={() => alResolver(item, true)} />
        </View>
      ) : (
        <Chip texto={textoEstado} tono={pendiente ? "neutro" : aceptada ? "ok" : "peligro"} estilo={{ marginTop: 12 }} />
      )}
    </Tarjeta>
  );
}

export default function SolicitudesPantalla() {
  useSesionRequerida();
  useDatos();
  const [, setTick] = useState(0);
  const solicitudes = DuenoRepo.solicitudes;
  const pendientes = solicitudes.filter((s) => s.estado === "PENDIENTE").length;

  const resolver = (item: SolicitudItem, aceptar: boolean) => {
    DuenoRepo.resolverSolicitud(item, aceptar);
    Avisos.mostrar(aceptar ? `${item.solicitante} fue autorizado/a` : "Solicitud rechazada");
    setTick((t) => t + 1);
  };

  return (
    <PantallaBase
      titulo="Solicitudes de acceso"
      subtitulo={pendientes === 0 ? "Sin solicitudes pendientes" : pendientes === 1 ? "1 pendiente" : `${pendientes} pendientes`}
      alVolver={() => NavDueno.irAHome()}
    >
      <View style={[estilos.fila, estilos.banner]}>
        <Icono nombre="info" tamano={22} color={Colores.primaryTeal} />
        <Texto variante="cuerpo" tamano={13.5} color={Colores.tealDark} style={{ flex: 1, marginLeft: 12 }}>
          Si agendás un turno, ese veterinario ya puede ver la ficha de tu mascota. Acá solo aparecen los que piden acceso sin tener un turno con vos.
        </Texto>
      </View>
      {solicitudes.length === 0 ? (
        <EstadoVacio
          icono="llave" titulo="No hay solicitudes"
          mensaje="Los veterinarios con turno tuyo ya ven la ficha de tu mascota sin pedir permiso" estilo={{ marginTop: 16 }}
        />
      ) : (
        <View style={{ marginTop: 14 }}>
          {solicitudes.map((s) => (
            <SolicitudTarjeta key={s.id} item={s} alResolver={resolver} />
          ))}
        </View>
      )}
    </PantallaBase>
  );
}

const estilos = StyleSheet.create({
  fila: { flexDirection: "row", alignItems: "center" },
  banner: { backgroundColor: "#E3F3F1", borderRadius: 16, padding: 14, marginTop: 6 },
  foto: { width: 60, height: 60, borderRadius: 18, backgroundColor: Colores.lightTeal },
});
