package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.data.remoto.AccesoDto
import frgp.utn.edu.petcare.data.remoto.InformeDto
import frgp.utn.edu.petcare.data.remoto.NotificacionDto
import frgp.utn.edu.petcare.data.avisos.Recordatorios
import frgp.utn.edu.petcare.data.repositorio.DuenoRepo
import frgp.utn.edu.petcare.data.repositorio.InformesRepo
import frgp.utn.edu.petcare.data.repositorio.RecordatoriosRepo
import frgp.utn.edu.petcare.model.EstadoAcceso
import frgp.utn.edu.petcare.model.EstadoMascota
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/** Estado de la mascota, permisos con vencimiento, informes cerrados, recordatorios hechos a mano y avisos borrables. */
class NuevasFuncionesTest : PruebaBase() {

    private val manana = LocalDate.now().plusDays(1)

    @Before
    fun cargarEscenario() {
        fuente.mascotas.add(Escenario.mascota("m1", "Rex"))
        fuente.mascotas.add(Escenario.mascota("m2", "Mia", tipo = "Gato"))
        fuente.perfiles.add(Escenario.veterinario())
    }

    // ---------- Estado de la mascota ----------

    @Test
    fun estadoMascota_inactivaCancelaLosTurnosPendientesYDejaDeAgendarse() {
        fuente.turnos.add(Escenario.turno("t1", "m1", manana.toString(), "10:00:00"))
        ingresarComoDueno()
        val rex = DuenoRepo.buscarMascota("Rex")!!

        DuenoRepo.cambiarEstadoMascota(rex, EstadoMascota.INACTIVA)

        assertEquals(EstadoMascota.INACTIVA, rex.estado)
        assertEquals(listOf("Mia"), DuenoRepo.mascotasActivas.map { it.nombre })
        assertTrue(DuenoRepo.eventos.isEmpty())
        assertEquals("cancelado", fuente.turnos.first { it.id == "t1" }.estado)
        assertEquals("inactiva", fuente.mascotas.first { it.id == "m1" }.estado)
        // La mascota sigue en la cuenta: se conserva su historial
        assertNotNull(DuenoRepo.buscarMascota("Rex"))
    }

    @Test
    fun estadoMascota_fallecidaYVolverAActivar() {
        ingresarComoDueno()
        val mia = DuenoRepo.buscarMascota("Mia")!!

        DuenoRepo.cambiarEstadoMascota(mia, EstadoMascota.FALLECIDA)
        assertEquals("fallecida", fuente.mascotas.first { it.id == "m2" }.estado)
        assertEquals(1, DuenoRepo.mascotasActivas.size)

        DuenoRepo.cambiarEstadoMascota(mia, EstadoMascota.ACTIVA)
        assertEquals(2, DuenoRepo.mascotasActivas.size)
    }

    @Test
    fun estadoMascota_seLeeDelServidorAlCargar() {
        fuente.mascotas[0] = fuente.mascotas[0].copy(estado = "fallecida")
        ingresarComoDueno()

        assertEquals(EstadoMascota.FALLECIDA, DuenoRepo.buscarMascota("Rex")!!.estado)
        assertEquals(listOf("Mia"), DuenoRepo.mascotasActivas.map { it.nombre })
    }

    @Test
    fun baja_guardaElMotivoElegido() {
        ingresarComoDueno()

        DuenoRepo.darDeBajaMascota(DuenoRepo.buscarMascota("Rex")!!, "Adopción / Transferencia")

        val guardada = fuente.mascotas.first { it.id == "m1" }
        assertFalse(guardada.activa)
        assertEquals("Adopción / Transferencia", guardada.motivoBaja)
    }

