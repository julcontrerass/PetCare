/* Migrado de HomeAdminActivity.mostrarCredencial: el AlertDialog con la foto del carnet. */
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { Avisos } from "../common/Avisos";
import { DialogoCentral } from "../common/DialogoCentral";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";

export interface DialogoCredencialProps {
  /** Nombre del veterinario; null mantiene el diálogo cerrado. */
  nombre: string | null;
  matricula: string;
  /** Imagen ya bajada (blob: o data:). */
  uri: string | null;
  alCerrar: () => void;
}

/** Muestra la foto del carnet o matrícula con "Matrícula declarada" y el botón "Cerrar". */
export function DialogoCredencial({ nombre, matricula, uri, alCerrar }: DialogoCredencialProps) {
  const [aspecto, setAspecto] = useState(1);
  const foco = useFoco();
  return (
    <DialogoCentral visible={nombre != null && uri != null} alCerrar={alCerrar} anchoMaximo={560}>
      <Texto variante="titulo" tamano={20}>{`Carnet de ${nombre ?? ""}`}</Texto>
      <Texto variante="subtitulo" tamano={14} style={estilos.mensaje}>{`Matrícula declarada: ${matricula}`}</Texto>
      <ScrollView style={estilos.scroll} showsVerticalScrollIndicator={false}>
        {uri ? (
          <Image
            source={{ uri }}
            contentFit="contain"
            accessibilityLabel={`Foto del carnet de ${nombre ?? ""}`}
            style={[estilos.imagen, { aspectRatio: aspecto }]}
            onLoad={(e) => {
              const { width, height } = e.source;
              if (width > 0 && height > 0) setAspecto(width / height);
            }}
            onError={() => {
              alCerrar();
              Avisos.error("La foto no se pudo abrir");
            }}
          />
        ) : null}
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar"
        onPress={alCerrar}
        {...foco.props}
        style={[estilos.cerrar, cursorTocable, estiloFoco(foco.enfocado)]}
      >
        <Texto variante="boton" tamano={14} color={Colores.primaryTeal}>Cerrar</Texto>
      </Pressable>
    </DialogoCentral>
  );
}

const estilos = StyleSheet.create({
  mensaje: { marginTop: 4, marginBottom: 12 },
  scroll: { flexShrink: 1, borderRadius: 12 },
  imagen: { width: "100%", borderRadius: 12, backgroundColor: Colores.lightGray },
  cerrar: { alignSelf: "flex-end", marginTop: 12, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
});
