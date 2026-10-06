package frgp.utn.edu.petcare

/** Perfil del veterinario en sesión (demo, en memoria). */
object PerfilVetRepo {
    var nombre = "Dr. Juan Pérez"
    var matricula = "MP-12345"
    var clinica = "Clínica Veterinaria Central"
    var direccionClinica = "Av. Santa Fe 2345, CABA"
    var telefono = "+54 11 4000-1234"
    var email = "juan.perez@clinica.com"
    var fotoRes = R.drawable.juani
    var fotoUriString: String? = null

    // Días y Horarios
    val todosLosDias = arrayOf("Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo")
    val diasSeleccionados = booleanArrayOf(true, true, true, true, true, true, false)
    var horaApertura = "09:00"
    var horaCierre = "18:00"

    fun textoHorarios(): String {
        val diasActivos = todosLosDias.filterIndexed { index, _ -> diasSeleccionados[index] }
        return if (diasActivos.isEmpty()) {
            "Sin días de atención configurados"
        } else {
            val diasStr = diasActivos.joinToString(", ")
            "$diasStr · $horaApertura a $horaCierre hs"
        }
    }

    // Especialidades y Prácticas
    val todasLasEspecialidades = arrayOf(
        "Consulta general",
        "Vacunación y prevención",
        "Cirugía Veterinaria",
        "Dermatología",
        "Odontología",
        "Análisis de laboratorio",
        "Ecografía y Radiografía",
        "Desparasitación",
        "Control de peso y Nutrición",
        "Atención de urgencias"
    )
    val especialidadesSeleccionadas = booleanArrayOf(true, true, true, true, true, false, false, true, false, false)

    fun textoEspecialidades(): String {
        val activas = todasLasEspecialidades.filterIndexed { index, _ -> especialidadesSeleccionadas[index] }
        return if (activas.isEmpty()) {
            "Sin especialidades seleccionadas"
        } else {
            activas.joinToString(", ")
        }
    }

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
