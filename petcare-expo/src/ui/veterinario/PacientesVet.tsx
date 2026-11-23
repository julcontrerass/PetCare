/*
 * Migrado de ui/veterinario/PacientesVetSeccion.kt + seccion_vet_pacientes.xml: lista de pacientes del veterinario, con
 * búsqueda y una solapa por tipo de animal. El botón "+" agrega un paciente (NuevoDueno).
 */
import { useState } from "react";
import { FlatList } from "react-native";
import { PacientesRepo } from "../../data/repositorio/pacientesRepo";
import { TiposMascota } from "../../model/tiposMascota";
import { BotonIcono } from "../common/BotonIcono";
import { Campo } from "../common/Campo";
import { EstadoVacio } from "../common/EstadoVacio";
import { PantallaBase } from "../common/PantallaBase";
import { Colores } from "../common/tema";
import { useDatos } from "../common/useDatos";
import { NavVet } from "./navegacionVet";
import { FilaPaciente } from "./PacientesAdapter";
import { PestanasVet } from "./PestanasVet";

/** Una solapa por tipo de animal, además de "Todos". */
const ESPECIES_POR_TAB: (string | null)[] = [null, ...TiposMascota.TODOS];

export function PacientesVet() {
  useDatos();
  const [consulta, setConsulta] = useState("");
  const [pestana, setPestana] = useState(0);
  const total = PacientesRepo.pacientes.length;
  const nombres = ["Todos", ...TiposMascota.TODOS.map((t) => TiposMascota.plural(t))];
  const etiquetas = nombres.map((n, i) => `${n} (${PacientesRepo.filtrar("", ESPECIES_POR_TAB[i]).length})`);
  const lista = PacientesRepo.filtrar(consulta, ESPECIES_POR_TAB[pestana]);
  return (
    <PantallaBase
      titulo="Mis pacientes" subtitulo={total === 1 ? "1 paciente" : `${total} pacientes`} alVolver={NavVet.irAInicio}
      derecha={<BotonIcono icono="mas" accessibilityLabel="Agregar paciente" fondo="ninguno" color={Colores.white} estilo={{ backgroundColor: Colores.primaryTeal }} onPress={NavVet.nuevoDueno} />}
      scroll={false} bordes={["top"]}
    >
      <Campo
        forma="pildora" icono="buscar" placeholder="Buscar paciente, raza o propietario..." accessibilityLabel="Buscar paciente"
        value={consulta} onChangeText={setConsulta} estilo={{ marginTop: 10 }} returnKeyType="search"
      />
      <PestanasVet etiquetas={etiquetas} seleccionada={pestana} alElegir={setPestana} desplazable />
      {lista.length === 0 ? (
        <EstadoVacio icono="perro" titulo="No encontramos pacientes" mensaje="Probá con otra búsqueda o agregá uno nuevo" />
      ) : (
        <FlatList
          data={lista}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <FilaPaciente paciente={item} />}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 16 }}
        />
      )}
    </PantallaBase>
  );
}

export default PacientesVet;
