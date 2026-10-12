package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.data.Sesion
import frgp.utn.edu.petcare.data.remoto.AccesoDto
import frgp.utn.edu.petcare.data.repositorio.AgendaRepo
import frgp.utn.edu.petcare.data.repositorio.DuenoRepo
import frgp.utn.edu.petcare.data.repositorio.PerfilVetRepo
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** Una cuenta puede ser dueño y veterinario: al ingresar se elige el modo y se puede cambiar sin cerrar sesión. */
class ModosDeUsoTest : PruebaBase() {

    @Test
    fun duenoSinRolDeVeterinario_entraDirectoComoDueno() {
        val resultado = ingresarComoDueno()

        assertTrue(resultado is Sesion.Resultado.Listo)
        assertEquals(Sesion.Rol.DUENO, (resultado as Sesion.Resultado.Listo).rol)
        assertEquals(listOf(Sesion.Rol.DUENO), Sesion.rolesDisponibles)
    }

    @Test
    fun duenoConRolDeVeterinarioAprobado_siempreElige() {
        val resultado = ingresarComo(Escenario.duenoYVeterinario())

        assertTrue(resultado is Sesion.Resultado.Elegir)
        assertEquals(
            listOf(Sesion.Rol.DUENO, Sesion.Rol.VETERINARIO),
            (resultado as Sesion.Resultado.Elegir).roles
        )
        // Todavía no se cargó nada de ningún modo
        assertEquals(null, Sesion.rol)
    }

    @Test
    fun elegirVeterinario_cargaLaAgendaYElegirDuenoLasMascotas() {
        fuente.mascotas.add(Escenario.mascota("m1", "Rex"))
        fuente.accesos.add(AccesoDto("a1", "m1", Escenario.DUENO_ID, "activo", "dueno"))
        ingresarComo(Escenario.duenoYVeterinario())

        val comoVet = runBlocking { Sesion.entrarComo(Sesion.Rol.VETERINARIO) }
        assertEquals(Sesion.Rol.VETERINARIO, comoVet.rol)
        assertEquals("MP-777", PerfilVetRepo.matricula)

        val comoDueno = runBlocking { Sesion.cambiarModo(Sesion.Rol.DUENO) }
        assertEquals(Sesion.Rol.DUENO, comoDueno.rol)
        assertEquals(listOf("Rex"), DuenoRepo.mascotas.map { it.nombre })
        assertTrue(AgendaRepo.eventos.isEmpty())
    }

    @Test
    fun rolDeVeterinarioPendiente_noOfreceElModoNiPregunta() {
        val resultado = ingresarComo(Escenario.duenoYVeterinario(revision = "pendiente_revision"))

        assertTrue(resultado is Sesion.Resultado.Listo)
        assertEquals(listOf(Sesion.Rol.DUENO), Sesion.rolesDisponibles)
        val error = runCatching { runBlocking { Sesion.cambiarModo(Sesion.Rol.VETERINARIO) } }.exceptionOrNull()
        assertTrue(error is IllegalArgumentException)
    }

    @Test
    fun veterinarioSinMascotas_entraDirectoPeroPuedePasarAlModoDueno() {
        val resultado = ingresarComoVeterinario()

        assertEquals(Sesion.Rol.VETERINARIO, (resultado as Sesion.Resultado.Listo).rol)
        assertTrue(Sesion.Rol.DUENO in Sesion.rolesDisponibles)
    }

    @Test
    fun veterinarioConMascotasPropias_eligeComoIngresar() {
        fuente.mascotas.add(Escenario.mascota("m9", "Pipa", dueno = Escenario.VET_ID))
        val resultado = ingresarComoVeterinario()

        assertTrue(resultado is Sesion.Resultado.Elegir)
    }

    @Test
    fun cuentaEnRevision_siguePidiendoEsperar() {
        val resultado = ingresarComo(Escenario.veterinario(estado = "pendiente_revision"))

        assertTrue(resultado is Sesion.Resultado.Bloqueada)
    }
}
