import { useLocalSearchParams } from "expo-router";
import { LocalDate } from "../../../util/tiempo";
import NuevoEventoPantalla from "../../../ui/dueno/NuevoEventoPantalla";

/** `/dueno/evento-nuevo?fecha=AAAA-MM-DD&mascota=Nombre`. */
export default function EventoNuevo() {
  const { fecha, mascota } = useLocalSearchParams<{ fecha?: string; mascota?: string }>();
  let dia: LocalDate | null = null;
  try {
    dia = fecha ? LocalDate.parse(fecha) : null;
  } catch {
    dia = null;
  }
  return <NuevoEventoPantalla fecha={dia} mascota={mascota ?? null} />;
}
