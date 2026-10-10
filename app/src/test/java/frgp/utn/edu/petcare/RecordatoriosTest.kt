package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.data.avisos.Recordatorios
import frgp.utn.edu.petcare.model.EstadoTurno
import frgp.utn.edu.petcare.model.EventoMascota
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate
import java.time.LocalDateTime

class RecordatoriosTest : PruebaBase() {

    private val ahora = LocalDateTime.of(2026, 10, 12, 9, 0)

    private fun turno(id: String, fecha: LocalDate, hora: String, estado: EstadoTurno = EstadoTurno.PENDIENTE) =
        EventoMascota("Control", "Rex", "Dr. Vera", hora, "", fecha, id = id, mascotaId = "m1", estado = estado)

    @Test
    fun dueno_avisaUnDiaYDosHorasAntes() {
        val avisos = Recordatorios.paraDueno(listOf(turno("t1", LocalDate.of(2026, 10, 14), "16:00")), ahora)

        assertEquals(2, avisos.size)
        assertEquals(LocalDateTime.of(2026, 10, 13, 16, 0), avisos[0].momento)
        assertEquals(LocalDateTime.of(2026, 10, 14, 14, 0), avisos[1].momento)
        assertTrue(avisos[0].mensaje.contains("Rex"))
        assertTrue(avisos[1].titulo.contains("2 horas"))
    }

    @Test
    fun dueno_noAvisaDeLoQueYaPasoNiDeLosCompletadosOCancelados() {
        val avisos = Recordatorios.paraDueno(
            listOf(
                turno("pasado", LocalDate.of(2026, 10, 11), "10:00"),
                turno("hecho", LocalDate.of(2026, 10, 15), "10:00", EstadoTurno.COMPLETADO),
                turno("cancelado", LocalDate.of(2026, 10, 15), "11:00", EstadoTurno.CANCELADO)
            ),
            ahora
        )

        assertTrue(avisos.isEmpty())
    }

    @Test
    fun dueno_unTurnoDeHoyMasTardeSoloAvisaLasDosHorasAntes() {
        val avisos = Recordatorios.paraDueno(listOf(turno("t1", LocalDate.of(2026, 10, 12), "16:00")), ahora)

        assertEquals(1, avisos.size)
        assertEquals(LocalDateTime.of(2026, 10, 12, 14, 0), avisos[0].momento)
    }

    @Test
    fun veterinario_avisaUnaHoraAntesYArmaElResumenDelDia() {
        val eventos = listOf(
            EventoVet("a", "m1", "Control", "Control", LocalDate.of(2026, 10, 13), "10:00", EstadoEvento.PENDIENTE, "", "Dr. Vera"),
            EventoVet("b", "m2", "Control", "Control", LocalDate.of(2026, 10, 13), "11:30", EstadoEvento.PENDIENTE, "", "Dr. Vera"),
            EventoVet("c", "m1", "Control", "Control", LocalDate.of(2026, 10, 13), "12:00", EstadoEvento.COMPLETADO, "", "Dr. Vera")
        )

        val avisos = Recordatorios.paraVeterinario(eventos, ahora)

        assertEquals(3, avisos.size)
        val resumen = avisos.first { it.titulo == "Tu agenda de hoy" }
        assertEquals(LocalDateTime.of(2026, 10, 13, 8, 0), resumen.momento)
        assertEquals("Tenés 2 turnos hoy", resumen.mensaje)
        assertEquals(
            setOf(LocalDateTime.of(2026, 10, 13, 9, 0), LocalDateTime.of(2026, 10, 13, 10, 30)),
            avisos.filter { it.titulo.startsWith("Próximo turno") }.map { it.momento }.toSet()
        )
    }
}
