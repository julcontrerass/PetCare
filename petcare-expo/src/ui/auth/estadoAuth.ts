/*
 * Lo que en Android viajaba entre las Activities de ui/auth (startActivityForResult con EXTRA_EMAIL y
 * EXTRA_CONFIRMAR_CORREO) pasa acá: las pantallas de registro avisan cómo terminaron y el ingreso lo recibe.
 */
import { router } from "expo-router";

/** Cómo terminó un registro (RegistroDuenoActivity / RegistroVeterinarioActivity devolvían esto en el Intent). */
export interface RegistroTerminado {
  email: string;
  /** True si el proyecto pide confirmar el correo antes de dejar entrar (no quedó sesión abierta). */
  confirmarCorreo: boolean;
  esVeterinario: boolean;
}

class EstadoAuthImpl {
  /** El ingreso se anota acá mientras está abierto para enterarse de que se creó una cuenta. */
  alTerminarRegistro: ((r: RegistroTerminado) => void) | null = null;

  /** Si el registro termina cuando el ingreso no está abierto (se recargó la página), queda esperando. */
  private pendiente: RegistroTerminado | null = null;

  terminarRegistro(r: RegistroTerminado): void {
    if (this.alTerminarRegistro) this.alTerminarRegistro(r);
    else this.pendiente = r;
  }

  /** Devuelve (y olvida) el registro que quedó esperando, si hay. */
  tomarPendiente(): RegistroTerminado | null {
    const r = this.pendiente;
    this.pendiente = null;
    return r;
  }
}

export const EstadoAuth = new EstadoAuthImpl();

/** `finish()` de la Activity: vuelve a la pantalla anterior o, si se abrió directo (web), al ingreso. */
export function cerrarPantalla(): void {
  if (router.canGoBack()) router.back();
  else router.replace("/auth");
}
