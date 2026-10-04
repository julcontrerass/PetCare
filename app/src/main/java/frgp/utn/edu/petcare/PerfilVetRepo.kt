package frgp.utn.edu.petcare

/** Perfil del veterinario en sesión (demo, en memoria). */
object PerfilVetRepo {
    var nombre = "Dr. Juan Pérez"
    var matricula = "MP-12345"
    var clinica = "Clínica Veterinaria Central"
    var telefono = "+54 11 4000-1234"
    var email = "juan.perez@clinica.com"

    /** Null hasta que el usuario cambia la contraseña por primera vez (todavía no hay backend). */
    var password: String? = null

    fun cambiarPassword(actual: String, nueva: String, confirmacion: String): String? {
        val guardada = password
        return when {
            actual.isEmpty() -> "Ingresá tu contraseña actual"
            guardada != null && actual != guardada -> "La contraseña actual es incorrecta"
            nueva.length < 6 -> "La nueva contraseña debe tener al menos 6 caracteres"
            nueva != confirmacion -> "Las contraseñas no coinciden"
            nueva == actual -> "La nueva contraseña debe ser distinta a la actual"
            else -> { password = nueva; null }
        }
    }
}
