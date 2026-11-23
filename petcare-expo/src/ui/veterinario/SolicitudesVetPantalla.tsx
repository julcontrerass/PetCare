/*
 * Migrado de ui/veterinario/SolicitudesVetActivity.kt + SolicitudesAdapter (activity_solicitudes_vet.xml,
 * item_solicitud_vet.xml). Solicitudes de acceso: las que el veterinario le hizo a un dueño y las que un dueño le
 * compartió. Ruta: `/vet/solicitudes`.
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { SolicitudesRepo, type EstadoSolicitud, type SolicitudItem } from "../../data/repositorio/solicitudesRepo";
import { Avatar } from "../common/Avatar";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Chip, type TonoChip } from "../common/Chip";
import { EstadoVacio } from "../common/EstadoVacio";
import { PantallaBase } from "../common/PantallaBase";
import { Tarjeta } from "../common/Tarjeta";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";
import { useDatos } from "../common/useDatos";
import { useSesionRequerida } from "../common/useSesionRequerida";
import { cerrarPantalla } from "./estadoVet";

/** Texto y tono del estado de una solicitud que no tiene botones. */
export function estadoDeSolicitud(item: SolicitudItem): { texto: string; tono: TonoChip } {
  const aceptada = item.estado === "ACEPTADA";
  if (item.estado === "PENDIENTE") return { texto: "Esperando la respuesta del dueño", tono: "neutro" };
  const texto = aceptada && item.enviada ? "Te dieron acceso" : aceptada ? "Solicitud aceptada" : item.enviada ? "El dueño no te dio acceso" : "Solicitud rechazada";
  return { texto, tono: aceptada ? "ok" : "peligro" };
}

export function textoPendientes(n: number): string {
  return n === 1 ? "1 pendiente" : `${n} pendientes`;
}

function FilaSolicitud({ item, alResolver }: { item: SolicitudItem; alResolver: (item: SolicitudItem, estado: EstadoSolicitud) => void }) {
  // Las que pidió el propio veterinario no tienen botones: solo muestran en qué estado están
  const conBotones = item.estado === "PENDIENTE" && !item.enviada;
  const estado = estadoDeSolicitud(item);
  return (
    <Tarjeta relleno={14} estilo={{ marginTop: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Avatar nombre={item.solicitante} fotoPath={item.fotoPath} tamano={60} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Texto variante="titulo" tamano={16}>{item.solicitante}</Texto>
          <Texto variante="cuerpo" tamano={13.5} color={Colores.tealDark}>{item.mascota}</Texto>
          <Texto variante="chico" tamano={12} style={{ marginTop: 2 }}>{item.hace}</Texto>
        </View>
      </View>
      {conBotones ? (
        <View style={estilos.acciones}>
          <Boton titulo="Rechazar" variante="peligro" alto={48} estilo={{ flex: 1 }} onPress={() => alResolver(item, "RECHAZADA")} />
          <Boton titulo="Aceptar" alto={48} estilo={{ flex: 1, marginLeft: 8 }} onPress={() => alResolver(item, "ACEPTADA")} />
        </View>
      ) : (
        <Chip texto={estado.texto} tono={estado.tono} estilo={{ marginTop: 12, alignSelf: "flex-start" }} />
      )}
    </Tarjeta>
  );
}

export default function SolicitudesVetPantalla() {
  useSesionRequerida();
  useDatos();
  const [, redibujar] = useState(0);
  const lista = SolicitudesRepo.paraVeterinario;
  const pendientes = lista.filter((s) => s.estado === "PENDIENTE").length;

  return (
    <PantallaBase titulo="Solicitudes de acceso" subtitulo={textoPendientes(pendientes)} alVolver={cerrarPantalla}>
      {lista.length === 0 ? (
        <EstadoVacio
          icono="persona" titulo="Sin solicitudes" estilo={{ marginTop: 16 }}
          mensaje="Cuando le pidas acceso a un dueño, o un dueño te comparta una mascota, aparece acá"
        />
      ) : (
        lista.map((item) => (
          <FilaSolicitud
            key={item.id} item={item}
            alResolver={(it, estado) => {
              const aceptada = estado === "ACEPTADA";
              SolicitudesRepo.resolver(it, aceptada);
              Avisos.mostrar(aceptada ? "La mascota se sumó a tus pacientes" : "Solicitud rechazada");
              redibujar((n) => n + 1);
            }}
          />
        ))
      )}
    </PantallaBase>
  );
}

const estilos = StyleSheet.create({
  acciones: { flexDirection: "row", marginTop: 14 },
});
