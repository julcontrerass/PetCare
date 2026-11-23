/*
 * Lo que en Android viajaba entre las Activities del veterinario con `setResult` / `registerForActivityResult`:
 * NuevoDuenoActivity devuelve a AgregarConsultaActivity el id de la primera mascota que quedó cargada
 * (`EXTRA_PACIENTE_ID`). Acá la pantalla de consulta se anota para recibirlo.
 */
import { router } from "expo-router";

/** `finish()` de la Activity: vuelve a la pantalla anterior o, si se abrió directo (web), al inicio del veterinario. */
export function cerrarPantalla(): void {
  if (router.canGoBack()) router.back();
  else router.replace("/vet");
}

class EstadoVetImpl {
  /** AgregarConsulta se anota mientras está abierta. */
  alTerminarAltaDeDueno: ((pacienteId: string) => void) | null = null;

  /** Si el alta termina cuando AgregarConsulta no está abierta (se recargó la página), queda esperando. */
  private pendiente: string | null = null;

  terminarAltaDeDueno(pacienteId: string | null): void {
    if (pacienteId === null) return;
    if (this.alTerminarAltaDeDueno) this.alTerminarAltaDeDueno(pacienteId);
    else this.pendiente = pacienteId;
  }

  /** Devuelve (y olvida) el paciente que quedó esperando, si hay. */
  tomarPendiente(): string | null {
    const p = this.pendiente;
    this.pendiente = null;
    return p;
  }
}

export const EstadoVet = new EstadoVetImpl();
