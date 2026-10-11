package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.ui.common.Contacto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ContactoTest {

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
