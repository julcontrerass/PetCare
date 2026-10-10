package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.data.DuenoRepo
import frgp.utn.edu.petcare.data.remoto.AccesoDto
import frgp.utn.edu.petcare.data.remoto.NotificacionDto
import frgp.utn.edu.petcare.model.EstadoAcceso
import frgp.utn.edu.petcare.model.Mascota
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.time.LocalDate

class DuenoRepoTest : PruebaBase() {

    private val manana = LocalDate.now().plusDays(1)

    @Before
    fun cargarEscenario() {
        fuente.mascotas.add(Escenario.mascota("m1", "Rex"))
        fuente.mascotas.add(Escenario.mascota("m2", "Mia", tipo = "Gato"))
        fuente.perfiles.add(Escenario.veterinario())
    }

    @Test
    fun cargar_armaMascotasYTurnosSinLosCancelados() {
        fuente.turnos.add(Escenario.turno("t1", "m1", manana.toString(), "10:00:00"))
        fuente.turnos.add(Escenario.turno("t2", "m2", manana.toString(), "11:00:00", estado = "cancelado"))

        ingresarComoDueno()

        assertEquals(listOf("Rex", "Mia"), DuenoRepo.mascotas.map { it.nombre })
        assertEquals(1, DuenoRepo.eventos.size)
        val turno = DuenoRepo.eventos[0]
        assertEquals("Rex", turno.mascota)
        assertEquals("Dr. Vera", turno.veterinario)
        assertEquals("10:00", turno.hora)
    }

