/*
 * Migrado de ui/veterinario/HomeVetAdapter.kt + item_home_vet.xml: la fila de "Consultas de hoy" del inicio.
 */
import { StyleSheet, View } from "react-native";
import { Avatar } from "../common/Avatar";
import { Icono } from "../common/Icono";
import { Tarjeta } from "../common/Tarjeta";
import { Texto } from "../common/Texto";
import type { Llegada } from "../../data/repositorio/agendaRepo";
import { Colores } from "../common/tema";

export type ItemType = "CONSULTA" | "SOLICITUD";

export interface HomeVetItem {
  title: string;
  subtitle: string;
  time: string;
  type: ItemType;
  timeAgo?: string | null;
  eventoId?: string | null;
  isEnHorario?: boolean;
  /** Foto de perfil del dueño del paciente (ruta en el bucket `fotos`). */
  fotoDueno?: string | null;
  /** Si ya llegó (sala de espera) o no vino. */
  llegada?: Llegada | null;
}

export function FilaHomeVet({ item, alTocar }: { item: HomeVetItem; alTocar: (item: HomeVetItem) => void }) {
  const enHorario = !!item.isEnHorario;
  // La marca de la llegada dice más que "En horario": si ya se marcó, se muestra esa
  const marca = item.llegada === "en_espera"
    ? { texto: "En espera", color: Colores.successGreen, fondo: Colores.lightGreen }
    : item.llegada === "no_vino"
      ? { texto: "No vino", color: Colores.dangerRed, fondo: Colores.lightRed }
      : enHorario ? { texto: "En horario", color: Colores.successGreen, fondo: Colores.lightGreen } : null;
  const consulta = item.type === "CONSULTA";
  return (
    <Tarjeta
      onPress={() => alTocar(item)}
      relleno={14}
      accessibilityLabel={`${item.title}, ${item.subtitle}, ${item.time}`}
      estilo={[estilos.fila, enHorario ? estilos.enHorario : null]}
    >
      <View style={estilos.contenido}>
        {consulta ? (
          <View style={estilos.hora}>
            <Texto variante="etiqueta" tamano={15} color={enHorario ? Colores.successGreen : Colores.tealDark}>{item.time}</Texto>
          </View>
        ) : null}
        <View style={estilos.textos}>
          <Texto variante="cuerpo" tamano={16} negrita color={enHorario ? Colores.successGreen : Colores.brandNavy} numberOfLines={1}>{item.title}</Texto>
          <Texto variante="chico" tamano={13.5} numberOfLines={1}>{item.subtitle}</Texto>
          {!consulta && item.timeAgo ? <Texto variante="chico" tamano={12}>{item.timeAgo}</Texto> : null}
        </View>
        {consulta ? <Avatar fotoPath={item.fotoDueno} tamano={36} estilo={estilos.dueno} /> : null}
        {marca ? (
          <View style={[estilos.insignia, { backgroundColor: marca.fondo }]}>
            <Texto variante="etiqueta" tamano={10.5} color={marca.color}>{marca.texto}</Texto>
          </View>
        ) : null}
        <Icono nombre="chevronDerecha" tamano={22} color={enHorario ? Colores.successGreen : Colores.textGray} />
      </View>
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  fila: { marginTop: 10, marginBottom: 2, paddingVertical: 0 },
  enHorario: { backgroundColor: Colores.lightGreen, borderColor: Colores.successGreen, borderWidth: 1.5, borderRadius: 12 },
  contenido: { flexDirection: "row", alignItems: "center", paddingVertical: 0 },
  hora: { width: 64, height: 44, borderRadius: 12, backgroundColor: Colores.lightTeal, alignItems: "center", justifyContent: "center", marginRight: 14 },
  textos: { flex: 1, minWidth: 0 },
  dueno: { marginHorizontal: 8 },
  insignia: { backgroundColor: Colores.lightGreen, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6 },
});
