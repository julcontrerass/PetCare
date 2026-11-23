/*
 * Migrado de `recortarFoto` (PerfilPantalla.kt) + dialog_crop_photo.xml: deja arrastrar la imagen elegida dentro del
 * círculo antes de guardarla como foto de perfil. El marco mide 200 y la imagen 400 (como en el XML).
 */
import { useRef, useState } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import { Boton } from "../common/Boton";
import { DialogoCentral } from "../common/DialogoCentral";
import { ImagenRemota } from "../common/ImagenRemota";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";

export interface RecortarFotoDialogoProps {
  /** Uri de la imagen elegida; null cierra el diálogo. */
  uri: string | null;
  alCancelar: () => void;
  /** Desplazamiento (en unidades del marco de 400) con que quedó la imagen. */
  alGuardar: (uri: string, x: number, y: number) => void;
}

export function RecortarFotoDialogo({ uri, alCancelar, alGuardar }: RecortarFotoDialogoProps) {
  const [desplazamiento, setDesplazamiento] = useState({ x: 0, y: 0 });
  const base = useRef({ x: 0, y: 0 });
  const actual = useRef({ x: 0, y: 0 });

  const arrastrar = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        base.current = { ...actual.current };
      },
      onPanResponderMove: (_e, g) => {
        actual.current = { x: base.current.x + g.dx, y: base.current.y + g.dy };
        setDesplazamiento(actual.current);
      },
    }),
  ).current;

  const reiniciar = () => {
    actual.current = { x: 0, y: 0 };
    base.current = { x: 0, y: 0 };
    setDesplazamiento({ x: 0, y: 0 });
  };

  return (
    <DialogoCentral visible={uri != null} alCerrar={() => { reiniciar(); alCancelar(); }}>
      <Texto variante="titulo" tamano={18} centrado accessibilityRole="header">Ajustar encuadre</Texto>
      <View style={estilos.marco} {...arrastrar.panHandlers} accessibilityLabel="Arrastrá la imagen para posicionarla">
        {uri ? (
          <View style={[estilos.imagen, { transform: [{ translateX: desplazamiento.x }, { translateY: desplazamiento.y }] }]} pointerEvents="none">
            <ImagenRemota fotoUri={uri} estilo={{ width: 400, height: 400 }} />
          </View>
        ) : null}
      </View>
      <Texto variante="subtitulo" tamano={13} centrado style={{ marginTop: 12 }}>Arrastrá la imagen para posicionarla</Texto>
      <View style={estilos.botones}>
        <Boton titulo="Cancelar" variante="secundario" estilo={{ flex: 1, marginRight: 10 }} onPress={() => { reiniciar(); alCancelar(); }} />
        <Boton
          titulo="Guardar" estilo={{ flex: 1 }}
          onPress={() => {
            if (uri) alGuardar(uri, desplazamiento.x, desplazamiento.y);
            reiniciar();
          }}
        />
      </View>
    </DialogoCentral>
  );
}

const estilos = StyleSheet.create({
  marco: {
    width: 200, height: 200, borderRadius: 100, overflow: "hidden", alignSelf: "center", marginTop: 16,
    backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center",
  },
  imagen: { width: 400, height: 400, position: "absolute", left: -100, top: -100 },
  botones: { flexDirection: "row", marginTop: 16 },
});
