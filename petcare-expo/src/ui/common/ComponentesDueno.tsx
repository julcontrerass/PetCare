/*
 * Migrado de ui/dueno/Componentes.kt: piezas de interfaz que usan varias secciones del dueño.
 *
 * `Componentes.estadoVacio` es el `EstadoVacio` del kit (mismas piezas: ícono, título, mensaje y botón opcional).
 */
import { DuenoRepo } from "../../data/repositorio/duenoRepo";
import { EstadosMascota } from "../../model/modelos";
import { diasEntre, LocalDate } from "../../util/tiempo";
import { Chip } from "./Chip";
import { SelectorFecha } from "./SelectorFecha";

export { EstadoVacio } from "./EstadoVacio";

/**
 * "Al día" o "Vacuna pendiente", según tenga una vacuna agendada para los próximos días. Las mascotas inactivas y las
 * fallecidas muestran su estado en vez del de las vacunas. Lee los repositorios en el render (usar `useDatos()`).
 */
export function ChipEstadoMascota({ nombreMascota }: { nombreMascota: string }) {
  const estado = DuenoRepo.buscarMascota(nombreMascota)?.estado;
  if (estado != null && estado !== "ACTIVA") return <Chip texto={EstadosMascota[estado].etiqueta} tono="neutro" />;
  const pendiente = DuenoRepo.tieneVacunaPendiente(nombreMascota);
  return pendiente ? <Chip texto="Vacuna pendiente" tono="aviso" /> : <Chip texto="Al día" tono="ok" />;
}

/** Días que faltan desde hoy hasta [fecha] (para "Hoy / Mañana / En N días"); negativo si ya pasó. */
export function diasHasta(fecha: LocalDate): number {
  return diasEntre(LocalDate.now(), fecha);
}

export interface SelectorFechaNacimientoProps {
  visible: boolean;
  /** La fecha ya elegida; el calendario abre en su mes (o en el de hoy). */
  inicial?: LocalDate | null;
  alElegir: (fecha: LocalDate) => void;
  alCerrar: () => void;
}

/**
 * Calendario para elegir una fecha de nacimiento; no deja elegir días que todavía no pasaron (en Kotlin, además, el
 * aviso "No podés seleccionar una fecha de nacimiento futura": acá los días futuros se ven apagados y el subtítulo lo
 * explica, porque un aviso quedaría detrás del modal).
 */
export function SelectorFechaNacimiento({ visible, inicial, alElegir, alCerrar }: SelectorFechaNacimientoProps) {
  return (
    <SelectorFecha
      visible={visible}
      valor={inicial ?? null}
      maxima={LocalDate.now()}
      titulo="Fecha de nacimiento"
      subtitulo="No podés seleccionar una fecha de nacimiento futura"
      alElegir={alElegir}
      alCerrar={alCerrar}
    />
  );
}

export const Componentes = { diasHasta };
