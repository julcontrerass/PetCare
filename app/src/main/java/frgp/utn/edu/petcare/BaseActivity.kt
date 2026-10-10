package frgp.utn.edu.petcare

import android.content.Context
import kotlinx.coroutines.delay
import androidx.lifecycle.repeatOnLifecycle
import androidx.lifecycle.Lifecycle
import kotlinx.coroutines.launch
import frgp.utn.edu.petcare.data.Servicios
import androidx.lifecycle.lifecycleScope
import frgp.utn.edu.petcare.ui.auth.AuthActivity
import frgp.utn.edu.petcare.data.Sesion
import android.content.Intent
import android.content.res.Configuration
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate

/**
 * Base de todas las pantallas: adapta la configuración para que la app se vea igual en celulares
 * angostos o con el tamaño de letra y de pantalla del sistema muy grandes.
 */
open class BaseActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        // La app solo tiene diseño claro: con el modo oscuro del sistema los textos y las barras quedarían ilegibles
        delegate.localNightMode = AppCompatDelegate.MODE_NIGHT_NO
        super.onCreate(savedInstanceState)
    }

    /**
     * Si el sistema recrea una pantalla del panel después de matar la aplicación, los datos en memoria ya no
     * están: se vuelve al ingreso. Las pantallas lo llaman al empezar `onCreate` y salen si devuelve true.
     */
    protected fun volverSiNoHaySesion(): Boolean {
        if (Sesion.activa) return false
        startActivity(
            Intent(this, AuthActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        )
        finish()
        return true
    }

    private var avisoDeCambios: (() -> Unit)? = null

    /**
     * Para las pantallas del veterinario: vuelve a pedir sus datos al servidor y llama a [redibujar] cuando llegan
     * (también cuando un cambio hecho en la pantalla fue rechazado y hubo que volver a los datos reales).
     */
    protected fun actualizarDatosVeterinario(redibujar: () -> Unit) {
        avisoDeCambios = redibujar
        Servicios.alCambiarDatos = redibujar
        lifecycleScope.launch {
            runCatching { Sesion.recargarVeterinario() }.onSuccess { redibujar() }
            // Mientras la pantalla está a la vista se piden cada tanto los turnos y avisos nuevos
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                while (true) {
                    delay(15_000)
                    runCatching { Sesion.recargarVeterinario() }.onSuccess { redibujar() }
                }
            }
        }
    }

    override fun onDestroy() {
        if (avisoDeCambios != null && Servicios.alCambiarDatos === avisoDeCambios) Servicios.alCambiarDatos = null
        super.onDestroy()
    }

    override fun attachBaseContext(newBase: Context) {
        super.attachBaseContext(Responsive.adaptar(newBase))
    }
}

object Responsive {

    /** Ancho (en dp) por debajo del cual se reduce la escala de la interfaz. Las pantallas se diseñaron para este ancho. */
    const val ANCHO_MINIMO_DP = 360

    /** Tope del tamaño de letra del sistema: más que esto rompe las pantallas de ancho fijo. */
    const val ESCALA_LETRA_MAXIMA = 1.15f

    fun adaptar(base: Context): Context {
        val actual = base.resources.configuration
        val config = Configuration(actual)
        var cambio = false

        if (config.fontScale > ESCALA_LETRA_MAXIMA) {
            config.fontScale = ESCALA_LETRA_MAXIMA
            cambio = true
        }

        val ancho = config.screenWidthDp
        if (ancho in 1 until ANCHO_MINIMO_DP && config.densityDpi > 0) {
            val factor = ancho.toFloat() / ANCHO_MINIMO_DP
            config.densityDpi = (config.densityDpi * factor).toInt().coerceAtLeast(1)
            config.screenWidthDp = ANCHO_MINIMO_DP
            config.screenHeightDp = (config.screenHeightDp / factor).toInt()
            config.smallestScreenWidthDp = (config.smallestScreenWidthDp / factor).toInt()
            cambio = true
        }
        return if (cambio) base.createConfigurationContext(config) else base
    }
}
