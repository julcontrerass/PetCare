package frgp.utn.edu.petcare.data

import frgp.utn.edu.petcare.DatosRegistroDueno

/** Cuentas creadas desde la pantalla de registro (en memoria, sin servidor). */
object CuentasRepo {

    enum class Rol { DUENO, VETERINARIO }

    private class Cuenta(val rol: Rol, var password: String)

    private val cuentas = mutableMapOf<String, Cuenta>()

    fun correosRegistrados(): ArrayList<String> = ArrayList(cuentas.keys)

    fun rolDe(email: String): Rol? = cuentas[email.lowercase()]?.rol

    /** True si el correo está registrado y la contraseña no coincide. */
    fun passwordIncorrecta(email: String, password: String): Boolean {
        val cuenta = cuentas[email.lowercase()] ?: return false
        return cuenta.password != password
    }

    /** Actualiza la contraseña de una cuenta registrada (las de demostración no tienen una guardada). */
    fun cambiarPassword(email: String, nueva: String) {
        cuentas[email.lowercase()]?.password = nueva
    }

    fun registrarDueno(datos: DatosRegistroDueno) {
        cuentas[datos.email.lowercase()] = Cuenta(Rol.DUENO, datos.password)
        DuenoRepo.registrar(datos)
    }

    fun registrarVeterinario(email: String, password: String) {
        cuentas[email.lowercase()] = Cuenta(Rol.VETERINARIO, password)
        DuenoRepo.sincronizarVeterinarioRegistrado()
    }
}
