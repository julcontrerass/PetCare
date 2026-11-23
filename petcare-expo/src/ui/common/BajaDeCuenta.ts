/*
 * Migrado de ui/common/BajaDeCuenta.kt: pide confirmación y borra la cuenta del usuario con todo lo que cargó
 * (mascotas, turnos y archivos).
 */
import { Sesion } from "../../data/sesion";
import { Errores } from "../../util/errores";
import { Avisos } from "./Avisos";

async function eliminar(): Promise<void> {
  try {
    await Sesion.eliminarCuenta();
    Avisos.mostrar("Tu cuenta fue eliminada");
    // Sesion.alVolverAlIngreso (conectado en RaizApp) hace `router.replace("/auth")`
    Sesion.volverAlIngreso();
  } catch (e) {
    Avisos.error(Errores.mensaje(e));
  }
}

/** Cartel de confirmación; si el usuario acepta, da de baja la cuenta y vuelve al ingreso. */
export function confirmar(): void {
  Avisos.confirmar({
    titulo: "¿Eliminar tu cuenta?",
    mensaje:
      "Se borran tu cuenta y todo lo que cargaste: mascotas, turnos, historial y archivos. " +
      "Esta acción no se puede deshacer.",
    textoAceptar: "Eliminar cuenta",
    textoCancelar: "Cancelar",
    alAceptar: () => void eliminar(),
  });
}

export const BajaDeCuenta = { confirmar };
