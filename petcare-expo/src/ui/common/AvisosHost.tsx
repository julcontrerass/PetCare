import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { Avisos, type BannerAviso, type CartelAviso, type TipoAviso } from "./Avisos";
import { Boton } from "./Boton";
import { DialogoCentral } from "./DialogoCentral";
import { Icono, type NombreIcono } from "./Icono";
import { useMargenes } from "./Margenes";
import { Colores, sombra } from "./tema";
import { Texto } from "./Texto";
import { ANCHO_COLUMNA, cursorTocable } from "./Web";

const ASPECTO: Record<TipoAviso, { fondo: string; color: string; icono: NombreIcono }> = {
  exito: { fondo: Colores.lightGreen, color: Colores.successGreen, icono: "checkCirculo" },
  aviso: { fondo: Colores.lightOrange, color: Colores.accentOrangeDark, icono: "advertencia" },
  info: { fondo: Colores.lightTeal, color: Colores.primaryTeal, icono: "checkCirculo" },
};

function Banner({ banner }: { banner: BannerAviso | null }) {
  const margenes = useMargenes();
  const [mostrado, setMostrado] = useState<BannerAviso | null>(banner);
  const progreso = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (banner) {
      setMostrado(banner);
      progreso.setValue(0);
      Animated.timing(progreso, { toValue: 1, duration: 220, useNativeDriver: true }).start();
    } else {
      Animated.timing(progreso, { toValue: 0, duration: 160, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setMostrado(null);
      });
    }
  }, [banner, progreso]);

  if (!mostrado) return null;
  const a = ASPECTO[mostrado.tipo];
  return (
    <View pointerEvents="box-none" style={[estilos.capa, { top: margenes.top + 8 }]}>
      <Animated.View
        style={[estilos.animado, { opacity: progreso, transform: [{ translateY: progreso.interpolate({ inputRange: [0, 1], outputRange: [-48, 0] }) }] }]}
      >
        <Pressable
          accessibilityRole="alert"
          accessibilityLabel={mostrado.mensaje}
          accessibilityLiveRegion="polite"
          onPress={() => Avisos.retirarBanner()}
          style={[estilos.banner, cursorTocable]}
        >
          <View style={[estilos.icono, { backgroundColor: a.fondo }]}>
            <Icono nombre={a.icono} tamano={20} color={a.color} />
          </View>
          <Texto variante="cuerpo" tamano={14.5} numberOfLines={3} style={estilos.textoBanner}>{mostrado.mensaje}</Texto>
        </Pressable>
      </Animated.View>
    </View>
  );
}

function Cartel({ cartel }: { cartel: CartelAviso }) {
  const color = cartel.peligro ? Colores.dangerRed : Colores.primaryTeal;
  return (
    <DialogoCentral
      visible
      cancelable={cartel.cancelable}
      alCerrar={() => Avisos.cerrarCartel(cartel.id, false)}
      relleno={0}
      estilo={estilos.cartel}
    >
      <View style={[estilos.iconoCartel, { backgroundColor: cartel.peligro ? Colores.lightRed : Colores.lightTeal }]}>
        <Icono nombre={cartel.icono} tamano={32} color={color} />
      </View>
      <Texto variante="titulo" tamano={20} centrado accessibilityRole="header" style={estilos.tituloCartel}>{cartel.titulo}</Texto>
      <Texto variante="subtitulo" centrado style={estilos.mensajeCartel}>{cartel.mensaje}</Texto>
      <View style={estilos.botones}>
        {cartel.textoCancelar ? (
          <Boton
            titulo={cartel.textoCancelar} variante="secundario" alto={50}
            onPress={() => Avisos.cerrarCartel(cartel.id, false)} estilo={estilos.botonCancelar}
          />
        ) : null}
        <Boton
          titulo={cartel.textoAceptar} variante={cartel.peligro ? "peligro" : "primario"} alto={50}
          onPress={() => Avisos.cerrarCartel(cartel.id, true)} estilo={estilos.botonAceptar}
        />
      </View>
    </DialogoCentral>
  );
}

/** Se monta una vez en la raíz de la app: dibuja el aviso breve (arriba) y el cartel que toque (modal). */
export function AvisosHost() {
  const estado = useSyncExternalStore(Avisos.suscribir, () => Avisos.estado, () => Avisos.estado);
  const cartel = estado.carteles[0];
  return (
    <>
      <Banner banner={estado.banner} />
      {cartel ? <Cartel key={cartel.id} cartel={cartel} /> : null}
    </>
  );
}

const estilos = StyleSheet.create({
  capa: { position: "absolute", left: 16, right: 16, alignItems: "center", zIndex: 1000 },
  animado: { width: "100%", maxWidth: ANCHO_COLUMNA - 32 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    backgroundColor: Colores.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colores.loginFieldStroke,
    ...sombra(4),
  },
  icono: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  textoBanner: { flex: 1, marginLeft: 12 },
  cartel: { alignItems: "center", paddingHorizontal: 24, paddingTop: 28, paddingBottom: 22 },
  iconoCartel: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center" },
  tituloCartel: { marginTop: 18 },
  mensajeCartel: { marginTop: 8 },
  botones: { flexDirection: "row", alignSelf: "stretch", marginTop: 24 },
  botonCancelar: { flex: 1, marginRight: 6 },
  botonAceptar: { flex: 1 },
});
