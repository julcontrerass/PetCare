/**
 * La cuenta que tiene la sesión abierta: lo único de la sesión que necesitan los repositorios. No importa nada a
 * propósito; si los repositorios importaran `Sesion` se armaría un ciclo, porque `Sesion` los orquesta a ellos.
 * Lo escribe solo `Sesion`.
 */

/** Modos en los que se puede usar una cuenta. */
export type Rol = "DUENO" | "VETERINARIO" | "ADMIN";

class CuentaActualImpl {
  usuarioId: string | null = null;
  /** Modo en el que se está usando la cuenta (null mientras no se eligió). */
  rol: Rol | null = null;

  /** Vuelve a pedir el perfil propio; `Sesion` registra la función real al cargarse. */
  recargarPerfil: () => Promise<void> = async () => {};
}

export const CuentaActual = new CuentaActualImpl();