    @Test
    fun salud_laListaDeDosisARecordarIncluyeLasDesparasitaciones() {
        val hoy = LocalDate.now()
        fuente.accesos.add(AccesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"))
        fuente.registros.add(
            frgp.utn.edu.petcare.data.remoto.RegistroSaludDto(
                "r1", "m1", "vacuna", "Rabia", null, hoy.minusDays(5).toString(), proximaDosis = hoy.minusDays(1).toString()
            )
        )
        fuente.registros.add(
            frgp.utn.edu.petcare.data.remoto.RegistroSaludDto(
                "r2", "m1", "desparasitacion", "Desparasitación interna", null, hoy.minusDays(80).toString(),
                proximaDosis = hoy.plusDays(3).toString()
            )
        )
        fuente.registros.add(
            frgp.utn.edu.petcare.data.remoto.RegistroSaludDto(
                "r3", "m1", "desparasitacion", "Desparasitación externa", null, hoy.toString(),
                proximaDosis = hoy.plusDays(90).toString()
            )
        )
        ingresarComoVeterinario()

        assertEquals(
            listOf("Rabia", "Desparasitación interna"),
            frgp.utn.edu.petcare.data.repositorio.SaludRepo.vacunasARecordar().map { it.titulo }
        )
    }

    // ---------- Permisos con vencimiento ----------

    @Test
    fun permisos_unoVencidoYaNoDaAcceso() {
        val ayer = LocalDate.now().minusDays(1).toString()
        fuente.accesos.add(AccesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno", venceEl = ayer))

        ingresarComoDueno()

        val vet = DuenoRepo.autorizados.single()
        assertEquals(EstadoAcceso.INACTIVO, vet.estado)
        assertTrue(vet.vencido)
        assertEquals(LocalDate.now().minusDays(1), vet.venceEl)
        assertTrue(vet.mascotas.isEmpty())
    }

    @Test
    fun permisos_conVencimientoFuturoSigueActivoYMuestraLaFecha() {
        val dentroDeUnMes = LocalDate.now().plusMonths(1)
        fuente.accesos.add(AccesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno", venceEl = dentroDeUnMes.toString()))

        ingresarComoDueno()

        val vet = DuenoRepo.autorizados.single()
        assertEquals(EstadoAcceso.ACTIVO, vet.estado)
        assertFalse(vet.vencido)
        assertEquals(dentroDeUnMes, vet.venceEl)
    }

    @Test
    fun permisos_autorizarConVencimientoLoMandaAlServidor() {
        ingresarComoDueno()
        val hasta = LocalDate.now().plusMonths(3)

        DuenoRepo.autorizarVeterinario(DuenoRepo.disponibles.first(), hasta)

        assertTrue(fuente.llamadas.any { it.endsWith(":$hasta") && it.startsWith("compartir:") })
        assertTrue(fuente.accesos.all { it.venceEl == hasta.toString() })
    }

    @Test
    fun permisos_cambiarYQuitarElVencimiento() {
        fuente.accesos.add(AccesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"))
        ingresarComoDueno()
        val vet = DuenoRepo.autorizados.single()
        val hasta = LocalDate.now().plusMonths(6)

        DuenoRepo.cambiarVencimiento(vet, hasta)
        assertEquals(hasta.toString(), fuente.accesos.single().venceEl)

        DuenoRepo.cambiarVencimiento(vet, null)
        assertNull(fuente.accesos.single().venceEl)
        assertNull(vet.venceEl)
    }

    @Test
    fun permisos_restablecerUnVencidoLoVuelveAActivar() {
        val ayer = LocalDate.now().minusDays(1).toString()
        fuente.accesos.add(AccesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno", venceEl = ayer))
        ingresarComoDueno()
        val vet = DuenoRepo.autorizados.single()

        DuenoRepo.restablecerAcceso(vet, null)

        assertEquals(EstadoAcceso.ACTIVO, vet.estado)
        assertFalse(vet.vencido)
        assertNull(fuente.accesos.single().venceEl)
    }

    // ---------- Informe cerrado ----------

    @Test
    fun informe_deHoyEsEditablePeroElDeOtroDiaQuedaCerrado() {
        fuente.informes.add(
            InformeDto("i-viejo", "m1", null, Escenario.VET_ID, "Control", "Sano", "Nada", createdAt = OffsetDateTime.now().minusDays(3).toString())
        )
        fuente.informes.add(
            InformeDto("i-hoy", "m2", null, Escenario.VET_ID, "Control", "Sano", "Nada", createdAt = OffsetDateTime.now().toString())
        )
        ingresarComoVeterinario()

        val viejo = runBlocking { InformesRepo.cargar("m1", null) }
        val deHoy = runBlocking { InformesRepo.cargar("m2", null) }

        assertFalse(viejo.editable)
        assertTrue(deHoy.editable)
    }

    @Test
    fun informe_cerradoNoSeModifica() {
        fuente.informes.add(
            InformeDto("i-viejo", "m1", null, Escenario.VET_ID, "Control", "Sano", "Nada", createdAt = OffsetDateTime.now().minusDays(3).toString())
        )
        ingresarComoVeterinario()
        runBlocking { InformesRepo.cargar("m1", null) }

        InformesRepo.guardar("m1", "Otro motivo", "Otro diagnóstico", "Otro tratamiento", null)

        assertEquals("Control", InformesRepo.obtener("m1").motivo)
        assertNull(fuente.ultimosCambiosDeInforme)
    }

    // ---------- Notificaciones ----------

    @Test
    fun notificaciones_unaSolaSeBorraSinTocarLasDemas() {
        val ahora = OffsetDateTime.now().toString()
        fuente.notificaciones.add(NotificacionDto("n1", "turno", "Uno", "Primero", false, ahora))
        fuente.notificaciones.add(NotificacionDto("n2", "turno", "Dos", "Segundo", false, ahora))
        ingresarComoDueno()
        val primera = DuenoRepo.notificaciones.first { it.id == "n1" }

        DuenoRepo.borrarNotificacion(primera)

        assertEquals(listOf("n2"), DuenoRepo.notificaciones.map { it.id })
        assertEquals(listOf("n2"), fuente.notificaciones.map { it.id })
        assertTrue(fuente.llamadas.contains("notificacionBorrada:n1"))
    }

    // ---------- Recordatorios hechos a mano ----------

    @Test
    fun recordatorios_elDuenoCreaEditaYBorra() {
        ingresarComoDueno()
        val dia = LocalDate.now().plusDays(5)

        val creado = RecordatoriosRepo.crear("m1", "Bañar a Rex", "Higiene", dia, "10:30", "Con shampoo suave")
        assertEquals(1, fuente.recordatoriosGuardados.size)
        assertEquals("10:30:00", fuente.recordatoriosGuardados.single().hora)
        assertEquals("higiene", fuente.recordatoriosGuardados.single().tipo)
        assertTrue(creado.esMio)

        RecordatoriosRepo.editar(creado, "Bañar y cepillar a Rex", "Higiene", dia.plusDays(1), null, "")
        assertEquals("Bañar y cepillar a Rex", fuente.recordatoriosGuardados.single().titulo)
        assertEquals(dia.plusDays(1).toString(), fuente.recordatoriosGuardados.single().fecha)

        RecordatoriosRepo.borrar(creado)
        assertTrue(fuente.recordatoriosGuardados.isEmpty())
        assertTrue(RecordatoriosRepo.lista.isEmpty())
    }

    @Test
    fun recordatorios_elDuenoVeLosDelVeterinarioPeroNoLosPuedeTocar() {
        fuente.recordatoriosGuardados.add(
            frgp.utn.edu.petcare.data.remoto.RecordatorioDto(
                "r1", "m1", Escenario.VET_ID, "Control de peso", "control", LocalDate.now().plusDays(10).toString()
            )
        )
        ingresarComoDueno()

        val delVeterinario = RecordatoriosRepo.lista.single()
        assertFalse(delVeterinario.esMio)

        RecordatoriosRepo.borrar(delVeterinario)
        RecordatoriosRepo.editar(delVeterinario, "Otro", "Otro", LocalDate.now(), null, "")

        assertEquals("Control de peso", RecordatoriosRepo.lista.single().titulo)
        assertEquals(1, fuente.recordatoriosGuardados.size)
    }

    @Test
    fun recordatorios_elVeterinarioLeDejaUnoAlPaciente() {
        ingresarComoVeterinario()
        fuente.accesos.add(AccesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"))

        RecordatoriosRepo.crear("m1", "Repetir análisis", "Control", LocalDate.now().plusDays(7), null, "Ayuno de 8 horas")

        val guardado = fuente.recordatoriosGuardados.single()
        assertEquals(Escenario.VET_ID, guardado.creadoPor)
        assertEquals("m1", guardado.mascotaId)
        assertEquals("Repetir análisis", RecordatoriosRepo.deMascota("m1").single().titulo)
    }

    @Test
    fun recordatorios_avisanElDiaYLaHoraElegidos() {
        val ahora = LocalDateTime.of(2026, 5, 1, 8, 0)
        val avisos = Recordatorios.paraManuales(
            listOf(
                Recordatorios.Manual("a", "Rex", "Baño", LocalDate.of(2026, 5, 2), "10:30", "Con shampoo"),
                Recordatorios.Manual("b", "Mia", "Vacuna", LocalDate.of(2026, 5, 3), null, ""),
                Recordatorios.Manual("c", "Rex", "Pasado", LocalDate.of(2026, 4, 1), null, "")
            ),
            ahora
        )

        assertEquals(2, avisos.size)
        assertEquals(LocalDateTime.of(2026, 5, 2, 10, 30), avisos[0].momento)
        assertEquals(LocalDateTime.of(2026, 5, 3, 9, 0), avisos[1].momento)
        assertEquals("Recordatorio: Baño", avisos[0].titulo)
        assertEquals("Rex · Con shampoo", avisos[0].mensaje)
    }
}
