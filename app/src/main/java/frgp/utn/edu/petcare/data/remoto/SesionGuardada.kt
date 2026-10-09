package frgp.utn.edu.petcare.data.remoto

import android.content.Context
import io.github.jan.supabase.auth.CodeVerifierCache
import io.github.jan.supabase.auth.SessionManager
import io.github.jan.supabase.auth.user.UserSession
import kotlinx.serialization.json.Json

/**
 * Guarda la sesión de Supabase en las preferencias privadas de la app para que el usuario no tenga que volver
 * a ingresar cada vez que la abre.
 */
class SesionGuardada(contexto: Context) : SessionManager {

    private val preferencias = contexto.applicationContext.getSharedPreferences(ARCHIVO, Context.MODE_PRIVATE)
    private val json = Json { ignoreUnknownKeys = true }

    override suspend fun saveSession(session: UserSession) {
        preferencias.edit().putString(CLAVE, json.encodeToString(UserSession.serializer(), session)).apply()
    }

    override suspend fun loadSession(): UserSession? {
        val texto = preferencias.getString(CLAVE, null) ?: return null
        return runCatching { json.decodeFromString(UserSession.serializer(), texto) }.getOrNull()
    }

    override suspend fun deleteSession() {
        preferencias.edit().remove(CLAVE).apply()
    }

    private companion object {
        const val ARCHIVO = "petcare_sesion"
        const val CLAVE = "sesion"
    }
}

/** Guarda el código temporal del inicio de sesión mientras el usuario vuelve de abrir un enlace del correo. */
class CodigoVerificadorGuardado(contexto: Context) : CodeVerifierCache {

    private val preferencias = contexto.applicationContext.getSharedPreferences("petcare_sesion", Context.MODE_PRIVATE)

    override suspend fun saveCodeVerifier(codeVerifier: String) {
        preferencias.edit().putString("verificador", codeVerifier).apply()
    }

    override suspend fun loadCodeVerifier(): String? = preferencias.getString("verificador", null)

    override suspend fun deleteCodeVerifier() {
        preferencias.edit().remove("verificador").apply()
    }
}
