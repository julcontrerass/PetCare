/*
 * Invitaciones de un veterinario para trabajar en su recepción, en el Inicio (como las de co-dueño): se aceptan o se
 * rechazan desde acá.
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { RecepcionRepo } from "../../data/repositorio/recepcionRepo";
import type { VinculoRecepcionDto } from "../../data/remoto/dtos";
import { Errores } from "../../util/errores";
import { Avatar } from "../common/Avatar";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Tarjeta } from "../common/Tarjeta";
import { Colores } from "../common/tema";
import { Texto } from "../common/Texto";

function Invitacion({ invitacion: inv }: { invitacion: VinculoRecepcionDto }) {
  const [respondiendo, setRespondiendo] = useState<"aceptar" | "rechazar" | null>(null);
  const responder = async (aceptar: boolean) => {
    setRespondiendo(aceptar ? "aceptar" : "rechazar");
    try {
      await RecepcionRepo.responder(inv, aceptar);
      Avisos.mostrar(aceptar ? `Ya estás en la recepción de ${inv.nombre}` : "Rechazaste la invitación", aceptar ? "exito" : "info");
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
      setRespondiendo(null);
    }
  };
  return (
    <Tarjeta estilo={estilos.tarjeta} accessibilityLabel={`Invitación de ${inv.nombre} para trabajar en su recepción`}>
      <View style={estilos.fila}>
        <Avatar nombre={inv.nombre} fotoPath={inv.foto_path ?? null} tamano={56} />
        <View style={estilos.textos}>
          <Texto variante="etiqueta" tamano={11} color={Colores.primaryTeal} style={estilos.etiqueta}>Recepción</Texto>
          <Texto tamano={15} negrita>{`${inv.nombre} te invitó a manejar su agenda`}</Texto>
          <Texto variante="chico" tamano={13} style={{ marginTop: 2 }}>
            Vas a poder sacar, mover y cancelar sus turnos y responder los pedidos de acceso. No vas a ver la historia clínica.
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

export function InvitacionesRecepcion() {
  const invitaciones = RecepcionRepo.invitacionesRecibidas;
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
  textos: { flex: 1, minWidth: 0, marginLeft: 12 },
  etiqueta: { textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  botones: { flexDirection: "row", gap: 10, marginTop: 12 },
});
