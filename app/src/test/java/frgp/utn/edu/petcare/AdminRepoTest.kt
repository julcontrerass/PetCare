package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.data.remoto.ActividadDto
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

class AdminRepoTest : PruebaBase() {

    @Before
    fun cargarEscenario() {
        fuente.perfiles.add(Escenario.veterinario("vet-1", "Dr. Activo"))
        fuente.perfiles.add(Escenario.veterinario("vet-2", "Dra. Nueva", estado = "pendiente_revision"))
        fuente.perfiles.add(Escenario.veterinario("vet-3", "Dr. Suspendido", estado = "suspendido"))
        fuente.perfiles.add(Escenario.dueno())
        fuente.mascotas.add(Escenario.mascota("m1", "Rex"))
        fuente.mascotas.add(Escenario.mascota("m2", "Mia"))
        fuente.actividad.add(ActividadDto("x1", "registro", "Dra. Nueva pidió el alta", "2026-01-02T10:00:00+00:00"))
        fuente.actividad.add(ActividadDto("x2", "baja", "Alguien eliminó su cuenta", "2026-01-01T10:00:00+00:00"))
        fuente.resumen = Escenario.resumen("mascotas" to 2, "turnos_hoy" to 3)
        ingresarComo(Escenario.admin())
    }

    @Test
    fun cargar_armaVeterinariosDuenosYActividad() {
        assertEquals(3, AdminRepo.listaVeterinarios.size)
        assertEquals(1, AdminRepo.listaDuenos.size)
        assertEquals(listOf("Rex (Mestizo)", "Mia (Mestizo)"), AdminRepo.listaDuenos[0].mascotas)
        assertEquals("30111222", AdminRepo.listaDuenos[0].dni)
        assertEquals(2, AdminRepo.actividad.size)
        assertEquals(TipoActividad.REGISTRO, AdminRepo.actividad[0].tipo)
        assertEquals(TipoActividad.BAJA, AdminRepo.actividad[1].tipo)
    }

    @Test
    fun contadores_salenDeLasCuentasYDelResumen() {
        assertEquals(1, AdminRepo.vetsActivos())
        assertEquals(1, AdminRepo.pendientesRevisionCount())
        assertEquals(1, AdminRepo.duenosActivos())
        assertEquals(2, AdminRepo.totalMascotas())
        assertEquals(3, AdminRepo.turnosHoy())
    }

    @Test
    fun veterinario_muestraHorariosYEspecialidades() {
        val vet = AdminRepo.vetPorId("vet-1")!!
        assertEquals("Lun a Vie · 09:00 a 12:00 hs", vet.diasYHorarios)
        assertEquals("Consulta general, Vacunación y prevención", vet.especialidades)
        assertEquals("MP-100", vet.matricula)
        assertEquals(AdminRepo.ACTIVO, vet.estado)
    }

    @Test
    fun aprobarVet_cambiaElEstadoEnElServidor() {
        AdminRepo.aprobarVet("vet-2")

        assertEquals(AdminRepo.ACTIVO, AdminRepo.vetPorId("vet-2")!!.estado)
        assertTrue(fuente.llamadas.contains("estadoCuenta:vet-2=activo"))
        assertEquals(2, AdminRepo.vetsActivos())
    }

    @Test
    fun rechazarYSuspender_mandanElMotivo() {
        AdminRepo.rechazarVet("vet-2", "Matrícula no verificada")
        AdminRepo.suspenderDueno(Escenario.DUENO_ID, "Maltrato")

        assertTrue(fuente.llamadas.contains("estadoCuenta:vet-2=rechazado:Matrícula no verificada"))
        assertTrue(fuente.llamadas.contains("estadoCuenta:${Escenario.DUENO_ID}=suspendido:Maltrato"))
        assertEquals(AdminRepo.SUSPENDIDO, AdminRepo.duenoPorId(Escenario.DUENO_ID)!!.estado)
        assertEquals("Maltrato", AdminRepo.duenoPorId(Escenario.DUENO_ID)!!.motivo)
    }

    @Test
    fun reactivar_vuelveAActivoYBorraElMotivo() {
        AdminRepo.reactivarVet("vet-3")

        val vet = AdminRepo.vetPorId("vet-3")!!
        assertEquals(AdminRepo.ACTIVO, vet.estado)
        assertEquals("", vet.motivo)
        assertTrue(fuente.llamadas.contains("estadoCuenta:vet-3=activo"))
    }

    @Test
    fun iniciales_ignoranElTitulo() {
        assertEquals("JP", AdminRepo.iniciales("Dr. Juan Pérez"))
        assertEquals("L", AdminRepo.iniciales("Laura"))
        assertEquals("?", AdminRepo.iniciales(""))
    }
}
