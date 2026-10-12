package frgp.utn.edu.petcare.data

/** Controles de los datos de un dueño que el veterinario carga en el consultorio. Devuelven el error o null. */
object ValidacionDueno {

    private val DNI = Regex("^[0-9]{7,8}$")
    private val CORREO = Regex("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")

    fun nombre(valor: String): String? =
        if (valor.trim().length < 2) "Ingresá el nombre y apellido del dueño" else null

    fun dni(valor: String): String? =
        if (!DNI.matches(valor.trim())) "El DNI debe tener 7 u 8 números" else null

    fun telefono(valor: String): String? =
        if (valor.count { it.isDigit() } < 6) "Ingresá un teléfono válido" else null

    fun correo(valor: String): String? =
        if (!CORREO.matches(valor.trim())) "Ingresá un correo válido" else null
}
