/*
 * Sala de espera del veterinario, en su inicio: los dueños que ya llegaron para un turno de hoy (los marca la
 * recepción, o el veterinario si no tiene), por orden de llegada y con cuánto hace que esperan. Tocar uno abre el
 * turno para atenderlo. Si no hay nadie esperando no se dibuja.
 */
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import type { EventoVet } from "../../data/repositorio/agendaRepo";
import { PacientesRepo } from "../../data/repositorio/pacientesRepo";
import { Fechas } from "../../util/fechas";
import { Avatar } from "../common/Avatar";
import { Icono } from "../common/Icono";
import { Tarjeta } from "../common/Tarjeta";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";

/** Cada cuánto se redibuja para que "hace X min" no quede viejo. */
const REFRESCO_MS = 60_000;

/** "Llegó hace 5 min" / "Llegó recién". */
export function textoEspera(llegadaAt: string | null): string {
  if (!llegadaAt) return "Llegó";
  const hace = Fechas.haceTexto(llegadaAt);
  return hace === "Ahora" ? "Llegó recién" : `Llegó ${hace.toLowerCase()}`;
}

export function SalaDeEspera({ esperando, alAbrir }: { esperando: EventoVet[]; alAbrir: (e: EventoVet) => void }) {
  const [, redibujar] = useState(0);
  useEffect(() => {
    if (esperando.length === 0) return undefined;
    const t = setInterval(() => redibujar((n) => n + 1), REFRESCO_MS);
    return () => clearInterval(t);
  }, [esperando.length]);

  if (esperando.length === 0) return null;
  return (
    <View>
      <View style={estilos.encabezado}>
        <Texto variante="titulo" tamano={18} style={{ flex: 1 }}>Sala de espera</Texto>
        <View style={estilos.contador}>
          <Texto variante="etiqueta" tamano={12} color={Colores.successGreen}>
            {esperando.length === 1 ? "1 esperando" : `${esperando.length} esperando`}
          </Texto>
        </View>
      </View>
      {esperando.map((e, i) => {
        const nombre = PacientesRepo.nombreDe(e.pacienteId);
        const espera = textoEspera(e.llegadaAt);
        return (
          <Tarjeta
            key={e.id} relleno={14} onPress={() => alAbrir(e)} estilo={[estilos.fila, i === 0 ? estilos.primero : null]}
            accessibilityLabel={`${nombre} en sala de espera, turno de las ${e.hora}, ${espera.toLowerCase()}`}
          >
            <View style={estilos.contenido}>
              <View style={[estilos.orden, i === 0 ? estilos.ordenPrimero : null]}>
                <Texto variante="etiqueta" tamano={15} color={i === 0 ? Colores.white : Colores.successGreen}>{String(i + 1)}</Texto>
              </View>
              <View style={estilos.textos}>
                <Texto variante="cuerpo" tamano={16} negrita numberOfLines={1}>{nombre}</Texto>
                <Texto variante="chico" tamano={13.5} numberOfLines={1}>{`${e.motivo} · turno ${e.hora} hs`}</Texto>
                <Texto variante="chico" tamano={12.5} color={Colores.successGreen} style={{ marginTop: 2 }}>{espera}</Texto>
              </View>
              <Avatar fotoPath={PacientesRepo.fotoDuenoDe(e.pacienteId)} tamano={36} estilo={{ marginHorizontal: 8 }} />
              <Icono nombre="chevronDerecha" tamano={22} color={Colores.textGray} />
            </View>
          </Tarjeta>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  encabezado: { flexDirection: "row", alignItems: "center", marginTop: 22 },
  contador: { backgroundColor: Colores.lightGreen, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  fila: { marginTop: 10 },
  primero: { borderColor: Colores.successGreen, borderWidth: 1.5 },
  contenido: { flexDirection: "row", alignItems: "center" },
  orden: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colores.lightGreen, alignItems: "center", justifyContent: "center", marginRight: 14 },
  ordenPrimero: { backgroundColor: Colores.successGreen },
  textos: { flex: 1, minWidth: 0 },
});
