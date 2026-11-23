import { useLocalSearchParams } from "expo-router";
import { DuenoRepo } from "../../../../data/repositorio/duenoRepo";
import NuevoEventoPantalla from "../../../../ui/dueno/NuevoEventoPantalla";
import { EventoNoEncontrado } from "../../../../ui/dueno/EventoNoEncontrado";

/** `/dueno/evento/[id]`: edita el turno con ese id (se busca en `DuenoRepo.eventos`). */
export default function EditarEvento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const evento = DuenoRepo.eventos.find((e) => e.id === id);
  if (!evento) return <EventoNoEncontrado />;
  return <NuevoEventoPantalla edicion={evento} />;
}
