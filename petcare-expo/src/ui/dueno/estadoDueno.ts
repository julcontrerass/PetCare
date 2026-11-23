import { LocalDate, YearMonth } from "../../util/tiempo";
import type { Mascota } from "../../model/modelos";

/**
 * Lo que comparten las pantallas del dueño mientras se navega (campos de `DuenoActivity` en Android): la
 * mascota abierta, el día elegido en el calendario y el mes que se está viendo.
 */
export const EstadoDueno = {
  mascotaActual: null as Mascota | null,
  diaSeleccionado: LocalDate.now(),
  mesCalendario: YearMonth.now(),
};

type Oyente = () => void;
const oyentes = new Set<Oyente>();

/** Panel de notificaciones (el `NotificacionesDialogo` de Android): lo abre cualquier pantalla y lo dibuja el layout. */
export const PanelNotificacionesDueno = {
  visible: false,
  mostrar() {
    this.visible = true;
    oyentes.forEach((o) => o());
  },
  ocultar() {
    this.visible = false;
    oyentes.forEach((o) => o());
  },
  suscribir(oyente: Oyente): () => void {
    oyentes.add(oyente);
    return () => {
      oyentes.delete(oyente);
    };
  },
};
