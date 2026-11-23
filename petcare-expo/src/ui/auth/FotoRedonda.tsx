/* Foto circular con el botón de lápiz abajo a la derecha (ivDuenoFoto + btnDuenoFoto, ivMascotaFoto + btnMascotaFoto). */
import { Pressable, StyleSheet, View } from "react-native";
import { Colores, sombra } from "../common/tema";
import { Icono, type NombreIcono } from "../common/Icono";
import { ImagenRemota } from "../common/ImagenRemota";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";

export interface FotoRedondaProps {
  tamano: number;
  /** Uri de la foto elegida (null mientras no hay). */
  uri: string | null;
  /** Ícono de la silueta sin foto (persona o perro). */
  icono: NombreIcono;
  descripcion: string;
  /** Lado del botón de lápiz (34 en el dueño y el veterinario, 30 en la mascota). */
  tamanoBoton?: number;
  bordeBlanco?: boolean;
  onPress: () => void;
}

export function FotoRedonda({ tamano, uri, icono, descripcion, tamanoBoton = 34, bordeBlanco = false, onPress }: FotoRedondaProps) {
  const foco = useFoco();
  const relleno = Math.round(tamano * 0.29);
  return (
    <View style={{ width: tamano, height: tamano, alignSelf: "center" }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={descripcion}
        onPress={onPress}
        {...foco.props}
        style={[{ width: tamano, height: tamano, borderRadius: tamano / 2 }, cursorTocable, estiloFoco(foco.enfocado)]}
      >
        <ImagenRemota
          fotoUri={uri}
          estilo={[
            { width: tamano, height: tamano, borderRadius: tamano / 2, backgroundColor: Colores.lightTeal },
            bordeBlanco ? { borderWidth: 3, borderColor: Colores.white } : null,
          ]}
          respaldo={<Icono nombre={icono} tamano={tamano - 2 * relleno} color={Colores.tealDark} />}
        />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cambiar foto de perfil"
        onPress={onPress}
        style={[
          estilos.boton,
          { width: tamanoBoton, height: tamanoBoton, borderRadius: tamanoBoton / 2 },
          cursorTocable,
        ]}
      >
        <Icono nombre="editar" tamano={Math.round(tamanoBoton / 2)} color={Colores.white} />
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  boton: {
    position: "absolute",
    right: 0,
    bottom: 0,
    backgroundColor: Colores.primaryTeal,
    alignItems: "center",
    justifyContent: "center",
    ...sombra(1),
  },
});
