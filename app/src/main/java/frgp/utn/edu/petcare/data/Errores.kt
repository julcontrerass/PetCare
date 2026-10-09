package frgp.utn.edu.petcare.data

import io.github.jan.supabase.auth.exception.AuthRestException
import io.github.jan.supabase.exceptions.HttpRequestException
import io.github.jan.supabase.exceptions.RestException
import java.io.IOException

/** Convierte los errores de Supabase y de red en mensajes para el usuario. */
object Errores {

    fun mensaje(e: Throwable): String {
        if (e is HttpRequestException || e is IOException || e.cause is IOException) {
            return "No hay conexión con el servidor. Revisá tu internet e intentá de nuevo."
        }
        val texto = listOfNotNull((e as? RestException)?.description, e.message).joinToString(" ").lowercase()
        if (e is AuthRestException) {
            return when {
                "email_provider_disabled" in texto || "email logins are disabled" in texto ->
                    "El ingreso con correo y contraseña está desactivado en el servidor."
                "invalid login" in texto || "invalid_credentials" in texto || "invalid credentials" in texto ->
                    "Correo o contraseña incorrectos"
                "email not confirmed" in texto || "email_not_confirmed" in texto ->
                    "Confirmá tu correo antes de ingresar: te mandamos un mensaje."
                "already registered" in texto || "user_already_exists" in texto || "already exists" in texto ->
                    "Ese correo ya está registrado"
                "weak" in texto || "password should be" in texto ->
                    "La contraseña es muy débil. Usá al menos 6 caracteres."
                "rate limit" in texto || "over_email_send_rate_limit" in texto || "too many" in texto ->
                    "Hiciste demasiados intentos. Esperá unos minutos."
                "database error saving new user" in texto ->
                    "No pudimos crear la cuenta. Revisá que el DNI y la matrícula no estén ya registrados."
                else -> "No pudimos completar la operación de cuenta. Intentá de nuevo."
            }
        }
        return when {
            "turnos_sin_superposicion_vet" in texto -> "El veterinario ya tiene un turno en ese horario"
            "turnos_sin_superposicion_mascota" in texto -> "La mascota ya tiene un turno en ese horario"
            "row-level security" in texto || "permission denied" in texto || "42501" in texto ->
                "No tenés permiso para hacer esto. Si el problema sigue, volvé a iniciar sesión."
            "duplicate key" in texto && "dni" in texto -> "Ese DNI ya está registrado"
            "duplicate key" in texto && "matricula" in texto -> "Esa matrícula ya está registrada"
            "mascotas_nombre_dueno_key" in texto -> "Ya tenés una mascota con ese nombre"
            e is RestException -> (e.description ?: e.error).ifBlank { "No se pudo completar la operación" }
            else -> e.message?.takeIf { it.isNotBlank() } ?: "Ocurrió un error inesperado"
        }
    }
}
