package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.data.Registro
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class RegistroTest : PruebaBase() {

    private fun datos(matricula: String) = DatosRegistroVeterinario(
        nombre = "Dra. Vera", dni = "28999888", telefono = "1155550000", email = "vera@prueba.test",
        password = "123456", matricula = matricula, clinica = "Clínica Sur", direccionClinica = "Av. Siempreviva 742",
        especialidades = listOf("Chequeo médico integral"), tiposAnimales = listOf("Perro"), dias = listOf(1, 2, 3),
        apertura = "09:00", cierre = "18:00"
    )

    @Test
    fun veterinario_conMatriculaLibreSeRegistra() {
        runBlocking { Registro.veterinario(datos("MP-500")) }

        assertTrue(fuente.llamadas.contains("registrar:vera@prueba.test"))
    }

    @Test
    fun veterinario_conMatriculaEnUsoNoLlegaAlServidor() {
        fuente.matriculasEnUso.add("mp-500")

        val error = runCatching { runBlocking { Registro.veterinario(datos("MP-500")) } }.exceptionOrNull()

        assertEquals("Esa matrícula ya está registrada con otra cuenta", error?.message)
        assertTrue(fuente.llamadas.none { it.startsWith("registrar:") })
    }
}
