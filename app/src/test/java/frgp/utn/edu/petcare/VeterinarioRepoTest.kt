package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.data.remoto.AccesoDto
import frgp.utn.edu.petcare.data.remoto.InformeDto
import frgp.utn.edu.petcare.data.remoto.RegistroSaludDto
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.TemporalAdjusters

class VeterinarioRepoTest : PruebaBase() {

    private val hoy = LocalDate.now()

    @Before
    fun cargarEscenario() {
        fuente.perfiles.add(Escenario.dueno())
        fuente.mascotas.add(Escenario.mascota("m1", "Rex"))
        fuente.mascotas.add(Escenario.mascota("m2", "Mia", tipo = "Gato"))
        fuente.mascotas.add(Escenario.mascota("m3", "Sin acceso"))
        fuente.mascotas.add(Escenario.mascota("m4", "Loro", tipo = "Ave"))
        fuente.accesos.add(AccesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"))
        fuente.accesos.add(AccesoDto("a2", "m2", Escenario.VET_ID, "activo", "dueno"))
        fuente.accesos.add(AccesoDto("a4", "m4", Escenario.VET_ID, "activo", "dueno"))
        fuente.accesos.add(AccesoDto("a3", "m3", Escenario.VET_ID, "pendiente", "veterinario"))
    }

    // ---------- Pacientes ----------

    @Test
    fun pacientes_soloLosQueTienenAccesoActivo() {
        ingresarComoVeterinario()

        assertEquals(listOf("Rex", "Mia", "Loro"), PacientesRepo.pacientes.map { it.nombre })
        assertNull(PacientesRepo.porId("m3"))
        assertEquals("Mascota", PacientesRepo.nombreDe("inexistente"))
    }

    @Test
    fun pacientes_filtraPorEspecieYBusqueda() {
        ingresarComoVeterinario()

        assertEquals(listOf("Mia"), PacientesRepo.filtrar("", PacientesRepo.ESPECIE_GATO).map { it.nombre })
        assertEquals(listOf("Loro"), PacientesRepo.filtrar("", PacientesRepo.ESPECIE_OTRO).map { it.nombre })
        assertEquals(1, PacientesRepo.filtrar("rex", null).size)
        assertEquals(3, PacientesRepo.filtrar("mestizo", null).size)
        assertTrue(PacientesRepo.filtrar("zzz", null).isEmpty())
    }

    @Test
    fun pacientes_traenLosDatosDelDuenoYLaMascota() {
        ingresarComoVeterinario()

        val rex = PacientesRepo.porId("m1")!!
        assertEquals("Macho", rex.sexo)
        assertEquals("12 kg", rex.peso)
        assertTrue(rex.nacimiento.startsWith("15 Mar 2020"))
    }

    @Test
    fun agregarManual_creaLaMascotaConLosDatosDelPropietario() {
        ingresarComoVeterinario()

        val nuevo = PacientesRepo.agregarManual("Toby", "Perro", "", "Macho", "Carlos Gómez", "1144443333")

        assertNotNull(PacientesRepo.porId(nuevo.id))
        assertEquals("Perro", nuevo.raza)
        assertTrue(fuente.llamadas.contains("crearMascota:Toby"))
        assertEquals("Carlos Gómez", fuente.mascotas.last().propietarioNombre)
    }

    // ---------- Agenda ----------

    @Test
    fun agenda_agregarCreaElTurnoPropioYLoOrdena() {
        ingresarComoVeterinario()

        val turno = AgendaRepo.agregar("m1", "Vacuna", "Refuerzo", hoy.plusDays(1), "10:00", EstadoEvento.PENDIENTE, "")
        AgendaRepo.agregar("m2", "Control", "Control", hoy.plusDays(1), "09:00", EstadoEvento.PENDIENTE, "")

        assertEquals(Escenario.VET_ID, fuente.turnos[0].veterinarioId)
        assertEquals("Refuerzo", fuente.turnos[0].motivo)
        assertEquals(listOf("09:00", "10:00"), AgendaRepo.proximos().map { it.hora })
        assertEquals(turno, AgendaRepo.proximoEvento("m1"))
    }

    @Test
    fun agenda_cambiarEstadoYGuardarCambios() {
        fuente.turnos.add(Escenario.turno("t1", "m1", hoy.toString(), "10:00:00"))
        ingresarComoVeterinario()
        val turno = AgendaRepo.porId("t1")!!

        AgendaRepo.cambiarEstado(turno, EstadoEvento.COMPLETADO)
        assertEquals("completado", fuente.turnos[0].estado)
        assertTrue(AgendaRepo.deHoy().isEmpty())
        assertEquals(turno, AgendaRepo.ultimaConsulta("m1"))

        turno.motivo = "Otro motivo"
        turno.hora = "11:30"
        AgendaRepo.guardar(turno)
        assertTrue(fuente.llamadas.any { it.startsWith("turno:t1:") && it.contains("hora=11:30:00") && it.contains("motivo=Otro motivo") })
    }

    @Test
    fun agenda_elMotivoVacioMuestraLaCategoria() {
        fuente.turnos.add(Escenario.turno("t1", "m1", hoy.toString(), "10:00:00"))
        ingresarComoVeterinario()

        assertEquals("Control", AgendaRepo.porId("t1")!!.motivo)
        assertEquals(1, AgendaRepo.pacientesHoy())
    }

    @Test
    fun agenda_pacientesHoyCuentaLosYaAtendidosPeroNoLosCancelados() {
        fuente.turnos.add(Escenario.turno("t1", "m1", hoy.toString(), "10:00:00", estado = "completado"))
        fuente.turnos.add(Escenario.turno("t2", "m2", hoy.toString(), "11:00:00"))
        fuente.turnos.add(Escenario.turno("t3", "m4", hoy.toString(), "12:00:00", estado = "cancelado"))
        ingresarComoVeterinario()

        assertEquals(2, AgendaRepo.pacientesHoy())
        assertEquals(1, AgendaRepo.deHoy().size)
    }

    // ---------- Disponibilidad ----------

    private fun proximoLunes() = hoy.with(TemporalAdjusters.next(DayOfWeek.MONDAY))

    @Test
    fun disponibilidad_validaDiaHorarioYSuperposicion() {
        fuente.turnos.add(Escenario.turno("t1", "m1", proximoLunes().toString(), "10:00:00"))
        ingresarComoVeterinario()
        val lunes = proximoLunes()

        assertNull(DisponibilidadVet.validar(lunes, "09:00"))
        assertEquals("No podés seleccionar una fecha que ya pasó", DisponibilidadVet.validar(hoy.minusDays(1), "09:00"))
        assertTrue(DisponibilidadVet.validar(lunes.plusDays(5), "09:00")!!.startsWith("No atendés"))
        assertTrue(DisponibilidadVet.validar(lunes, "13:00")!!.contains("fuera de tu atención"))
        assertEquals("Ya tenés un turno en ese horario", DisponibilidadVet.validar(lunes, "10:00"))
        assertEquals("Ya tenés un turno en ese horario", DisponibilidadVet.validar(lunes, "10:15"))
        assertNull(DisponibilidadVet.validar(lunes, "10:00", "t1"))
    }

    @Test
    fun disponibilidad_listaLosHorariosDeLaFranjaMarcandoLosOcupados() {
        fuente.turnos.add(Escenario.turno("t1", "m1", proximoLunes().toString(), "09:30:00"))
        ingresarComoVeterinario()

        val horarios = DisponibilidadVet.horarios(proximoLunes())

        assertEquals(6, horarios.size)
        assertEquals("09:00", horarios.first().hora)
        assertFalse(horarios.first { it.hora == "09:30" }.libre)
        assertTrue(horarios.first { it.hora == "10:00" }.libre)
        assertTrue(DisponibilidadVet.horarios(proximoLunes().plusDays(5)).isEmpty())
    }

    // ---------- Carnet de salud ----------

    @Test
    fun salud_calculaElEstadoDeVacunasYTratamientos() {
        fun registro(id: String, tipo: String, titulo: String, fecha: LocalDate, fin: LocalDate? = null, proxima: LocalDate? = null) =
            RegistroSaludDto(id, "m1", tipo, titulo, null, fecha.toString(), fin?.toString(), proxima?.toString())
        fuente.registros.add(registro("r1", "vacuna", "Rabia", hoy.minusDays(300), proxima = hoy.plusDays(60)))
        fuente.registros.add(registro("r2", "vacuna", "Triple", hoy.minusDays(300), proxima = hoy.plusDays(10)))
        fuente.registros.add(registro("r3", "vacuna", "Parvo", hoy.minusDays(400), proxima = hoy.minusDays(5)))
        fuente.registros.add(registro("r4", "tratamiento", "Antibiótico", hoy.minusDays(10), fin = hoy.minusDays(3)))
        fuente.registros.add(registro("r5", "tratamiento", "Dieta", hoy.minusDays(2)))
        ingresarComoVeterinario()

        fun estado(id: String) = SaludRepo.registros.first { it.id == id }.estado
        assertEquals("Al día", estado("r1"))
        assertEquals("Próxima", estado("r2"))
        assertEquals("Vencida", estado("r3"))
        assertEquals("Finalizado", estado("r4"))
        assertEquals("Activo", estado("r5"))
        assertEquals("Rex", SaludRepo.registros.first().mascota)
        assertEquals(3, SaludRepo.filtrar(TipoRegistro.VACUNA, "", "m1").size)
        assertEquals(1, SaludRepo.filtrar(TipoRegistro.TRATAMIENTO, "dieta", null).size)
    }

    @Test
    fun salud_agregarYEliminar() {
        ingresarComoVeterinario()

        val registro = SaludRepo.agregar(TipoRegistro.VACUNA, "m1", "Rabia", null, hoy, proximaDosis = hoy.plusDays(365))
        assertTrue(fuente.llamadas.contains("crearRegistro:vacuna:Rabia"))
        assertEquals(1, SaludRepo.filtrar(TipoRegistro.VACUNA, "", null).size)

        SaludRepo.eliminar(registro)
        assertTrue(SaludRepo.registros.isEmpty())
        assertTrue(fuente.llamadas.any { it.startsWith("eliminarRegistro:") })
    }

    // ---------- Solicitudes ----------

    @Test
    fun solicitudes_listaLasQueEnviaronLosDuenos() {
        fuente.accesos.add(AccesoDto("a9", "m3", Escenario.VET_ID, "pendiente", "dueno", createdAt = "2026-01-01T10:00:00+00:00"))
        ingresarComoVeterinario()

        assertEquals(1, SolicitudesRepo.pendientesVeterinario())
        assertEquals("Quiere compartir a Sin acceso", SolicitudesRepo.paraVeterinario[0].mascota)
    }

    @Test
    fun solicitudes_aceptarSumaLaMascotaALosPacientes() {
        fuente.accesos.add(AccesoDto("a9", "m3", Escenario.VET_ID, "pendiente", "dueno"))
        ingresarComoVeterinario()
        assertNull(PacientesRepo.porId("m3"))

        SolicitudesRepo.resolver(SolicitudesRepo.paraVeterinario[0], aceptar = true)

        assertEquals("activo", fuente.accesos.first { it.id == "a9" }.estado)
        assertNotNull(PacientesRepo.porId("m3"))
    }

    // ---------- Informes y archivos ----------

    @Test
    fun informes_seCreanUnaVezYDespuesSeActualizan() {
        ingresarComoVeterinario()

        InformesRepo.guardar("m1", "Picazón", "Alergia", "Antihistamínico")
        assertTrue(fuente.llamadas.contains("crearInforme:m1"))

        InformesRepo.guardar("m1", "Picazón", "Alergia leve", "Antihistamínico")
        assertTrue(fuente.llamadas.any { it.startsWith("actualizarInforme:") })
        assertEquals("Alergia leve", InformesRepo.obtener("m1").diagnostico)
    }

    @Test
    fun informes_cargaElUltimoInformePropio() {
        fuente.informes.add(InformeDto("i1", "m1", null, "otro-vet", "Ajeno", "x", "y"))
        fuente.informes.add(InformeDto("i2", "m1", null, Escenario.VET_ID, "Propio", "Dx", "Tx"))
        ingresarComoVeterinario()

        val informe = runBlocking { InformesRepo.cargar("m1") }

        assertEquals("Propio", informe.motivo)
        assertEquals("i2", informe.id)
    }

    @Test
    fun archivos_subirRegistraElArchivoEnLaFicha() {
        ingresarComoVeterinario()

        val item = runBlocking { ArchivosRepo.agregar("m1", "Radiografía", "pdf", ByteArray(10), "application/pdf") }

        assertEquals(1, fuente.subidas.size)
        assertTrue(fuente.subidas[0].startsWith("archivos/m1/"))
        assertEquals("PDF", item.tipoExtension)
        assertEquals(listOf(item), ArchivosRepo.dePaciente("m1"))

        ArchivosRepo.renombrar(item, "Rx de tórax")
        assertEquals("Rx de tórax", ArchivosRepo.dePaciente("m1")[0].nombre)
        ArchivosRepo.eliminar(ArchivosRepo.dePaciente("m1")[0])
        assertTrue(ArchivosRepo.dePaciente("m1").isEmpty())
    }

    @Test
    fun archivos_adjuntadosAlInformeQuedanLigadosAlTurno() {
        fuente.turnos.add(Escenario.turno("t1", "m1", hoy.toString(), "10:00:00"))
        ingresarComoVeterinario()

        runBlocking {
            ArchivosRepo.agregar("m1", "Estudio", "pdf", ByteArray(5), "application/pdf", turnoId = "t1")
            ArchivosRepo.agregar("m1", "Suelto", "pdf", ByteArray(5), "application/pdf")
            ArchivosRepo.cargar("m1")
        }

        assertEquals(listOf("Estudio"), ArchivosRepo.deTurno("m1", "t1").map { it.nombre })
        assertEquals(2, ArchivosRepo.dePaciente("m1").size)
        assertEquals("t1", fuente.archivos.first { it.nombre == "Estudio" }.turnoId)
    }

    // ---------- Perfil ----------

    @Test
    fun perfil_guardaHorariosEspecialidadesYPreferencias() {
        ingresarComoVeterinario()

        PerfilVetRepo.diasSeleccionados[5] = true
        PerfilVetRepo.horaCierre = "14:00"
        PerfilVetRepo.guardarHorarios()
        PerfilVetRepo.especialidadesSeleccionadas[3] = true
        PerfilVetRepo.guardarEspecialidades()
        PerfilVetRepo.preferencias["notif_turnos"] = false
        PerfilVetRepo.guardarPreferencias()

        assertTrue(fuente.llamadas.contains("veterinario:dias_atencion,hora_apertura,hora_cierre"))
        assertTrue(fuente.llamadas.contains("veterinario:especialidades"))
        assertTrue(fuente.llamadas.contains("perfil:preferencias"))
        assertFalse(PerfilVetRepo.preferencia("notif_turnos"))
        assertTrue(PerfilVetRepo.preferencia("notif_solicitudes"))
        assertTrue(PerfilVetRepo.textoHorarios().contains("Sábado"))
        assertTrue(PerfilVetRepo.textoEspecialidades().contains("Dermatología"))
    }
}
