package frgp.utn.edu.petcare

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime

class FechasTest {

    @Test
    fun parsear_entiendeLosFormatosDeLaApp() {
        assertEquals(LocalDate.of(2026, 3, 15), Fechas.parsear("15 Mar 2026"))
        assertEquals(LocalDate.of(2026, 3, 15), Fechas.parsear("15/03/2026"))
        assertEquals(LocalDate.of(2020, 1, 8), Fechas.parsear("08 ene 2020 (6 años)"))
        assertNull(Fechas.parsear("mañana"))
        assertNull(Fechas.parsear(null))
    }

    @Test
    fun corta_yLarga() {
        assertEquals("05 Ene 2026", Fechas.corta(LocalDate.of(2026, 1, 5)))
        assertEquals("5 de enero de 2026", Fechas.larga(LocalDate.of(2026, 1, 5)))
    }

    @Test
    fun relativa_hoyMananaAyer() {
        val hoy = LocalDate.of(2026, 5, 10)
        assertEquals("Hoy", Fechas.relativa(hoy, hoy))
        assertEquals("Mañana", Fechas.relativa(hoy.plusDays(1), hoy))
        assertEquals("Ayer", Fechas.relativa(hoy.minusDays(1), hoy))
        assertEquals("20 May 2026", Fechas.relativa(hoy.plusDays(10), hoy))
    }

    @Test
    fun haceTexto_segunCuantoPaso() {
        val ahora = LocalDateTime.now()
        fun hace(minutos: Long): String {
            val momento = ahora.minusMinutes(minutos).atZone(java.time.ZoneId.systemDefault()).toOffsetDateTime().toString()
            return Fechas.haceTexto(momento, ahora)
        }
        assertEquals("Ahora", hace(0))
        assertEquals("Hace 5 min", hace(5))
        assertEquals("Hace 1 hora", hace(60))
        assertEquals("Hace 3 horas", hace(180))
        assertEquals("Ayer", hace(60 * 30))
    }
}
