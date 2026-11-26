/*
 * Logo de una veterinaria: cuadrado redondeado (los logos rara vez son redondos) con la imagen que cargó la
 * veterinaria, o el ícono de la veterinaria si no tiene. Con [alTocar] se puede cambiar (muestra un lápiz).
 * MarcaVeterinaria: el logo con el nombre, arriba de la vista de la veterinaria.
 */
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { ClinicasRepo } from "../../data/repositorio/clinicasRepo";
import { Icono } from "./Icono";
import { ImagenRemota } from "./ImagenRemota";
import { Colores, sombra } from "./tema";
import { Texto } from "./Texto";
import { useDatos } from "./useDatos";
import { cursorTocable, estiloFoco, useFoco } from "./Web";

export interface LogoVeterinariaProps {
  /** Ruta en el bucket de fotos. */
  logoPath?: string | null;
  /** Imagen recién elegida en el teléfono (tiene prioridad). */
  uri?: string | null;
  tamano: number;
  nombre?: string;
  alTocar?: () => void;
  estilo?: StyleProp<ViewStyle>;
}

export function LogoVeterinaria({ logoPath, uri, tamano, nombre, alTocar, estilo }: LogoVeterinariaProps) {
  const foco = useFoco();
  const radio = Math.round(tamano * 0.26);
  const imagen = (
    <ImagenRemota
      fotoUri={uri ?? null} fotoPath={logoPath ?? null} ajuste="contain"
      accessibilityLabel={nombre ? `Logo de ${nombre}` : "Logo de la veterinaria"}
      estilo={[estilos.caja, { width: tamano, height: tamano, borderRadius: radio }]}
      respaldo={<Icono nombre="sede" tamano={Math.round(tamano * 0.5)} color={Colores.primaryTeal} />}
    />
  );
  if (!alTocar) return <View style={estilo}>{imagen}</View>;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={uri || logoPath ? "Cambiar el logo" : "Cargar el logo"} onPress={alTocar}
      {...foco.props} style={[{ width: tamano, height: tamano }, cursorTocable, estiloFoco(foco.enfocado), estilo]}
    >
      {imagen}
      <View style={estilos.lapiz}><Icono nombre={uri || logoPath ? "editar" : "camaraMas"} tamano={15} color={Colores.white} /></View>
    </Pressable>
  );
}

/** Logo y nombre de la veterinaria que se está usando (la principal de la cuenta); nada si no hay ninguna. */
export function MarcaVeterinaria({ compacta = false }: { compacta?: boolean }) {
  useDatos();
  const c = ClinicasRepo.principal;
  if (!c) return null;
  return (
    <View style={[estilos.marca, compacta ? estilos.marcaCompacta : null]} accessibilityRole="header">
      <LogoVeterinaria logoPath={c.logo_path} nombre={c.nombre} tamano={compacta ? 44 : 64} />
      <View style={estilos.marcaTextos}>
        <Texto variante="titulo" tamano={compacta ? 16 : 17} numberOfLines={2}>{c.nombre}</Texto>
        <Texto variante="chico" tamano={11.5} numberOfLines={1}>con PetCare</Texto>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  caja: { backgroundColor: Colores.white, borderWidth: 1, borderColor: Colores.dividerLight, alignItems: "center", justifyContent: "center" },
  lapiz: {
    position: "absolute", right: -4, bottom: -4, width: 28, height: 28, borderRadius: 14, backgroundColor: Colores.primaryTeal,
    alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: Colores.white, ...sombra(1),
  },
  marca: { flexDirection: "row", alignItems: "center", gap: 12 },
  marcaCompacta: { marginBottom: 12 },
  marcaTextos: { flex: 1, minWidth: 0 },
});
