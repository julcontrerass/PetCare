/*
 * Franja arriba de la agenda con el próximo bloqueo (o "Bloquear horario" si no hay); tocarla abre los bloqueos.
 */
import { StyleSheet, View } from "react-native";
import { textoBloqueo, type Bloqueo } from "../../model/bloqueos";
import { Icono } from "./Icono";
import { Tarjeta } from "./Tarjeta";
import { Texto } from "./Texto";
import { Colores } from "./tema";

export function AvisoBloqueo({ bloqueos, alTocar }: { bloqueos: Bloqueo[]; alTocar: () => void }) {
  const proximo = bloqueos[0];
  const mas = bloqueos.length - 1;
  return (
    <Tarjeta
      relleno={12} onPress={alTocar} estilo={estilos.tarjeta}
      accessibilityLabel={proximo ? `Agenda bloqueada: ${proximo.motivo}, ${textoBloqueo(proximo)}` : "Bloquear horario"}
    >
      <View style={estilos.fila}>
        <Icono nombre="candado" tamano={20} color={proximo ? Colores.dangerRed : Colores.primaryTeal} />
        <View style={{ flex: 1, minWidth: 0, marginLeft: 10 }}>
          {proximo ? (
            <>
              <Texto tamano={14} negrita numberOfLines={1}>{`Bloqueado: ${proximo.motivo}`}</Texto>
              <Texto variante="chico" tamano={12.5} numberOfLines={1}>
                {textoBloqueo(proximo) + (mas > 0 ? ` · y ${mas} ${mas === 1 ? "bloqueo más" : "bloqueos más"}` : "")}
              </Texto>
            </>
          ) : (
            <Texto tamano={14} negrita color={Colores.primaryTeal}>Bloquear horario (cirugía, viaje, feriado...)</Texto>
          )}
        </View>
        <Icono nombre="chevronDerecha" tamano={20} color={Colores.textGray} />
      </View>
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { marginTop: 8, marginBottom: 4 },
  fila: { flexDirection: "row", alignItems: "center" },
});
