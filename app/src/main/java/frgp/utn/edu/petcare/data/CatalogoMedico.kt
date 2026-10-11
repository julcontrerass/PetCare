package frgp.utn.edu.petcare.data

/**
 * Servicios y especialidades médicas que ofrece la clínica. Es la lista única que usan el registro del
 * veterinario, su perfil y el filtro del dueño al sacar un turno.
 */
object CatalogoMedico {

    val SERVICIOS = listOf(
        "Chequeo médico integral",
        "Castraciones y limpieza dental",
        "Cirugía 24hs",
        "Laboratorio y diagnóstico por imágenes",
        "Tomografía",
        "Baño y peluquería"
    )

    val ESPECIALIDADES = listOf(
        "Oncología",
        "Cardiología",
        "Fisioterapia",
        "Gastroenterología",
        "Nutrición",
        "Dermatología",
        "Exóticos",
        "Oftalmología",
        "Nefrourología",
        "Endocrinología",
        "Neurología",
        "Homeopatía",
        "Medicina felina",
        "Hematología",
        "Parasitología",
        "Neumonología",
        "Medicina del dolor"
    )

    /** Servicios primero y después las especialidades, en el orden en que se muestran. */
    val TODAS: List<String> = SERVICIOS + ESPECIALIDADES

    fun esServicio(nombre: String) = SERVICIOS.any { it.equals(nombre, ignoreCase = true) }

    const val DURACION_GENERAL_MIN = 30
    const val DURACION_MINIMA_MIN = 15
    const val DURACION_MAXIMA_MIN = 480
    const val PASO_DURACION_MIN = 15

    /**
     * Minutos que dura cada servicio o especialidad si el veterinario no configuró otra cosa. Tiene que
     * coincidir con `private.duracion_por_defecto` de la base, que es la que fija la duración real del turno.
     */
    private val DURACIONES_POR_DEFECTO = mapOf(
        "Chequeo médico integral" to 30,
        "Castraciones y limpieza dental" to 90,
        "Cirugía 24hs" to 120,
        "Laboratorio y diagnóstico por imágenes" to 45,
        "Tomografía" to 60,
        "Baño y peluquería" to 60,
        "Oncología" to 60,
        "Cardiología" to 45,
        "Fisioterapia" to 45,
        "Gastroenterología" to 45,
        "Nutrición" to 30,
        "Dermatología" to 30,
        "Exóticos" to 45,
        "Oftalmología" to 30,
        "Nefrourología" to 45,
        "Endocrinología" to 30,
        "Neurología" to 60,
        "Homeopatía" to 45,
        "Medicina felina" to 30,
        "Hematología" to 30,
        "Parasitología" to 30,
        "Neumonología" to 45,
        "Medicina del dolor" to 45
    )

    fun duracionPorDefecto(nombre: String?): Int =
        DURACIONES_POR_DEFECTO.entries.firstOrNull { it.key.equals(nombre?.trim(), ignoreCase = true) }?.value
            ?: DURACION_GENERAL_MIN

    /** "30 min", "1 h", "1 h 30 min". */
    fun textoDuracion(minutos: Int): String {
        val horas = minutos / 60
        val resto = minutos % 60
        return when {
            horas == 0 -> "$resto min"
            resto == 0 -> "$horas h"
            else -> "$horas h $resto min"
        }
    }
}
