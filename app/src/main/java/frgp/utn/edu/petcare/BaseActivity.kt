package frgp.utn.edu.petcare

import android.content.Context
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
