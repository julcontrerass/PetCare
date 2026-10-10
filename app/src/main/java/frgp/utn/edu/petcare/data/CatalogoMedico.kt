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
}
