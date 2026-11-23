/** Convierte los errores de Supabase y de red en mensajes para el usuario. */

interface ErrorConDetalle {
  message?: string;
  name?: string;
  code?: string;
  status?: number;
  details?: string;
  hint?: string;
  error_description?: string;
  context?: unknown;
}

const esErrorDeRed = (e: ErrorConDetalle): boolean => {
  const texto = `${e.message ?? ""}`.toLowerCase();
  return (
    texto.includes("network request failed") ||
    texto.includes("failed to fetch") ||
    texto.includes("network error") ||
    texto.includes("timeout") ||
    texto.includes("timed out") ||
    texto.includes("internet connection")
  );
};

export class ErrorConMensaje extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = "ErrorConMensaje";
  }
}

export const Errores = {
  mensaje(error: unknown): string {
    const e = (error ?? {}) as ErrorConDetalle;
    if (error instanceof ErrorConMensaje) return error.message;
    if (esErrorDeRed(e)) {
      return "No hay conexión con el servidor. Revisá tu internet e intentá de nuevo.";
    }
    const texto = [e.code, e.error_description, e.details, e.hint, e.message].filter(Boolean).join(" ").toLowerCase();
    const esAuth = (e.name ?? "").startsWith("Auth");
    if (esAuth) {
      if (texto.includes("email_provider_disabled") || texto.includes("email logins are disabled")) {
        return "El ingreso con correo y contraseña está desactivado en el servidor.";
      }
      if (texto.includes("invalid login") || texto.includes("invalid_credentials") || texto.includes("invalid credentials")) {
        return "Correo o contraseña incorrectos";
      }
      if (texto.includes("email not confirmed") || texto.includes("email_not_confirmed")) {
        return "Confirmá tu correo antes de ingresar: te mandamos un mensaje.";
      }
      if (texto.includes("already registered") || texto.includes("user_already_exists") || texto.includes("already exists")) {
        return "Ese correo ya está registrado";
      }
      if (texto.includes("weak") || texto.includes("password should be")) {
        return "La contraseña es muy débil. Usá al menos 6 caracteres.";
      }
      if (texto.includes("rate limit") || texto.includes("over_email_send_rate_limit") || texto.includes("too many")) {
        return "Hiciste demasiados intentos. Esperá unos minutos.";
      }
      if (texto.includes("database error saving new user")) {
        return "No pudimos crear la cuenta. Revisá que el DNI y la matrícula no estén ya registrados.";
      }
      return "No pudimos completar la operación de cuenta. Intentá de nuevo.";
    }
    if (texto.includes("turnos_sin_superposicion_vet")) return "El veterinario ya tiene un turno en ese horario";
    if (texto.includes("turnos_sin_superposicion_mascota")) return "La mascota ya tiene un turno en ese horario";
    if (texto.includes("row-level security") || texto.includes("permission denied") || texto.includes("42501")) {
      return "No tenés permiso para hacer esto. Si el problema sigue, volvé a iniciar sesión.";
    }
    if (texto.includes("duplicate key") && texto.includes("dni")) return "Ese DNI ya está registrado";
    if (texto.includes("duplicate key") && texto.includes("matricula")) return "Esa matrícula ya está registrada";
    if (texto.includes("mascotas_nombre_dueno_key")) return "Ya tenés una mascota con ese nombre";
    if (e.code || e.status) {
      const detalle = (e.message ?? "").trim();
      if (!detalle || detalle.toLowerCase() === "unknown error") {
        return "El servidor no pudo completar la operación. Intentá de nuevo en un rato.";
      }
      return detalle;
    }
    return e.message?.trim() ? e.message : "Ocurrió un error inesperado";
  },
};
