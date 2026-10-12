package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.ui.common.Contacto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ContactoTest {

    @Test
    fun mensajeDeAcceso_llevaLosDatosParaIngresar() {
        val mensaje = Contacto.mensajeDeAcceso(
            dueno = "Carlos Gómez", mascotas = listOf("Toby"), email = "carlos@prueba.test",
            password = "Temp1234ab", veterinario = "Dra. Vera", clinica = "Clínica Sur"
        )

        assertTrue(mensaje.startsWith("Hola Carlos, soy Dra. Vera de Clínica Sur."))
        assertTrue(mensaje.contains("la ficha de Toby"))
        assertTrue(mensaje.contains("Correo: carlos@prueba.test"))
        assertTrue(mensaje.contains("Contraseña temporal: Temp1234ab"))
    }

    @Test
    fun mensajeDeAcceso_nombraVariasMascotasYFuncionaSinClinica() {
        val mensaje = Contacto.mensajeDeAcceso(
            dueno = "Ana", mascotas = listOf("Toby", "Luna", "Rex"), email = "a@b.co", password = "x",
            veterinario = "Dr. Pérez", clinica = ""
        )

        assertTrue(mensaje.contains("soy Dr. Pérez."))
        assertTrue(mensaje.contains("la ficha de Toby, Luna y Rex"))
    }


    @Test
    fun whatsApp_armaElNumeroDeCelularArgentino() {
        assertEquals("5491112345678", Contacto.numeroWhatsApp("11 1234-5678"))
        assertEquals("5491112345678", Contacto.numeroWhatsApp("011 15 1234 5678"))
        assertEquals("5491112345678", Contacto.numeroWhatsApp("+54 9 11 1234 5678"))
        assertEquals("5491112345678", Contacto.numeroWhatsApp("+54 11 1234 5678"))
    }

    @Test
    fun whatsApp_sinNumeroUsableDevuelveNull() {
        assertNull(Contacto.numeroWhatsApp("Sin datos"))
        assertNull(Contacto.numeroWhatsApp("123"))
    }
}
