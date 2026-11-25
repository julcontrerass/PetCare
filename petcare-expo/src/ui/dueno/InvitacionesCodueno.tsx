/* Invitaciones a ser co-dueño de una mascota, en el Inicio: se aceptan o se rechazan desde acá. */
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { DuenoRepo } from "../../data/repositorio/duenoRepo";
import type { InvitacionCoduenoDto } from "../../data/remoto/dtos";
import { Errores } from "../../util/errores";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Icono } from "../common/Icono";
import { ImagenRemota } from "../common/ImagenRemota";
import { Tarjeta } from "../common/Tarjeta";
import { Colores } from "../common/tema";
import { Texto } from "../common/Texto";

function Invitacion({ invitacion: inv }: { invitacion: InvitacionCoduenoDto }) {
  const [respondiendo, setRespondiendo] = useState<"aceptar" | "rechazar" | null>(null);
  const responder = async (aceptar: boolean) => {
    setRespondiendo(aceptar ? "aceptar" : "rechazar");
    try {
      await DuenoRepo.responderInvitacion(inv, aceptar);
      Avisos.mostrar(aceptar ? `${inv.mascota_nombre} ya está en tus mascotas` : "Rechazaste la invitación", aceptar ? "exito" : "info");
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
      setRespondiendo(null);
    }
  };
  return (
    <Tarjeta estilo={estilos.tarjeta} accessibilityLabel={`Invitación para compartir a ${inv.mascota_nombre}`}>
      <View style={estilos.fila}>
        <ImagenRemota
          fotoPath={inv.mascota_foto_path ?? null} estilo={estilos.foto}
          respaldo={<Icono nombre="perro" tamano={28} color={Colores.primaryTeal} />}
          accessibilityLabel={`Foto de ${inv.mascota_nombre}`}
        />
        <View style={estilos.textos}>
          <Texto variante="etiqueta" tamano={11} color={Colores.primaryTeal} style={estilos.etiqueta}>Mascota compartida</Texto>
          <Texto tamano={15} negrita>{`${inv.invitado_por_nombre ?? "Alguien"} te invitó a ser dueño/a de ${inv.mascota_nombre}`}</Texto>
          <Texto variante="chico" tamano={13} style={{ marginTop: 2 }}>
            Vas a ver su ficha, su historial y sus turnos sin tener que cargarla de nuevo.
          </Texto>
        </View>
      </View>
      <View style={estilos.botones}>
        <Boton
          titulo="Rechazar" variante="secundario" alto={44} estilo={{ flex: 1 }} deshabilitado={respondiendo != null}
          cargando={respondiendo === "rechazar"} onPress={() => void responder(false)}
        />
        <Boton
          titulo="Aceptar" alto={44} estilo={{ flex: 1 }} deshabilitado={respondiendo != null}
          cargando={respondiendo === "aceptar"} onPress={() => void responder(true)}
        />
      </View>
    </Tarjeta>
  );
}

export function InvitacionesCodueno() {
  const invitaciones = DuenoRepo.invitaciones;
  if (invitaciones.length === 0) return null;
  return (
    <View style={{ marginTop: 16 }}>
      {invitaciones.map((i) => <Invitacion key={i.id} invitacion={i} />)}
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { marginBottom: 10, borderWidth: 1.5, borderColor: Colores.primaryTeal },
  fila: { flexDirection: "row", alignItems: "center" },
  foto: { width: 56, height: 56, borderRadius: 14 },
  textos: { flex: 1, minWidth: 0, marginLeft: 12 },
  etiqueta: { textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  botones: { flexDirection: "row", gap: 10, marginTop: 12 },
});
