import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Colores } from "./tema";
import { Icono } from "./Icono";
import { ImagenRemota } from "./ImagenRemota";
import { Texto } from "./Texto";

export interface AvatarProps {
  /** Con el nombre se arma la inicial que se ve cuando no hay foto; sin nombre se ve un ícono de persona. */
  nombre?: string | null;
  fotoPath?: string | null;
  fotoUri?: string | null;
  bucket?: string;
  /** Diámetro en dp; 44 por defecto. */
  tamano?: number;
  estilo?: StyleProp<ViewStyle>;
}

/** Foto redonda de una persona o, si no hay, su inicial (o el avatar por defecto). */
export function Avatar({ nombre, fotoPath, fotoUri, bucket, tamano = 44, estilo }: AvatarProps) {
  const inicial = nombre?.trim().charAt(0).toUpperCase();
  return (
    <ImagenRemota
      fotoPath={fotoPath}
      fotoUri={fotoUri}
      bucket={bucket}
      accessibilityLabel={nombre ? `Foto de ${nombre}` : "Foto de perfil"}
      estilo={[estilos.base, { width: tamano, height: tamano, borderRadius: tamano / 2 }, estilo]}
      respaldo={
        inicial ? (
          <Texto variante="titulo" tamano={Math.round(tamano * 0.42)} color={Colores.tealDark} negrita>{inicial}</Texto>
        ) : (
          <Icono nombre="persona" tamano={Math.round(tamano * 0.55)} color={Colores.tealDark} />
        )
      }
    />
  );
}

const estilos = StyleSheet.create({
  base: { backgroundColor: Colores.lightTeal },
});
