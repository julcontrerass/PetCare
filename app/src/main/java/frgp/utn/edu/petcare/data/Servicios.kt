package frgp.utn.edu.petcare.data

import android.content.Context
import frgp.utn.edu.petcare.ui.common.Avisos
import android.os.Handler
import android.os.Looper
import frgp.utn.edu.petcare.data.remoto.FuenteDatos
import frgp.utn.edu.petcare.data.remoto.SupabaseFuente
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Punto de acceso a lo que comparte toda la app: la fuente de datos (Supabase), el alcance de las
 * operaciones en segundo plano y el aviso de errores. Los repositorios guardan una copia en memoria de lo
 * que ve el usuario y mandan los cambios al servidor sin bloquear la pantalla.
 */
object Servicios {

    private var contexto: Context? = null
    private var fuenteReal: FuenteDatos? = null

    /** Las pruebas reemplazan la fuente por una en memoria. */
    @Volatile
    var fuentePrueba: FuenteDatos? = null

    val fuente: FuenteDatos
        get() = fuentePrueba ?: synchronized(this) {
            fuenteReal ?: SupabaseFuente(contexto ?: error("Servicios no está inicializado")).also { fuenteReal = it }
        }

    val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    private val principal = Handler(Looper.getMainLooper())

    /** Quien quiera enterarse de que los datos cambiaron en segundo plano (la pantalla visible) se anota acá. */
    @Volatile
    var alCambiarDatos: (() -> Unit)? = null

    /** El contexto de la aplicación, para los pocos lugares que necesitan guardar archivos o preferencias. */
    val contextoApp: Context? get() = contexto

    fun iniciar(contexto: Context) {
        this.contexto = contexto.applicationContext
    }

    fun avisarCambio() {
        principal.post { alCambiarDatos?.invoke() }
    }

    fun mostrarError(mensaje: String) {
        val ctx = contexto ?: return
        principal.post { Avisos.error(ctx, mensaje) }
    }

    /**
     * Manda un cambio al servidor. La pantalla ya mostró el resultado; si el servidor lo rechaza se avisa
     * y [alFallar] vuelve a pedir los datos para que la copia local no quede distinta de la real.
     */
    fun escribir(
        alFallar: (suspend () -> Unit)? = null,
        alTerminar: (suspend () -> Unit)? = null,
        accion: suspend () -> Unit
    ): Job = scope.launch {
        try {
            accion()
            alTerminar?.invoke()
        } catch (e: Exception) {
            mostrarError(Errores.mensaje(e))
            runCatching { alFallar?.invoke() }
        }
    }
}
