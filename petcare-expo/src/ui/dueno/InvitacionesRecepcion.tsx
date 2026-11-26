/*
 * Invitaciones para sumarse al equipo de una veterinaria, en el Inicio (como las de co-dueño): se aceptan o se
 * rechazan desde acá.
 */
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { ClinicasRepo, NOMBRE_ROL } from "../../data/repositorio/clinicasRepo";
import type { ClinicaDto } from "../../data/remoto/dtos";
import { Errores } from "../../util/errores";
import { Avisos } from "../common/Avisos";
import { Boton } from "../common/Boton";
import { Icono } from "../common/Icono";
import { Tarjeta } from "../common/Tarjeta";
import { Colores } from "../common/tema";
import { Texto } from "../common/Texto";

function explicacion(c: ClinicaDto): string {
  if (c.roles.includes("veterinario")) return "Vas a atender en su agenda y ver la historia clínica de los pacientes que te den acceso.";
  if (c.roles.includes("titular") || c.roles.includes("administrador")) return "Vas a poder manejar su equipo, la agenda, las ventas y el stock.";
  return "Vas a poder sacar, mover y cancelar los turnos de sus veterinarios y registrar ventas. No vas a ver la historia clínica.";
}

function Invitacion({ clinica: c }: { clinica: ClinicaDto }) {
  const [respondiendo, setRespondiendo] = useState<"aceptar" | "rechazar" | null>(null);
  const responder = async (aceptar: boolean) => {
    setRespondiendo(aceptar ? "aceptar" : "rechazar");
    try {
      await ClinicasRepo.responder(c, aceptar);
      Avisos.mostrar(aceptar ? `Ya sos parte de ${c.nombre}` : "Rechazaste la invitación", aceptar ? "exito" : "info");
    } catch (e) {
      Avisos.error(Errores.mensaje(e));
      setRespondiendo(null);
    }
  };
  const roles = c.roles.map((r) => NOMBRE_ROL[r].toLowerCase()).join(" y ");
  return (
    <Tarjeta estilo={estilos.tarjeta} accessibilityLabel={`Invitación para sumarte a ${c.nombre}`}>
      <View style={estilos.fila}>
        <View style={estilos.icono}><Icono nombre="sede" tamano={26} color={Colores.primaryTeal} /></View>
        <View style={estilos.textos}>
          <Texto variante="etiqueta" tamano={11} color={Colores.primaryTeal} style={estilos.etiqueta}>Veterinaria</Texto>
          <Texto tamano={15} negrita>{`${c.invitado_por_nombre ?? "Te"} te invitó a ${c.nombre} como ${roles}`}</Texto>
          <Texto variante="chico" tamano={13} style={{ marginTop: 2 }}>{explicacion(c)}</Texto>
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
  const invitaciones = ClinicasRepo.invitaciones;
  if (invitaciones.length === 0) return null;
  return (
    <View style={{ marginTop: 16 }}>
      {invitaciones.map((c) => <Invitacion key={c.miembro_id} clinica={c} />)}
    </View>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { marginBottom: 10, borderWidth: 1.5, borderColor: Colores.primaryTeal },
  fila: { flexDirection: "row", alignItems: "center" },
  icono: { width: 56, height: 56, borderRadius: 16, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center" },
  textos: { flex: 1, minWidth: 0, marginLeft: 12 },
  etiqueta: { textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  botones: { flexDirection: "row", gap: 10, marginTop: 12 },
});
