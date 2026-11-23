/*
 * Migrado de ui/veterinario/PacientesAdapter.kt + item_paciente.xml: la fila de un paciente en la lista.
 */
import { StyleSheet, View } from "react-native";
import { AgendaRepo } from "../../data/repositorio/agendaRepo";
import { razaYSexo, estaActiva, type Paciente } from "../../data/repositorio/pacientesRepo";
import { EstadosMascota } from "../../model/modelos";
import { Fechas } from "../../util/fechas";
import { Avatar } from "../common/Avatar";
import { Icono, type NombreIcono } from "../common/Icono";
import { ImagenRemota } from "../common/ImagenRemota";
import { Tarjeta } from "../common/Tarjeta";
import { Texto } from "../common/Texto";
import { Colores } from "../common/tema";
import { NavVet } from "./navegacionVet";

const ICONO_ESPECIE: Record<string, NombreIcono> = {
  Perro: "perro", Gato: "gato", Ave: "ave", Reptil: "reptil", Pez: "pez", Roedor: "roedor",
};

export function FilaPaciente({ paciente }: { paciente: Paciente }) {
  const proximo = AgendaRepo.proximoEvento(paciente.id);
  const etiquetaEstado = (EstadosMascota as Record<string, { etiqueta: string }>)[paciente.estado]?.etiqueta ?? "";
  return (
    <Tarjeta onPress={() => NavVet.detallePaciente(paciente.id)} relleno={14} estilo={estilos.tarjeta} accessibilityLabel={`${paciente.nombre}, ${paciente.propietario}`}>
      <View style={estilos.fila}>
        <ImagenRemota
          fotoPath={paciente.fotoPath}
          estilo={{ width: 68, height: 68, borderRadius: 18, backgroundColor: Colores.lightTeal }}
          respaldo={<Icono nombre={ICONO_ESPECIE[paciente.especie] ?? "mascotas"} tamano={32} color={Colores.primaryTeal} />}
        />
        <View style={{ flex: 1, minWidth: 0, marginLeft: 14 }}>
          <Texto variante="cuerpo" tamano={17} negrita numberOfLines={1}>{paciente.nombre}</Texto>
          <Texto variante="chico" tamano={13.5} numberOfLines={1}>{razaYSexo(paciente) + (estaActiva(paciente) ? "" : ` · ${etiquetaEstado}`)}</Texto>
          <View style={estilos.propietario}>
            <Icono nombre="persona" tamano={18} color={Colores.tealDark} />
            <Texto variante="cuerpo" tamano={13} color={Colores.tealDark} numberOfLines={1} style={{ marginLeft: 6, flex: 1 }}>{paciente.propietario}</Texto>
          </View>
          <View style={estilos.chip}>
            <Texto variante="etiqueta" tamano={10.5} color={Colores.tealDark}>
              {proximo ? `Próximo turno · ${Fechas.relativa(proximo.fecha)} ${proximo.hora}` : "Sin turnos próximos"}
            </Texto>
          </View>
        </View>
        <Avatar fotoPath={paciente.fotoDueno} tamano={36} estilo={{ marginLeft: 8, marginRight: 6 }} />
        <Icono nombre="chevronDerecha" tamano={22} color={Colores.textGray} />
      </View>
    </Tarjeta>
  );
}

const estilos = StyleSheet.create({
  tarjeta: { marginTop: 10, marginBottom: 2 },
  fila: { flexDirection: "row", alignItems: "center" },
  propietario: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  chip: { alignSelf: "flex-start", marginTop: 8, backgroundColor: "#EEF2F1", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
});
