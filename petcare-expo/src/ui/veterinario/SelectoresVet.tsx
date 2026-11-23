/*
 * Migrado de ui/veterinario/SelectoresVet.kt (dialog_fecha_vet.xml y dialog_hora_vet.xml). Los dos diálogos de
 * Android que se armaban a mano son acá componentes que se apoyan en `SelectorFecha` y `SelectorHora` del kit.
 */
import { LocalDate } from "../../util/tiempo";
import { Fechas } from "../../util/fechas";
import type { SedeVet } from "../../model/modelos";
import { CatalogoMedico } from "../../data/catalogoMedico";
import { DisponibilidadVet } from "../../data/repositorio/disponibilidadVet";
import { PerfilVetRepo } from "../../data/repositorio/perfilVetRepo";
import { Avisos } from "../common/Avisos";
import { SelectorFecha } from "../common/SelectorFecha";
import { SelectorHora } from "../common/SelectorHora";

export interface SelectorFechaVetProps {
  visible: boolean;
  /** Fecha elegida hasta ahora (el calendario abre en su mes). */
  inicial?: LocalDate | null;
  /** Lugar de atención; sin él, el principal. */
  sede?: SedeVet | null;
  alElegir: (fecha: LocalDate) => void;
  alCerrar: () => void;
}

/** Texto de los días de atención que se muestra bajo el título ("Atendés en X: Lun, Mar"). */
export function textoDiasAtencion(sede: SedeVet | null = null): string {
  const lugar = sede ?? PerfilVetRepo.sede(null);
  const activos = PerfilVetRepo.todosLosDias.filter((_, i) =>
    lugar ? lugar.dias.includes(i + 1) : PerfilVetRepo.diasSeleccionados[i],
  );
  const enLugar = PerfilVetRepo.sedes.length > 1 && lugar ? ` en ${lugar.nombre}` : "";
  return activos.length === 0
    ? "No configuraste días de atención en tu perfil"
    : `Atendés${enLugar}: ` + activos.map((d) => d.slice(0, 3)).join(", ");
}

/** Calendario mensual: los días en que el veterinario no atiende se muestran en negro y no se pueden elegir. */
export function SelectorFechaVet({ visible, inicial = null, sede = null, alElegir, alCerrar }: SelectorFechaVetProps) {
  return (
    <SelectorFecha
      visible={visible}
      valor={inicial}
      minima={LocalDate.now()}
      diaHabilitado={(f) => DisponibilidadVet.trabajaEl(f, sede)}
      leyendaBloqueado="No atiende"
      alTocarBloqueado={(f) => Avisos.mostrar(`No atendés los ${DisponibilidadVet.nombreDia(f).toLowerCase()}`)}
      subtitulo={visible ? textoDiasAtencion(sede) : undefined}
      alElegir={alElegir}
      alCerrar={alCerrar}
    />
  );
}

export interface SelectorHoraVetProps {
  visible: boolean;
  fecha: LocalDate;
  horaActual?: string | null;
  /** Turno que se está editando: su propio horario no cuenta como ocupado. */
  ignorarId?: string | null;
  duracionMin?: number;
  sede?: SedeVet | null;
  alElegir: (hora: string) => void;
  alCerrar: () => void;
}

/** Grilla de horarios del día elegido: solo se pueden tomar los que están libres dentro de la atención. */
export function SelectorHoraVet({
  visible, fecha, horaActual = null, ignorarId = null, duracionMin = DisponibilidadVet.DURACION_MIN, sede = null,
  alElegir, alCerrar,
}: SelectorHoraVetProps) {
  const horarios = visible ? DisponibilidadVet.horarios(fecha, duracionMin, ignorarId, sede) : [];
  const lugar = sede ?? PerfilVetRepo.sede(null);
  const resumen =
    `${Fechas.relativa(fecha)} · ${Fechas.corta(fecha)} · atendés de ` +
    `${lugar?.apertura ?? PerfilVetRepo.horaApertura} a ${lugar?.cierre ?? PerfilVetRepo.horaCierre} hs · el turno dura ` +
    CatalogoMedico.textoDuracion(duracionMin);
  return (
    <SelectorHora
      visible={visible}
      horarios={horarios.map((h) => h.hora)}
      ocupados={horarios.filter((h) => !h.libre).map((h) => h.hora)}
      valor={horaActual}
      subtitulo={resumen}
      alTocarOcupado={() => Avisos.mostrar("Ese horario no está disponible")}
      alElegir={alElegir}
      alCerrar={alCerrar}
    />
  );
}

export const SelectoresVet = { SelectorFechaVet, SelectorHoraVet };