    @Test
    fun veterinarios_seClasificanSegunSusAccesos() {
        fuente.perfiles.add(Escenario.veterinario("vet-2", "Dra. Sosa"))
        fuente.perfiles.add(Escenario.veterinario("vet-3", "Dr. Pendiente"))
        fuente.perfiles.add(Escenario.veterinario("vet-4", "Dr. Suspendido", estado = "suspendido"))
        fuente.accesos.add(AccesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"))
        fuente.accesos.add(AccesoDto("a2", "m1", "vet-3", "pendiente", "veterinario", createdAt = "2026-01-01T10:00:00+00:00"))
        fuente.accesos.add(AccesoDto("a3", "m1", "vet-4", "activo", "dueno"))

        ingresarComoDueno()

        assertEquals(listOf("Dr. Vera"), DuenoRepo.autorizados.map { it.nombre })
        assertEquals(EstadoAcceso.ACTIVO, DuenoRepo.autorizados[0].estado)
        assertEquals(listOf("Rex"), DuenoRepo.autorizados[0].mascotas.toList())
        // Quien pidió acceso aparece como solicitud, no como veterinario disponible
        assertEquals(listOf("Dra. Sosa"), DuenoRepo.disponibles.map { it.nombre })
        assertEquals(1, DuenoRepo.solicitudes.size)
        assertEquals("Dr. Pendiente", DuenoRepo.solicitudes[0].solicitante)
        assertTrue(DuenoRepo.solicitudes[0].mascota.contains("Rex"))
    }

    @Test
    fun agregarMascota_seVeEnseguidaYSeMandaAlServidor() {
        ingresarComoDueno()

        DuenoRepo.agregarMascota(Mascota(nombre = "Luna", tipo = "Gato", raza = "Siamés"))

        assertNotNull(DuenoRepo.buscarMascota("Luna"))
        assertTrue(fuente.llamadas.contains("crearMascota:Luna"))
        assertTrue(fuente.mascotas.any { it.nombre == "Luna" && it.duenoId == Escenario.DUENO_ID })
    }

    @Test
    fun darDeBajaMascota_laSacaDeLaListaYBorraSusTurnos() {
        fuente.turnos.add(Escenario.turno("t1", "m1", manana.toString(), "10:00:00"))
        ingresarComoDueno()

        DuenoRepo.darDeBajaMascota(DuenoRepo.buscarMascota("Rex")!!)

        assertNull(DuenoRepo.buscarMascota("Rex"))
        assertTrue(DuenoRepo.eventos.isEmpty())
        assertFalse(fuente.mascotas.first { it.id == "m1" }.activa)
    }

    @Test
    fun agendarEvento_creaElTurnoYElVeterinarioPasaATenerAcceso() {
        ingresarComoDueno()
        assertEquals(EstadoAcceso.DISPONIBLE, DuenoRepo.todosLosVeterinarios().first().estado)

        DuenoRepo.agendarEvento(manana, "Control", "Rex", "Dr. Vera", "10:00", "Traer carnet")

        assertEquals(1, DuenoRepo.eventos.size)
        assertEquals(1, fuente.turnos.size)
        assertEquals("10:00:00", fuente.turnos[0].hora)
        assertEquals(Escenario.VET_ID, fuente.turnos[0].veterinarioId)
        assertEquals("Traer carnet", fuente.turnos[0].notas)
        assertEquals(listOf("Dr. Vera"), DuenoRepo.autorizados.map { it.nombre })
        assertTrue(DuenoRepo.disponibles.isEmpty())
    }

    @Test
    fun hayConflictoDeTurno_soloParaLaMismaMascotaYHora() {
        ingresarComoDueno()
        DuenoRepo.agendarEvento(manana, "Control", "Rex", "Dr. Vera", "10:00", "")

        assertTrue(DuenoRepo.hayConflictoDeTurno(manana, "10:00", "Rex"))
        assertFalse(DuenoRepo.hayConflictoDeTurno(manana, "11:00", "Rex"))
        assertFalse(DuenoRepo.hayConflictoDeTurno(manana, "10:00", "Mia"))
    }

    @Test
    fun cancelarEvento_loSacaDeLaListaYLoCancelaEnElServidor() {
        fuente.turnos.add(Escenario.turno("t1", "m1", manana.toString(), "10:00:00"))
        ingresarComoDueno()

        DuenoRepo.cancelarEvento(DuenoRepo.eventos[0])

        assertTrue(DuenoRepo.eventos.isEmpty())
        assertEquals("cancelado", fuente.turnos[0].estado)
    }

    @Test
    fun modificarEvento_cambiaFechaHoraYVeterinario() {
        fuente.turnos.add(Escenario.turno("t1", "m1", manana.toString(), "10:00:00", vet = null))
        ingresarComoDueno()
        val pasado = manana.plusDays(2)

        DuenoRepo.modificarEvento(DuenoRepo.eventos[0], pasado, "11:30", "Dr. Vera", "Cambio")

        val evento = DuenoRepo.eventos[0]
        assertEquals(pasado, evento.fecha)
        assertEquals("11:30", evento.hora)
        assertEquals(Escenario.VET_ID, evento.veterinarioId)
        assertTrue(fuente.llamadas.any { it.startsWith("turno:t1:") && it.contains("hora=11:30:00") })
    }

    @Test
    fun revocarYRestablecerAcceso_actualizanTodosLosAccesosDelVeterinario() {
        fuente.accesos.add(AccesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"))
        fuente.accesos.add(AccesoDto("a2", "m2", Escenario.VET_ID, "activo", "dueno"))
        ingresarComoDueno()
        val vet = DuenoRepo.autorizados[0]

        DuenoRepo.revocarAcceso(vet)
        assertEquals(EstadoAcceso.INACTIVO, DuenoRepo.autorizados[0].estado)
        assertTrue(fuente.accesos.all { it.estado == "inactivo" })

        DuenoRepo.restablecerAcceso(DuenoRepo.autorizados[0])
        assertEquals(EstadoAcceso.ACTIVO, DuenoRepo.autorizados[0].estado)
        assertTrue(fuente.accesos.all { it.estado == "activo" })
    }

    @Test
    fun autorizarVeterinario_comparteTodasLasMascotas() {
        ingresarComoDueno()
        val candidato = DuenoRepo.candidatosAAutorizar("vera").single()

        DuenoRepo.autorizarVeterinario(candidato)

        assertEquals(2, fuente.accesos.count { it.veterinarioId == Escenario.VET_ID && it.estado == "activo" })
        assertEquals(listOf("Dr. Vera"), DuenoRepo.autorizados.map { it.nombre })
        assertTrue(DuenoRepo.candidatosAAutorizar("").isEmpty())
    }

    @Test
    fun resolverSolicitud_aceptaORechazaEnElServidor() {
        fuente.accesos.add(AccesoDto("a1", "m1", Escenario.VET_ID, "pendiente", "veterinario"))
        fuente.accesos.add(AccesoDto("a2", "m2", Escenario.VET_ID, "pendiente", "veterinario"))
        ingresarComoDueno()
        assertEquals(2, DuenoRepo.solicitudes.size)

        val (primera, segunda) = DuenoRepo.solicitudes.toList()
        DuenoRepo.resolverSolicitud(primera, aceptar = true)
        DuenoRepo.resolverSolicitud(segunda, aceptar = false)

        assertEquals("activo", fuente.accesos.first { it.id == "a1" }.estado)
        assertEquals("rechazado", fuente.accesos.first { it.id == "a2" }.estado)
    }

    @Test
    fun notificaciones_seMarcanComoLeidasYSeBorran() {
        fuente.notificaciones.add(NotificacionDto("n1", "turno", "Turno nuevo", "Mañana 10:00", false, "2026-01-01T10:00:00+00:00"))
        ingresarComoDueno()
        assertTrue(DuenoRepo.hayNotificacionesSinLeer)

        DuenoRepo.marcarNotificacionesLeidas()
        assertFalse(DuenoRepo.hayNotificacionesSinLeer)
        assertTrue(fuente.llamadas.contains("notificacionesLeidas"))

        DuenoRepo.limpiarNotificaciones()
        assertTrue(DuenoRepo.notificaciones.isEmpty())
    }

    @Test
    fun notificaciones_elTurnoFinalizadoTieneSuPropioTipo() {
        fuente.notificaciones.add(
            NotificacionDto("n1", "completado", "Turno finalizado", "Rex: el turno fue completado", false, "2026-01-01T10:00:00+00:00")
        )
        fuente.notificaciones.add(NotificacionDto("n2", "turno", "Nuevo turno", "Rex", false, "2026-01-01T09:00:00+00:00"))
        ingresarComoDueno()

        assertEquals(
            listOf(frgp.utn.edu.petcare.model.TipoNotificacion.COMPLETADO, frgp.utn.edu.petcare.model.TipoNotificacion.TURNO),
            DuenoRepo.notificaciones.map { it.tipo }
        )
    }

    @Test
    fun guardarPerfil_actualizaLaCopiaYElServidor() {
        ingresarComoDueno()

        DuenoRepo.guardarPerfil("Ana María Prueba", "1166667777", "Otra calle 5")

        assertEquals("Ana María Prueba", DuenoRepo.perfil.nombre)
        assertEquals("Ana", DuenoRepo.perfil.primerNombre)
        assertTrue(fuente.llamadas.contains("perfil:direccion,nombre,telefono"))
    }

    @Test
    fun guardarMascota_actualizaElNombreEnSusTurnos() {
        fuente.turnos.add(Escenario.turno("t1", "m1", manana.toString(), "10:00:00"))
        ingresarComoDueno()
        val rex = DuenoRepo.buscarMascota("Rex")!!

        rex.nombre = "Rexy"
        DuenoRepo.guardarMascota(rex)

        assertEquals("Rexy", DuenoRepo.eventos[0].mascota)
        assertTrue(fuente.llamadas.any { it.startsWith("mascota:m1:") })
    }

    @Test
    fun horasDe_ofreceTurnosCadaMediaHoraSoloLosDiasDeAtencion() {
        ingresarComoDueno()
        val vet = DuenoRepo.todosLosVeterinarios().first()
        val lunes = LocalDate.now().with(java.time.temporal.TemporalAdjusters.next(java.time.DayOfWeek.MONDAY))
        val domingo = lunes.plusDays(6)

        assertEquals(listOf("09:00", "09:30", "10:00", "10:30", "11:00", "11:30"), DuenoRepo.horasDe(vet, lunes))
        assertTrue(DuenoRepo.horasDe(vet, domingo).isEmpty())
        assertFalse(DuenoRepo.trabajaEl(vet, domingo))
    }

    @Test
    fun horasOcupadas_vienenDelServidor() {
        ingresarComoDueno()
        fuente.ocupados = listOf("09:30", "10:00")

        val ocupadas = runBlocking { DuenoRepo.horasOcupadas(DuenoRepo.todosLosVeterinarios().first(), manana) }

        assertEquals(setOf("09:30", "10:00"), ocupadas)
    }

    @Test
    fun veterinariosPara_prefiereLosQueTienenLaEspecialidad() {
        fuente.perfiles.add(
            Escenario.perfil(
                "vet-9", "veterinario", "Dr. Cirujano",
                veterinario = frgp.utn.edu.petcare.data.remoto.VeterinarioDto(
                    matricula = "MP-9", especialidades = listOf("Cirugía Veterinaria")
                )
            )
        )
        ingresarComoDueno()

        assertEquals(listOf("Dr. Cirujano"), DuenoRepo.veterinariosPara("Cirugía").map { it.nombre })
        assertEquals(listOf("Dr. Vera"), DuenoRepo.veterinariosPara("Vacuna").map { it.nombre })
        // Sin nadie con esa especialidad se ofrecen todos
        assertEquals(2, DuenoRepo.veterinariosPara("Estudio / Tratamiento").size)
    }

    @Test
    fun informeDelTurno_elDuenoLeeDiagnosticoYTratamiento() {
        fuente.turnos.add(Escenario.turno("t1", "m1", LocalDate.now().toString(), "10:00:00", estado = "completado"))
        fuente.informes.add(
            frgp.utn.edu.petcare.data.remoto.InformeDto("i1", "m1", "t1", Escenario.VET_ID, "Control", "Otitis", "Gotas")
        )
        ingresarComoDueno()

        val detalle = runBlocking { DuenoRepo.detalleDelTurno(DuenoRepo.eventos[0]) }

        assertEquals("Otitis", detalle.diagnostico)
        assertEquals("Gotas", detalle.tratamiento)
        assertEquals("Control", detalle.motivo)
        assertEquals(frgp.utn.edu.petcare.model.EstadoTurno.COMPLETADO, DuenoRepo.eventos[0].estado)
    }

    @Test
    fun informeDelTurno_sinInformeDevuelveNull() {
        fuente.turnos.add(Escenario.turno("t1", "m1", LocalDate.now().toString(), "10:00:00"))
        ingresarComoDueno()

        assertTrue(runBlocking { DuenoRepo.detalleDelTurno(DuenoRepo.eventos[0]) }.vacio)
    }

    @Test
    fun detalleDelTurno_incluyeLosRegistrosYArchivosQueCargoElVeterinarioEseDia() {
        val hoy = LocalDate.now()
        fuente.turnos.add(Escenario.turno("t1", "m1", hoy.toString(), "10:00:00", estado = "completado"))
        fuente.registros.add(
            frgp.utn.edu.petcare.data.remoto.RegistroSaludDto(
                "r1", "m1", "vacuna", "Rabia", null, hoy.toString(), creadoPor = Escenario.VET_ID
            )
        )
        fuente.registros.add(
            frgp.utn.edu.petcare.data.remoto.RegistroSaludDto(
                "r2", "m1", "vacuna", "De otro día", null, hoy.minusDays(40).toString(), creadoPor = Escenario.VET_ID
            )
        )
        val ahora = java.time.OffsetDateTime.now().toString()
        fuente.archivos.add(
            frgp.utn.edu.petcare.data.remoto.ArchivoDto(
                "a1", "m1", "Radiografía", "pdf", "m1/a1.pdf", subidoPor = Escenario.VET_ID, turnoId = "t1", createdAt = ahora
            )
        )
        // Subido el mismo día por el mismo veterinario, pero suelto en la ficha: no es de este turno
        fuente.archivos.add(
            frgp.utn.edu.petcare.data.remoto.ArchivoDto(
                "a2", "m1", "Suelto", "pdf", "m1/a2.pdf", subidoPor = Escenario.VET_ID, createdAt = ahora
            )
        )
        // Adjunto a otro turno
        fuente.archivos.add(
            frgp.utn.edu.petcare.data.remoto.ArchivoDto(
                "a3", "m1", "De otro turno", "pdf", "m1/a3.pdf", subidoPor = Escenario.VET_ID, turnoId = "t9", createdAt = ahora
            )
        )
        ingresarComoDueno()

        val detalle = runBlocking { DuenoRepo.detalleDelTurno(DuenoRepo.eventos[0]) }

        assertEquals(listOf("Vacuna: Rabia"), detalle.registros)
        assertEquals(listOf("Radiografía.pdf"), detalle.archivos.map { it.nombre })
        assertFalse(detalle.vacio)
    }

    @Test
    fun turnoCompletado_dejaDeSerProximoAunqueSeaDeHoy() {
        val hoy = LocalDate.now()
        fuente.turnos.add(Escenario.turno("t1", "m1", hoy.toString(), "23:00:00", estado = "completado"))
        fuente.turnos.add(Escenario.turno("t2", "m1", hoy.toString(), "23:30:00"))
        ingresarComoDueno()

        assertEquals(listOf("t2"), DuenoRepo.eventosOrdenados(proximos = true).map { it.id })
        assertEquals(listOf("t1"), DuenoRepo.eventosOrdenados(proximos = false).map { it.id })
        assertEquals("23:30", DuenoRepo.proximoEvento("Rex")!!.hora)
    }

    @Test
    fun cambiosEnVivo_unTurnoNuevoDelServidorApareceSinTocarNada() {
        ingresarComoDueno()
        assertTrue(DuenoRepo.eventos.isEmpty())

        // Otro dispositivo (o el veterinario) agenda un turno y el servidor avisa
        fuente.turnos.add(Escenario.turno("t9", "m1", LocalDate.now().plusDays(2).toString(), "10:00:00"))
        fuente.avisosDelServidor.tryEmit(Unit)
        org.robolectric.shadows.ShadowLooper.idleMainLooper(2, java.util.concurrent.TimeUnit.SECONDS)

        assertEquals(1, DuenoRepo.eventos.size)
        assertEquals("t9", DuenoRepo.eventos[0].id)
    }

    @Test
    fun carnetDelDueno_cargaSusRegistrosYLosArchivosDeLasConsultas() {
        val hoy = LocalDate.now()
        fuente.registros.add(
            frgp.utn.edu.petcare.data.remoto.RegistroSaludDto(
                "r1", "m1", "vacuna", "Rabia", null, hoy.toString(), proximaDosis = hoy.plusDays(300).toString()
            )
        )
        fuente.archivos.add(
            frgp.utn.edu.petcare.data.remoto.ArchivoDto(
                "a1", "m1", "Radiografía", "pdf", "m1/a1.pdf", subidoPor = Escenario.VET_ID, turnoId = "t1",
                createdAt = java.time.OffsetDateTime.now().toString()
            )
        )
        ingresarComoDueno()

        runBlocking { frgp.utn.edu.petcare.SaludRepo.cargarComoDueno() }

        val vacunas = frgp.utn.edu.petcare.SaludRepo.filtrar(frgp.utn.edu.petcare.TipoRegistro.VACUNA, "", null)
        val documentos = frgp.utn.edu.petcare.SaludRepo.filtrar(frgp.utn.edu.petcare.TipoRegistro.DOCUMENTO, "", null)
        assertEquals(listOf("Rabia"), vacunas.map { it.titulo })
        assertEquals("Rex", vacunas[0].mascota)
        assertEquals(listOf("Radiografía"), documentos.map { it.titulo })
        assertEquals("m1/a1.pdf", documentos[0].archivoPath)
    }

    @Test
    fun estudiosPrevios_seEligenOSeSubenYSeAdjuntanAlTurno() {
        fuente.registros.add(
            frgp.utn.edu.petcare.data.remoto.RegistroSaludDto(
                "r1", "m1", "documento", "Análisis de sangre", null, LocalDate.now().minusDays(30).toString(),
                archivoPath = "m1/analisis.pdf"
            )
        )
        fuente.archivos.add(
            frgp.utn.edu.petcare.data.remoto.ArchivoDto("a1", "m1", "Ecografía", "jpg", "m1/eco.jpg", subidoPor = Escenario.VET_ID)
        )
        ingresarComoDueno()
        val rex = DuenoRepo.buscarMascota("Rex")!!

        val disponibles = runBlocking { DuenoRepo.estudiosDisponibles(rex) }
        assertEquals(setOf("Análisis de sangre", "Ecografía"), disponibles.map { it.nombre }.toSet())

        val nuevo = runBlocking { DuenoRepo.subirEstudio(rex, "Radiografía", "pdf", ByteArray(8), "application/pdf") }
        assertTrue(fuente.subidas.any { it.startsWith("archivos/m1/") })

        DuenoRepo.agendarEvento(
            LocalDate.now().plusDays(3), "Control", "Rex", "Dr. Vera", "10:00", "", listOf(disponibles[0], nuevo)
        )

        val turnoId = fuente.turnos.single().id
        assertEquals(2, fuente.estudios.count { it.turnoId == turnoId })
        assertTrue(fuente.llamadas.contains("adjuntarEstudios:2"))

        // El dueño los ve en el detalle del turno
        val detalle = runBlocking { DuenoRepo.detalleDelTurno(DuenoRepo.eventos.single()) }
        assertEquals(2, detalle.estudios.size)
    }

    @Test
    fun pesoValido_aceptaKilosConComaOUnidad() {
        assertTrue(DuenoRepo.pesoValido("12"))
        assertTrue(DuenoRepo.pesoValido("3,5 kg"))
        assertFalse(DuenoRepo.pesoValido("mucho"))
        assertFalse(DuenoRepo.pesoValido("0"))
    }

    @Test
    fun tieneVacunaPendiente_soloSiHayUnaEnLosProximos30Dias() {
        ingresarComoDueno()
        DuenoRepo.agendarEvento(LocalDate.now().plusDays(10), "Vacuna", "Rex", "", "10:00", "")

        assertTrue(DuenoRepo.tieneVacunaPendiente("Rex"))
        assertFalse(DuenoRepo.tieneVacunaPendiente("Mia"))
    }
}
