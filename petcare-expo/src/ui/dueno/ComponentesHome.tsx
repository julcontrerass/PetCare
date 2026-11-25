/*
 * Piezas chicas que comparten las secciones del dueño: título de sección, fila de evento (item_home_evento.xml),
 * etiqueta de color (HomePetChip) y foto del veterinario de un turno (Avatares.deEvento).
 */
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { DuenoRepo } from "../../data/repositorio/duenoRepo";
import type { EventoMascota } from "../../model/modelos";
import { EstiloCategoria } from "../common/EstiloCategoria";
import { BotonIcono } from "../common/BotonIcono";
import { Icono, type NombreIcono } from "../common/Icono";
import { ImagenRemota } from "../common/ImagenRemota";
import { Colores, sombra } from "../common/tema";
import { Texto } from "../common/Texto";
import { cursorTocable, estiloFoco, useFoco } from "../common/Web";

/** Etiqueta chica (HomePetChip: 10.5sp bold, relleno 8x3) con fondo y color propios. */
export function EtiquetaColor({ texto, fondo, color, estilo }: { texto: string; fondo: string; color: string; estilo?: StyleProp<ViewStyle> }) {
  return (
    <View style={[estilos.etiqueta, { backgroundColor: fondo, borderRadius: 10 }, estilo]}>
      <Texto tamano={10.5} negrita color={color}>{texto}</Texto>
    </View>
  );
}

/** Foto del veterinario del turno; si no tiene veterinario asignado no se dibuja nada. */
export function FotoVetEvento({ veterinarioId, tamano = 32 }: { veterinarioId: string | null | undefined; tamano?: number }) {
  if (!veterinarioId) return null;
  const perfil = DuenoRepo.perfilDeVeterinario(veterinarioId);
  return (
    <ImagenRemota
      fotoPath={perfil?.foto_path ?? undefined}
      accessibilityLabel="Foto del veterinario"
      estilo={{ width: tamano, height: tamano, borderRadius: tamano / 2, backgroundColor: Colores.lightTeal, marginLeft: 8 }}
      respaldo={<Icono nombre="persona" tamano={Math.round(tamano * 0.55)} color={Colores.tealDark} />}
    />
  );
}

/** Encabezado de una sección: título 18 bold y "Ver todas" a la derecha. */
export function TituloSeccion({ titulo, accion, alAccion, estilo }: { titulo: string; accion?: string; alAccion?: () => void; estilo?: StyleProp<ViewStyle> }) {
  const foco = useFoco();
  return (
    <View style={[estilos.titulo, estilo]}>
      <Texto tamano={18} negrita style={estilos.tituloTexto} accessibilityRole="header">{titulo}</Texto>
      {accion && alAccion ? (
        <Pressable accessibilityRole="button" onPress={alAccion} hitSlop={8} {...foco.props} style={[cursorTocable, estiloFoco(foco.enfocado)]}>
          <Texto tamano={14} negrita color={Colores.primaryTeal}>{accion}</Texto>
        </Pressable>
      ) : null}
    </View>
  );
}

export interface FilaEventoProps {
  evento: EventoMascota;
  /** Título; la categoría del evento si no se da. */
  titulo?: string;
  subtitulo: string;
  chip?: { texto: string; fondo: string; color: string };
  chevron?: boolean;
  onPress?: () => void;
}

/** Tarjeta de un evento: ícono de la categoría, título, subtítulo, foto del veterinario, etiqueta y flecha. */
export function FilaEvento({ evento, titulo, subtitulo, chip, chevron, onPress }: FilaEventoProps) {
  const foco = useFoco();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${titulo ?? evento.categoria}. ${subtitulo}`}
      onPress={onPress}
      {...foco.props}
      style={[estilos.fila, cursorTocable, estiloFoco(foco.enfocado)]}
    >
      <View style={[estilos.icono, { backgroundColor: EstiloCategoria.fondo(evento.categoria) }]}>
        <Icono nombre={EstiloCategoria.icono(evento.categoria)} tamano={22} color={EstiloCategoria.colorIcono(evento.categoria)} />
      </View>
      <View style={estilos.textos}>
        <Texto tamano={14} negrita numberOfLines={1}>{titulo ?? evento.categoria}</Texto>
        <Texto variante="chico" tamano={12} numberOfLines={1}>{subtitulo}</Texto>
      </View>
      <FotoVetEvento veterinarioId={evento.veterinarioId} />
      {chip ? <EtiquetaColor texto={chip.texto} fondo={chip.fondo} color={chip.color} estilo={{ marginLeft: 8 }} /> : null}
      {chevron ? <Icono nombre="chevronDerecha" tamano={22} color={Colores.textGray} /> : null}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  etiqueta: { paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  titulo: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  tituloTexto: { flexShrink: 1, marginRight: 8 },
  fila: {
    flexDirection: "row", alignItems: "center", marginTop: 10, marginBottom: 2, paddingHorizontal: 14, paddingVertical: 12,
    backgroundColor: Colores.white, borderRadius: 18, ...sombra(1),
  },
  icono: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  textos: { flex: 1, minWidth: 0, marginLeft: 12 },
});

/** Ícono del kit para el tipo de animal (de `TiposMascota.icono`). */
export function iconoDeTipo(tipo: string | null | undefined): NombreIcono {
  switch (tipo) {
    case "Perro": return "perro";
    case "Gato": return "gato";
    case "Ave": return "ave";
    case "Reptil": return "reptil";
    case "Pez": return "pez";
    case "Roedor": return "roedor";
    case "Conejo": return "conejo";
    case "Caballo": return "caballo";
    case "Cerdo": return "cerdo";
    default: return "mascotas";
  }
}

/** Botón redondo teal con un ícono blanco (circular_teal: el "+" de los encabezados). */
export function BotonAgregar({ etiqueta, onPress }: { etiqueta: string; onPress: () => void }) {
  return (
    <BotonIcono
      icono="mas" accessibilityLabel={etiqueta} onPress={onPress} fondo="ninguno" color={Colores.white}
      estilo={{ backgroundColor: Colores.primaryTeal, ...sombra(2) }}
    />
  );
}
