package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.data.DatosRegistroVeterinario
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

    @Test
    fun veterinario_mandaLosLugaresExtraAlServidor() {
        val extra = frgp.utn.edu.petcare.model.SedeVet("", "Consultorio Centro", "San Martín 100", setOf(6, 4), "10:00", "14:00")

        runBlocking { Registro.veterinario(datos("MP-501").copy(sedesExtra = listOf(extra))) }

        val enviados = fuente.ultimosDatosDeRegistro!!
        val sedes = enviados["sedes"] as kotlinx.serialization.json.JsonArray
        assertEquals(1, sedes.size)
        val primera = sedes[0] as kotlinx.serialization.json.JsonObject
        assertEquals("Consultorio Centro", (primera["nombre"] as kotlinx.serialization.json.JsonPrimitive).content)
        assertEquals("San Martín 100", (primera["direccion"] as kotlinx.serialization.json.JsonPrimitive).content)
        assertEquals("[4,6]", primera["dias_atencion"].toString())
        assertEquals("10:00", (primera["hora_apertura"] as kotlinx.serialization.json.JsonPrimitive).content)
        // El primer lugar sigue siendo la clínica "de siempre"
        assertEquals("Clínica Sur", (enviados["clinica"] as kotlinx.serialization.json.JsonPrimitive).content)
    }

    @Test
    fun veterinario_sinLugaresExtraManda_unaListaVacia() {
        runBlocking { Registro.veterinario(datos("MP-502")) }

        assertEquals(0, (fuente.ultimosDatosDeRegistro!!["sedes"] as kotlinx.serialization.json.JsonArray).size)
    }
}
