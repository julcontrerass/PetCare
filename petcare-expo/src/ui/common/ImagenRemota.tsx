import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { Image, type ImageContentFit } from "expo-image";
import { Imagenes } from "../../data/imagenes";
import { Colores } from "./tema";

export interface ImagenRemotaProps {
  /** Uri local ya disponible (file://, content://, blob:, https://): tiene prioridad. */
  fotoUri?: string | null;
  /** Ruta del archivo en el bucket de Supabase. */
  fotoPath?: string | null;
  /** Bucket; `Imagenes.BUCKET_FOTOS` por defecto. */
  bucket?: string;
  /** Define el tamaño y la forma (width/height, borderRadius...). Se recorta (overflow hidden) a esa forma. */
  estilo?: StyleProp<ViewStyle>;
  /** Lo que se ve cuando no hay foto o no se pudo cargar (una inicial, un ícono). */
  respaldo?: ReactNode;
  /** "cover" por defecto. */
  ajuste?: ImageContentFit;
  accessibilityLabel?: string;
}

function uriInicial(fotoUri?: string | null, fotoPath?: string | null, bucket?: string): string | null {
  if (fotoUri) return fotoUri;
  if (fotoPath) return Imagenes.uriEnCache(bucket ?? Imagenes.BUCKET_FOTOS, fotoPath);
  return null;
}

/**
 * Foto de Supabase. Usa la uri local si hay, si no la caché (síncrona) y si no la baja; mientras tanto muestra un
 * fondo lightTeal del tamaño final (sin saltos). Si no hay foto o falla, muestra [respaldo].
 */
export function ImagenRemota({ fotoUri, fotoPath, bucket, estilo, respaldo, ajuste = "cover", accessibilityLabel }: ImagenRemotaProps) {
  const bucketFinal = bucket ?? Imagenes.BUCKET_FOTOS;
  const [uri, setUri] = useState<string | null>(() => uriInicial(fotoUri, fotoPath, bucketFinal));
  const [fallo, setFallo] = useState(false);
  const hayOrigen = !!fotoUri || !!fotoPath;

  useEffect(() => {
    let vigente = true;
    setFallo(false);
    const directa = uriInicial(fotoUri, fotoPath, bucketFinal);
    setUri(directa);
    if (!directa && fotoPath) {
      Imagenes.archivoLocal(bucketFinal, fotoPath).then(
        (u) => {
          if (vigente) setUri(u);
        },
        () => {
          if (vigente) setFallo(true);
        },
      );
    }
    return () => {
      vigente = false;
    };
  }, [fotoUri, fotoPath, bucketFinal]);

  const mostrarRespaldo = !hayOrigen || fallo;
  return (
    <View style={[estilos.marco, !mostrarRespaldo && !uri ? estilos.cargando : null, estilo]}>
      {mostrarRespaldo ? (
        respaldo
      ) : uri ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit={ajuste}
          transition={120}
          cachePolicy="memory-disk"
          recyclingKey={uri}
          accessibilityLabel={accessibilityLabel}
          onError={() => setFallo(true)}
        />
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  marco: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
  cargando: { backgroundColor: Colores.lightTeal },
});
