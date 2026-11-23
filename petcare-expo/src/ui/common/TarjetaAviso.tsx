/*
 * Migrado de ui/common/TarjetaAviso.kt (+ layout/item_aviso.xml): una notificación en la lista del dueño o del
 * veterinario: ícono según el tipo, título, mensaje y hora.
 */
import { useRef, useState } from "react";
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import type { TipoNotificacion } from "../../model/modelos";
import { LocalDateTime } from "../../util/tiempo";
import { BotonIcono } from "./BotonIcono";
import { Icono, type NombreIcono } from "./Icono";
import { Colores } from "./tema";
import { Texto } from "./Texto";

/** Cómo se dibuja el círculo del ícono de cada tipo de aviso: fondo, color del ícono y el ícono. */
export interface EstiloAviso {
  fondo: string;
  color: string;
  icono: NombreIcono;
}

export function estilo(tipo: TipoNotificacion): EstiloAviso {
  switch (tipo) {
    case "CANCELACION": return { fondo: Colores.lightOrange, color: Colores.accentOrange, icono: "cancelar" };
    case "TURNO": return { fondo: Colores.lightPurple, color: Colores.accentPurple, icono: "calendario" };
    case "COMPLETADO": return { fondo: Colores.lightGreen, color: Colores.successGreen, icono: "checkCirculo" };
    case "ACCESO": return { fondo: Colores.lightTeal, color: Colores.successGreen, icono: "checkCirculo" };
    case "MASCOTA": return { fondo: Colores.lightTeal, color: Colores.primaryTeal, icono: "perro" };
    case "CUENTA": return { fondo: Colores.lightOrange, color: Colores.accentOrange, icono: "candado" };
  }
}

/** "Ahora mismo", "Hace 5 min", "Hace 2 h" o "Hace 3 días". */
export function tiempo(creada: LocalDateTime, ahora: LocalDateTime = LocalDateTime.now()): string {
  const minutos = Math.trunc((ahora.toEpochMillis() - creada.toEpochMillis()) / 60000);
  if (minutos < 1) return "Ahora mismo";
  if (minutos < 60) return `Hace ${minutos} min`;
  if (minutos < 24 * 60) return `Hace ${Math.trunc(minutos / 60)} h`;
  return `Hace ${Math.trunc(minutos / (24 * 60))} días`;
}

export interface TarjetaAvisoProps {
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  creada: LocalDateTime;
  /** Si no se leyó se resalta con un fondo suave y un punto. */
  sinLeer?: boolean;
  /** Se llama cuando se toca la cruz, después de la animación de salida; sin esto la cruz no se muestra. */
  alBorrar?: () => void;
  estilo?: StyleProp<ViewStyle>;
}

function TarjetaAvisoComponente({ tipo, titulo, mensaje, creada, sinLeer = false, alBorrar, estilo: estiloExterno }: TarjetaAvisoProps) {
  const e = estilo(tipo);
  const progreso = useRef(new Animated.Value(0)).current;
  const [saliendo, setSaliendo] = useState(false);

  const borrar = () => {
    if (saliendo) return;
    setSaliendo(true);
    Animated.timing(progreso, { toValue: 1, duration: 160, useNativeDriver: true }).start(() => alBorrar?.());
  };

  return (
    <Animated.View
      pointerEvents={saliendo ? "none" : "auto"}
      style={[
        estilos.tarjeta,
        sinLeer ? estilos.sinLeer : estilos.leida,
        {
          opacity: progreso.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          transform: [{ translateX: progreso.interpolate({ inputRange: [0, 1], outputRange: [0, 48] }) }],
        },
        estiloExterno,
      ]}
    >
      <View style={[estilos.circulo, { backgroundColor: e.fondo }]}>
        <Icono nombre={e.icono} tamano={22} color={e.color} />
      </View>
      <View style={estilos.texto}>
        <View style={estilos.filaTitulo}>
          <Texto variante="etiqueta" tamano={15} style={estilos.titulo}>{titulo}</Texto>
          {sinLeer ? <View accessible accessibilityLabel="Sin leer" style={estilos.punto} /> : null}
        </View>
        <Texto variante="subtitulo" tamano={14} color={Colores.textAviso} style={estilos.mensaje}>{mensaje}</Texto>
        <Texto variante="chico" tamano={12} color={Colores.textGray} style={estilos.hora}>{tiempo(creada)}</Texto>
      </View>
      {alBorrar ? (
        <BotonIcono icono="cancelar" fondo="ninguno" color={Colores.textGray} tamano={16} accessibilityLabel="Borrar la notificación" onPress={borrar} />
      ) : (
        <View style={estilos.sinCruz} />
      )}
    </Animated.View>
  );
}

/** Una notificación en la lista. `TarjetaAviso.estilo` y `TarjetaAviso.tiempo` son las funciones puras. */
export const TarjetaAviso = Object.assign(TarjetaAvisoComponente, { estilo, tiempo });

const estilos = StyleSheet.create({
  tarjeta: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10, paddingLeft: 14, paddingTop: 14, paddingBottom: 14, paddingRight: 4, borderRadius: 16, borderWidth: 1 },
  leida: { backgroundColor: Colores.white, borderColor: Colores.loginFieldStroke },
  sinLeer: { backgroundColor: Colores.lightTealSoft, borderColor: Colores.primaryTeal },
  circulo: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  texto: { flex: 1, marginLeft: 12 },
  filaTitulo: { flexDirection: "row", alignItems: "center" },
  titulo: { flex: 1 },
  punto: { width: 10, height: 10, borderRadius: 5, marginLeft: 8, backgroundColor: Colores.primaryTeal },
  mensaje: { marginTop: 2, lineHeight: 20 },
  hora: { marginTop: 6 },
  sinCruz: { width: 10 },
});
