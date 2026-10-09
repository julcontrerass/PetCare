package frgp.utn.edu.petcare

import androidx.test.core.app.ApplicationProvider
import frgp.utn.edu.petcare.data.Imagenes
import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.data.Sesion
import frgp.utn.edu.petcare.data.remoto.PerfilDto
import kotlinx.coroutines.runBlocking
import org.junit.After
import org.junit.Before
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

/** Prepara cada prueba con un servidor en memoria y sin ninguna sesión abierta. */
@RunWith(RobolectricTestRunner::class)
@Config(sdk = [34])
abstract class PruebaBase {

    protected lateinit var fuente: FuenteEnMemoria

    @Before
    fun prepararServicios() {
        val app = ApplicationProvider.getApplicationContext<android.app.Application>()
        Servicios.iniciar(app)
        Imagenes.iniciar(app)
        fuente = FuenteEnMemoria(Escenario.dueno())
        Servicios.fuentePrueba = fuente
        Sesion.olvidar()
    }

    @After
    fun limpiarServicios() {
        Servicios.fuentePrueba = null
        Sesion.olvidar()
    }

    /** Inicia sesión con [perfil] como cuenta y devuelve el resultado del ingreso. */
    protected fun ingresarComo(perfil: PerfilDto): Sesion.Resultado {
        fuente.yo = perfil
        return runBlocking { Sesion.ingresar(perfil.email, "123456") }
    }

    protected fun ingresarComoDueno(): Sesion.Resultado = ingresarComo(Escenario.dueno())

    protected fun ingresarComoVeterinario(): Sesion.Resultado = ingresarComo(Escenario.veterinario())
}
