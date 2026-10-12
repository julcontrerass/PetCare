package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.data.ValidacionDueno
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

class ValidacionDuenoTest {

    @Test
    fun dni_aceptaSieteOOchoNumeros() {
        assertNull(ValidacionDueno.dni("30111222"))
        assertNull(ValidacionDueno.dni(" 9876543 "))
        assertNotNull(ValidacionDueno.dni("123456"))
        assertNotNull(ValidacionDueno.dni("30.111.222"))
        assertNotNull(ValidacionDueno.dni(""))
    }

    @Test
    fun correo_pideArrobaYDominio() {
        assertNull(ValidacionDueno.correo("carlos@prueba.test"))
        assertNotNull(ValidacionDueno.correo("carlos@prueba"))
        assertNotNull(ValidacionDueno.correo("carlos prueba.test"))
        assertNotNull(ValidacionDueno.correo(""))
    }

    @Test
    fun telefono_pideAlMenosSeisNumeros() {
        assertNull(ValidacionDueno.telefono("11 4444-3333"))
        assertNotNull(ValidacionDueno.telefono("12345"))
        assertNotNull(ValidacionDueno.telefono("Sin datos"))
    }

    @Test
    fun nombre_noPuedeEstarVacio() {
        assertNull(ValidacionDueno.nombre("Carlos Gómez"))
        assertNotNull(ValidacionDueno.nombre(" "))
    }
}
