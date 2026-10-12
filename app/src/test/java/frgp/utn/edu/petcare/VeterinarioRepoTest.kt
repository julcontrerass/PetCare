package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.data.remoto.AccesoDto
import frgp.utn.edu.petcare.data.remoto.InformeDto
import frgp.utn.edu.petcare.data.remoto.MascotaParaCuentaDto
import frgp.utn.edu.petcare.data.remoto.RegistroSaludDto
import frgp.utn.edu.petcare.data.repositorio.AgendaRepo
import frgp.utn.edu.petcare.data.repositorio.ArchivosRepo
import frgp.utn.edu.petcare.data.repositorio.DisponibilidadVet
import frgp.utn.edu.petcare.data.repositorio.EstadoEvento
import frgp.utn.edu.petcare.data.repositorio.InformesRepo
import frgp.utn.edu.petcare.data.repositorio.PacientesRepo
import frgp.utn.edu.petcare.data.repositorio.PerfilVetRepo
import frgp.utn.edu.petcare.data.repositorio.PrescripcionesRepo
import frgp.utn.edu.petcare.data.repositorio.SaludRepo
import frgp.utn.edu.petcare.data.repositorio.SolicitudesRepo
import frgp.utn.edu.petcare.data.repositorio.SolicitudItem
import frgp.utn.edu.petcare.data.repositorio.TipoRegistro
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.temporal.TemporalAdjusters
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

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
        assertEquals(listOf("Loro"), PacientesRepo.filtrar("", "Ave").map { it.nombre })
        // "Otro" reúne a los animales que no tienen un tipo propio
        assertTrue(PacientesRepo.filtrar("", PacientesRepo.ESPECIE_OTRO).isEmpty())
        assertEquals(1, PacientesRepo.filtrar("rex", null).size)
        assertEquals(3, PacientesRepo.filtrar("mestizo", null).size)
        assertTrue(PacientesRepo.filtrar("zzz", null).isEmpty())
    }

    @Test
    fun pacientes_unAnimalSinTipoPropioCuentaComoOtro() {
        fuente.mascotas.add(Escenario.mascota("m5", "Bola", tipo = "Conejo"))
        fuente.accesos.add(AccesoDto("a5", "m5", Escenario.VET_ID, "activo", "dueno"))
        ingresarComoVeterinario()

        assertEquals(listOf("Bola"), PacientesRepo.filtrar("", PacientesRepo.ESPECIE_OTRO).map { it.nombre })
    }

    @Test
    fun tiposDeMascota_incluyenAvesReptilesPecesYRoedores() {
        assertEquals(listOf("Perro", "Gato", "Ave", "Reptil", "Pez", "Roedor", "Otro"), frgp.utn.edu.petcare.model.TiposMascota.TODOS)
        assertEquals("Peces", frgp.utn.edu.petcare.model.TiposMascota.plural("Pez"))
        assertEquals("Otros", frgp.utn.edu.petcare.model.TiposMascota.plural("Conejo"))
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

    // ---------- Cuenta del dueño ----------

    @Test
    fun cuentaDueno_creaLaMascotaYElPacienteQuedaConCuenta() {
        ingresarComoVeterinario()

        val cuenta = runBlocking {
            PacientesRepo.crearCuentaDueno(
                "Carlos Gómez", "30111222", "11 4444 3333", "Carlos@Prueba.test",
                nuevas = listOf(MascotaParaCuentaDto("Toby", "Perro", sexo = "macho"))
            )
        }

        assertEquals("carlos@prueba.test", cuenta.email)
        assertEquals("Temp1234ab", cuenta.passwordTemporal)
        assertEquals(listOf("Toby"), cuenta.mascotas)
        assertEquals("carlos@prueba.test", fuente.ultimaCuentaPedida?.email)
        val toby = PacientesRepo.pacientes.first { it.nombre == "Toby" }
        assertTrue(toby.tieneCuenta)
    }

    @Test
    fun cuentaDueno_vinculaLosPacientesYaCargadosDelMismoPropietario() {
        ingresarComoVeterinario()
        val toby = PacientesRepo.agregarManual("Toby", "Perro", "", "Macho", "Carlos Gómez", "1144443333", dni = "30111222")
        val luna = PacientesRepo.agregarManual("Luna", "Gato", "", "Hembra", "Carlos Gómez", "1144443333", dni = "30111222")
        PacientesRepo.agregarManual("Otro", "Perro", "", "Macho", "Ana Suárez", "1100000000", dni = "20999888")
        assertFalse(toby.tieneCuenta)

        val mismos = PacientesRepo.mismoPropietarioSinCuenta(toby)
        assertEquals(listOf("Toby", "Luna"), mismos.map { it.nombre })

        runBlocking {
            PacientesRepo.crearCuentaDueno(
                "Carlos Gómez", "30111222", "1144443333", "carlos@prueba.test", existentes = mismos.map { it.id }
            )
        }

        assertEquals(listOf(toby.id, luna.id), fuente.ultimaCuentaPedida?.mascotasExistentes)
        assertTrue(fuente.ultimaCuentaPedida!!.mascotasNuevas.isEmpty())
        assertTrue(PacientesRepo.porId(toby.id)!!.tieneCuenta)
        assertTrue(PacientesRepo.porId(luna.id)!!.tieneCuenta)
        assertEquals(1, PacientesRepo.pacientes.count { !it.tieneCuenta })
    }

    @Test
    fun cuentaDueno_elErrorDelServidorLlegaTalCualYNoCambiaNada() {
        ingresarComoVeterinario()
        fuente.errorAlCrearCuenta = "Ese DNI ya tiene una cuenta en PetCare."
        val antes = PacientesRepo.pacientes.size

        val error = runCatching {
            runBlocking {
                PacientesRepo.crearCuentaDueno(
                    "Carlos Gómez", "30111222", "1144443333", "carlos@prueba.test",
                    nuevas = listOf(MascotaParaCuentaDto("Toby", "Perro"))
                )
            }
        }.exceptionOrNull()

        assertEquals("Ese DNI ya tiene una cuenta en PetCare.", error?.message)
        assertEquals(antes, PacientesRepo.pacientes.size)
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
        assertNull(DisponibilidadVet.validar(lunes, "10:00", 30, "t1"))
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

    @Test
    fun disponibilidad_unTurnoLargoBloqueaLosHorariosQueCubre() {
        fuente.turnos.add(Escenario.turno("t1", "m1", proximoLunes().toString(), "09:00:00").copy(duracionMin = 90))
        ingresarComoVeterinario()
        val lunes = proximoLunes()

        assertEquals("Ya tenés un turno en ese horario", DisponibilidadVet.validar(lunes, "10:00", 30))
        assertNull(DisponibilidadVet.validar(lunes, "10:30", 30))
        val horarios = DisponibilidadVet.horarios(lunes, 30)
        assertFalse(horarios.first { it.hora == "10:00" }.libre)
        assertTrue(horarios.first { it.hora == "10:30" }.libre)
    }

    @Test
    fun disponibilidad_unTurnoQueNoTerminaAntesDelCierreSeRechaza() {
        ingresarComoVeterinario()
        val lunes = proximoLunes()

        // Atiende de 09:00 a 12:00: una práctica de 2 horas no puede arrancar a las 11:00
        assertTrue(DisponibilidadVet.validar(lunes, "11:00", 120)!!.contains("no llega a terminar"))
        assertEquals(listOf("09:00", "09:30", "10:00"), DisponibilidadVet.horarios(lunes, 120).map { it.hora })
    }

    @Test
    fun perfil_cargaYGuardaLosTiposDeAnimalYLasDuraciones() {
        ingresarComoVeterinario()
        PerfilVetRepo.cargar(
            Escenario.perfil(
                Escenario.VET_ID, "veterinario", "Dr. Vera",
                veterinario = frgp.utn.edu.petcare.data.remoto.VeterinarioDto(
                    matricula = "MP-100", tiposAnimales = listOf("Gato"), duraciones = mapOf("Tomografía" to 90)
                )
            )
        )
        assertEquals(setOf("Gato"), PerfilVetRepo.tiposAnimales)
        assertEquals(90, PerfilVetRepo.duracionDe("Tomografía"))
        assertEquals(30, PerfilVetRepo.duracionDe("Chequeo médico integral"))
        assertTrue(PerfilVetRepo.atiende("Gato"))
        assertFalse(PerfilVetRepo.atiende("Perro"))
        // Un animal sin nombre propio cuenta como "Otro"
        assertFalse(PerfilVetRepo.atiende("Conejo"))

        PerfilVetRepo.tiposAnimales.add("Otro")
        PerfilVetRepo.guardarTiposAnimales()
        PerfilVetRepo.duraciones["Cirugía 24hs"] = 150
        PerfilVetRepo.guardarDuraciones()

        assertTrue(PerfilVetRepo.atiende("Conejo"))
        assertTrue(fuente.llamadas.contains("veterinario:tipos_animales"))
        assertTrue(fuente.llamadas.contains("veterinario:duraciones"))
        assertEquals(150, PerfilVetRepo.duracionDe("Cirugía 24hs"))
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

    @Test
    fun salud_laVacunaGuardaMarcaLoteYVencimientoDelLote() {
        ingresarComoVeterinario()

        val registro = SaludRepo.agregar(
            TipoRegistro.VACUNA, "m1", "Antirrábica", null, hoy, proximaDosis = hoy.plusDays(365),
            marca = "Nobivac", lote = "A123", loteVencimiento = hoy.plusDays(400)
        )

        val enviado = fuente.ultimoRegistroCreado!!
        assertEquals("Nobivac", enviado.marca)
        assertEquals("A123", enviado.lote)
        assertEquals(hoy.plusDays(400).toString(), enviado.loteVencimiento)
        assertTrue(registro.detalle.contains("Nobivac") && registro.detalle.contains("Lote A123"))
    }

    @Test
    fun salud_vacunasARecordarSonLasVencidasYLasQueVencenPronto() {
        fuente.registros.add(
            frgp.utn.edu.petcare.data.remoto.RegistroSaludDto("r1", "m1", "vacuna", "Rabia", null, hoy.minusDays(300).toString(), null, hoy.minusDays(10).toString())
        )
        fuente.registros.add(
            frgp.utn.edu.petcare.data.remoto.RegistroSaludDto("r2", "m2", "vacuna", "Triple", null, hoy.toString(), null, hoy.plusDays(15).toString())
        )
        fuente.registros.add(
            frgp.utn.edu.petcare.data.remoto.RegistroSaludDto("r3", "m1", "vacuna", "Moquillo", null, hoy.toString(), null, hoy.plusDays(200).toString())
        )
        ingresarComoVeterinario()

        assertEquals(listOf("Rabia", "Triple"), SaludRepo.vacunasARecordar().map { it.titulo })
    }

    @Test
    fun informe_guardaAnamnesisExamenYSignosVitales() {
        ingresarComoVeterinario()

        InformesRepo.guardar(
            "m1", "Control", "Otitis", "Gotas", null, "Se rasca la oreja", "Oído rojo",
            frgp.utn.edu.petcare.model.SignosVitales(12.4, 38.5, 90, 22)
        )

        val creado = fuente.ultimoInformeCreado!!
        assertEquals("Se rasca la oreja", creado.anamnesis)
        assertEquals("Oído rojo", creado.examenFisico)
        assertEquals(12.4, creado.pesoKg!!, 0.001)
        assertEquals(38.5, creado.temperaturaC!!, 0.001)
        assertEquals(90, creado.frecuenciaCardiaca)
        assertEquals(22, creado.frecuenciaRespiratoria)
        assertEquals("Peso 12.4 kg · Temp. 38.5 °C · FC 90 lpm · FR 22 rpm", InformesRepo.obtener("m1").signos.texto())
    }

    @Test
    fun informe_alVolverAGuardarActualizaLosSignos() {
        ingresarComoVeterinario()
        InformesRepo.guardar("m1", "Control", "Otitis", "Gotas", null, signos = frgp.utn.edu.petcare.model.SignosVitales(pesoKg = 12.0))

        InformesRepo.guardar("m1", "Control", "Otitis", "Gotas", null, signos = frgp.utn.edu.petcare.model.SignosVitales(pesoKg = 12.6))

        val cambios = fuente.ultimosCambiosDeInforme!!
        assertEquals("12.6", cambios["peso_kg"].toString())
    }

    @Test
    fun informe_cargaLosSignosYLaEvolucionDelPeso() {
        val hoyTexto = java.time.OffsetDateTime.now().toString()
        fuente.informes.add(
            frgp.utn.edu.petcare.data.remoto.InformeDto(
                "i1", "m1", null, Escenario.VET_ID, "Control", "Sano", null, createdAt = java.time.OffsetDateTime.now().minusDays(60).toString(),
                pesoKg = 11.0, temperaturaC = 38.2
            )
        )
        fuente.informes.add(
            frgp.utn.edu.petcare.data.remoto.InformeDto(
                "i2", "m1", "t9", Escenario.VET_ID, "Control", "Sano", null, createdAt = hoyTexto, pesoKg = 12.5
            )
        )
        ingresarComoVeterinario()

        val general = kotlinx.coroutines.runBlocking { InformesRepo.cargar("m1", null) }
        val pesos = kotlinx.coroutines.runBlocking { InformesRepo.pesos("m1") }

        assertEquals(11.0, general.signos.pesoKg!!, 0.001)
        assertEquals(2, pesos.size)
        assertEquals(listOf(11.0, 12.5), pesos.map { it.second })
    }

    @Test
    fun receta_seAgregaYSeQuitaDeLaConsulta() {
        ingresarComoVeterinario()

        val p = PrescripcionesRepo.agregar("m1", "t1", "Amoxicilina", "250 mg", 8, 7, "Con comida")

        assertTrue(fuente.llamadas.contains("crearPrescripcion:Amoxicilina"))
        assertEquals("250 mg, cada 8 hs, durante 7 días", p.posologia)
        assertEquals(listOf("Amoxicilina"), PrescripcionesRepo.deConsulta("m1", "t1").map { it.medicamento })
        assertTrue(PrescripcionesRepo.deConsulta("m1", "otro").isEmpty())

        PrescripcionesRepo.eliminar(p)
        assertTrue(PrescripcionesRepo.deConsulta("m1", "t1").isEmpty())
        assertTrue(fuente.llamadas.any { it.startsWith("eliminarPrescripcion:") })
    }

    @Test
    fun informe_elPesoMedidoPasaAlPacienteEnSeguida() {
        ingresarComoVeterinario()
        assertEquals("12 kg", PacientesRepo.porId("m1")!!.peso)

        InformesRepo.guardar(
            "m1", "Control", "Sano", "", null, signos = frgp.utn.edu.petcare.model.SignosVitales(pesoKg = 13.4)
        )

        assertEquals("13.4 kg", PacientesRepo.porId("m1")!!.peso)
    }

    @Test
    fun pacientes_laAlertaClinicaSeGuardaYSeVeEnLaFicha() {
        ingresarComoVeterinario()

        PacientesRepo.guardarAlertas("m1", "  Alérgico a la penicilina ")

        assertEquals("Alérgico a la penicilina", PacientesRepo.porId("m1")!!.alertas)
        assertTrue(fuente.llamadas.contains("alertas:m1:Alérgico a la penicilina"))
    }

    // ---------- Solicitudes ----------

    @Test
    fun solicitudes_listaLasQueEnviaronLosDuenosYLasQuePidioElVeterinario() {
        fuente.accesos.add(AccesoDto("a9", "m3", Escenario.VET_ID, "pendiente", "dueno", createdAt = "2026-01-01T10:00:00+00:00"))
        ingresarComoVeterinario()

        assertEquals(2, SolicitudesRepo.pendientesVeterinario())
        val recibida = SolicitudesRepo.paraVeterinario.first { !it.enviada }
        assertEquals("Quiere compartir a Sin acceso", recibida.mascota)
        val enviada = SolicitudesRepo.paraVeterinario.first { it.enviada }
        assertEquals("Pediste acceso a Sin acceso", enviada.mascota)
        assertEquals(SolicitudItem.Estado.PENDIENTE, enviada.estado)
    }

    @Test
    fun solicitudes_laQuePidioElVeterinarioMuestraLaRespuestaDelDueno() {
        val i = fuente.accesos.indexOfFirst { it.id == "a3" }
        fuente.accesos[i] = fuente.accesos[i].copy(estado = "rechazado")
        ingresarComoVeterinario()

        val enviada = SolicitudesRepo.paraVeterinario.single()
        assertTrue(enviada.enviada)
        assertEquals(SolicitudItem.Estado.RECHAZADA, enviada.estado)
        assertEquals(0, SolicitudesRepo.pendientesVeterinario())
    }

    @Test
    fun solicitudes_aceptarSumaLaMascotaALosPacientes() {
        fuente.accesos.add(AccesoDto("a9", "m3", Escenario.VET_ID, "pendiente", "dueno"))
        ingresarComoVeterinario()
        assertNull(PacientesRepo.porId("m3"))

        SolicitudesRepo.resolver(SolicitudesRepo.paraVeterinario.first { it.id == "a9" }, aceptar = true)

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
        PerfilVetRepo.especialidadesSeleccionadas[PerfilVetRepo.todasLasEspecialidades.indexOf("Dermatología")] = true
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
