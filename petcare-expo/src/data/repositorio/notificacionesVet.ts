import { AvisosDelSistema } from "../avisos/avisosDelSistema";
import type { NotificacionDto } from "../remoto/dtos";
import { Servicios } from "../servicios";

// La interfaz (el panel de avisos) vive en src/ui/common/PanelAvisos.tsx
// En Kotlin, `mostrar(actividad, alCambiar)` cargaba los avisos, armaba el panel, y al abrirlo marcaba todo como
// leído; esa parte de datos quedó en [lista], [marcarLeidas] y [borrarTodas].

/** Avisos del veterinario: turnos nuevos, cambios y cancelaciones, y solicitudes de acceso. */
class NotificacionesVetImpl {
  private ultimas: NotificacionDto[] = [];

  /** Los avisos tal como están ahora en memoria (los más nuevos primero, como los manda el servidor). */
  get lista(): NotificacionDto[] {
    return this.ultimas;
  }

  /** Hay avisos que el veterinario todavía no abrió (para el punto rojo de la campana). */
  get hayNuevas(): boolean {
    return this.ultimas.some((n) => !n.leida);
  }

  /** Cuántos avisos todavía no se abrieron. */
  get sinLeer(): number {
    return this.ultimas.filter((n) => !n.leida).length;
  }

  limpiar(): void {
    this.ultimas = [];
  }

  async cargar(silencioso = false): Promise<void> {
    this.ultimas = await Servicios.fuente.notificaciones();
    try {
      await AvisosDelSistema.mostrarNuevas(this.ultimas, silencioso);
    } catch {
      // un fallo al mostrar el aviso del sistema no debe impedir que se vea la lista
    }
  }

  /** Borra una sola notificación: se saca ya de la lista y se borra del servidor en segundo plano. */
  borrar(id: string): void {
    this.ultimas = this.ultimas.filter((n) => n.id !== id);
    void Servicios.escribir(async () => {
      await Servicios.fuente.borrarNotificacion(id);
    });
  }

  /** Borra todas las notificaciones: se vacía la lista ya y se borran del servidor en segundo plano. */
  borrarTodas(): void {
    this.ultimas = [];
    void Servicios.escribir(async () => {
      await Servicios.fuente.borrarNotificaciones();
    });
  }

  /**
   * Marca todos los avisos como leídos (se ve ya y se guarda en segundo plano). Devuelve true si había alguno
   * sin leer, es decir, si algo cambió.
   */
  marcarLeidas(): boolean {
    if (!this.ultimas.some((n) => !n.leida)) return false;
    this.ultimas = this.ultimas.map((n) => ({ ...n, leida: true }));
    void Servicios.escribir(async () => {
      await Servicios.fuente.marcarNotificacionesLeidas();
    });
    return true;
  }
}

export const NotificacionesVet = new NotificacionesVetImpl();
