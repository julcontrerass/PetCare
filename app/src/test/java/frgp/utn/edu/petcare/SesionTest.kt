package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.data.DuenoRepo
import frgp.utn.edu.petcare.data.Sesion
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SesionTest : PruebaBase() {

    @Test
    fun dueno_ingresaYSeCarganSusMascotas() {
        fuente.mascotas.add(Escenario.mascota("m1", "Rex"))
        fuente.mascotas.add(Escenario.mascota("m2", "Ajeno", dueno = "otro"))

        val resultado = ingresarComoDueno()

        assertTrue(resultado is Sesion.Resultado.Listo)
        assertEquals(Sesion.Rol.DUENO, (resultado as Sesion.Resultado.Listo).rol)
        assertEquals(listOf("Rex"), DuenoRepo.mascotas.map { it.nombre })
        assertEquals("Ana Prueba", DuenoRepo.perfil.nombre)
        assertEquals("30111222", DuenoRepo.perfil.dni)
    }

    @Test
    fun veterinarioActivo_cargaPacientesAgendaYPerfil() {
        fuente.mascotas.add(Escenario.mascota("m1", "Rex"))
        fuente.accesos.add(frgp.utn.edu.petcare.data.remoto.AccesoDto("a1", "m1", Escenario.VET_ID, "activo", "dueno"))
        fuente.turnos.add(Escenario.turno("t1", "m1", java.time.LocalDate.now().toString(), "10:00:00"))

        val resultado = ingresarComoVeterinario()

        assertEquals(Sesion.Rol.VETERINARIO, (resultado as Sesion.Resultado.Listo).rol)
        assertEquals("Dr. Vera", PerfilVetRepo.nombre)
        assertEquals("MP-100", PerfilVetRepo.matricula)
        assertEquals(listOf("Rex"), PacientesRepo.pacientes.map { it.nombre })
        assertEquals(1, AgendaRepo.eventos.size)
        assertEquals("10:00", AgendaRepo.eventos[0].hora)
        assertTrue(PerfilVetRepo.diasSeleccionados[0])
        assertFalse(PerfilVetRepo.diasSeleccionados[5])
        assertEquals("12:00", PerfilVetRepo.horaCierre)
    }

    @Test
    fun veterinarioEnRevision_noPuedeIngresar_yLaSesionSeCierra() {
        val resultado = ingresarComo(Escenario.veterinario(estado = "pendiente_revision"))

        assertTrue(resultado is Sesion.Resultado.Bloqueada)
        assertTrue((resultado as Sesion.Resultado.Bloqueada).mensaje.contains("en revisión"))
        assertFalse(Sesion.activa)
        assertTrue(fuente.sesionCerrada)
    }

    @Test
    fun cuentaSuspendida_muestraElMotivo() {
        val resultado = ingresarComo(Escenario.perfil("d2", "dueno", "Beto", estado = "suspendido", motivo = "Datos falsos"))

        assertTrue((resultado as Sesion.Resultado.Bloqueada).mensaje.contains("Datos falsos"))
    }

    @Test
    fun cuentaRechazada_avisaQueFueRechazada() {
        val resultado = ingresarComo(Escenario.veterinario(estado = "rechazado"))

        assertTrue((resultado as Sesion.Resultado.Bloqueada).mensaje.contains("rechazó"))
    }

    @Test
    fun administrador_ingresaYCargaElPanel() {
        fuente.perfiles.add(Escenario.veterinario())
        fuente.perfiles.add(Escenario.dueno())

        val resultado = ingresarComo(Escenario.admin())

        assertEquals(Sesion.Rol.ADMIN, (resultado as Sesion.Resultado.Listo).rol)
        assertEquals(1, AdminRepo.listaVeterinarios.size)
        assertEquals(1, AdminRepo.listaDuenos.size)
    }

    @Test
    fun cerrar_descartaTodoLoQueHabiaEnMemoria() {
        fuente.mascotas.add(Escenario.mascota("m1", "Rex"))
        ingresarComoDueno()

        runBlocking { Sesion.cerrar() }

        assertFalse(Sesion.activa)
        assertTrue(DuenoRepo.mascotas.isEmpty())
        assertTrue(fuente.sesionCerrada)
    }

    @Test
    fun restaurar_sinSesionGuardadaNoHaceNada() {
        assertNull(runBlocking { Sesion.restaurar() })
    }

    @Test
    fun restaurar_conSesionGuardadaEntraDirecto() {
        fuente.haySesionGuardada = true

        val resultado = runBlocking { Sesion.restaurar() }

        assertTrue(resultado is Sesion.Resultado.Listo)
        assertTrue(Sesion.activa)
    }
}
