package frgp.utn.edu.petcare.ui.dueno

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import androidx.activity.enableEdgeToEdge
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import frgp.utn.edu.petcare.BaseActivity
import frgp.utn.edu.petcare.CarnetSaludActivity
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.data.DuenoRepo
import frgp.utn.edu.petcare.model.Mascota
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.data.Sesion
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.LocalDate
import java.time.YearMonth

/**
 * Contenedor de la app del dueño: una barra inferior fija y, arriba, la sección que se esté viendo.
 * Cada sección es una [Pantalla]; desde acá se navega entre ellas y se comparte lo que ven todas
 * (la mascota abierta, el día elegido en el calendario).
 */
class DuenoActivity : BaseActivity() {

    // Lo que comparten las pantallas mientras se navega
    var mascotaActual: Mascota? = null
    var diaSeleccionado: LocalDate = LocalDate.now()
    var mesCalendario: YearMonth = YearMonth.now()

    private lateinit var barra: BarraInferior

    private val pantallaHome by lazy { HomePantalla(this) }
    private val pantallaMascotas by lazy { MascotasPantalla(this) }
    private val pantallaNuevaMascota by lazy { NuevaMascotaPantalla(this) }
    private val pantallaDetalleMascota by lazy { DetalleMascotaPantalla(this) }
    private val pantallaRecordatorios by lazy { RecordatoriosPantalla(this) }
    private val pantallaCalendario by lazy { CalendarioPantalla(this) }
    private val pantallaNuevoEvento by lazy { NuevoEventoPantalla(this) }
    private val pantallaPerfil by lazy { PerfilPantalla(this) }
    private val pantallaEditarPerfil by lazy { EditarPerfilPantalla(this) }
    private val pantallaVeterinarios by lazy { VeterinariosPantalla(this) }
    private val pantallaSolicitudes by lazy { SolicitudesPantalla(this) }
    private val notificaciones by lazy { NotificacionesDialogo(this) }

    val recordatorios: RecordatoriosPantalla get() = pantallaRecordatorios
    val dialogosEventos by lazy { EventosDialogos(this) }

    private var enInicio = true

    /** Cómo volver a dibujar la sección visible cuando llegan datos nuevos (null en los formularios). */
    private var refrescable: (() -> Unit)? = null

    /** Falso mientras se redibuja la sección por datos nuevos: ahí no tiene que haber ninguna animación. */
    private var animarCambio = true

    private val selectorDeImagen = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) alElegirImagen?.invoke(uri)
    }
    private var alElegirImagen: ((Uri) -> Unit)? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        if (volverSiNoHaySesion()) return
        enableEdgeToEdge()
        setContentView(R.layout.app_base)
        ajustarInsets()

        barra = BarraInferior(this)
        barra.configurar()
        onBackPressedDispatcher.addCallback(this, barra.retrocesoDelMenu)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (enInicio) {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                } else {
                    irAHome()
                }
            }
        })

        Servicios.alCambiarDatos = {
            actualizarBadgeNotificaciones()
            animarCambio = false
            try {
                refrescable?.invoke()
            } finally {
                animarCambio = true
            }
        }
        // Mientras la pantalla está a la vista se piden cada tanto los cambios que hacen los veterinarios
        lifecycleScope.launch {
            repeatOnLifecycle(Lifecycle.State.STARTED) {
                while (true) {
                    delay(INTERVALO_ACTUALIZACION_MS)
                    runCatching { DuenoRepo.recargarDerivados() }
                }
            }
        }

        irAHome()
    }

    override fun onDestroy() {
        Servicios.alCambiarDatos = null
        super.onDestroy()
    }

    private fun ajustarInsets() {
        val raiz = findViewById<View>(R.id.main_base_layout)
        val espaciadorEstado = findViewById<View>(R.id.status_bar_spacer)
        val barraInferior = findViewById<View>(R.id.bottom_navigation_container)
        ViewCompat.setOnApplyWindowInsetsListener(raiz) { _, insets ->
            val barras = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            espaciadorEstado?.let {
                it.layoutParams = it.layoutParams.apply { height = barras.top }
            }
            barraInferior?.let {
                it.setPadding(0, 0, 0, barras.bottom)
                it.layoutParams = it.layoutParams.apply { height = dp(80) + barras.bottom }
            }
            WindowInsetsCompat.CONSUMED
        }
        ViewCompat.requestApplyInsets(raiz)
    }

    // ---------- Utilidades para las pantallas ----------

    fun dp(valor: Int): Int = (valor * resources.displayMetrics.density).toInt()

    /** Reemplaza el contenido por [layout] y marca la pestaña [navId] (-1 deja todas sin marcar). */
    fun mostrarContenido(layout: Int, navId: Int, inicio: Boolean = false): View {
        enInicio = inicio
        val contenedor = findViewById<ViewGroup>(R.id.content_container)
        contenedor.removeAllViews()
        val nuevo = layoutInflater.inflate(layout, contenedor, false)
        contenedor.addView(nuevo)
        barra.resaltar(navId)
        if (animarCambio) {
            // La barra inferior no se mueve: solo el contenido aparece con un fundido corto
            nuevo.alpha = 0f
            nuevo.translationY = dp(10).toFloat()
            nuevo.animate().alpha(1f).translationY(0f).setDuration(170).start()
        }
        return contenedor
    }

    /** Abre la galería y devuelve la imagen elegida. */
    fun pedirImagen(alElegir: (Uri) -> Unit) {
        alElegirImagen = alElegir
        selectorDeImagen.launch("image/*")
    }

    /** Muestra u oculta el punto rojo de la campana según haya notificaciones sin leer. */
    fun actualizarBadgeNotificaciones() {
        findViewById<View>(R.id.notification_badge)?.visibility =
            if (DuenoRepo.hayNotificacionesSinLeer) View.VISIBLE else View.GONE
    }

    // ---------- Navegación ----------

    fun irAHome() = mostrarSeccion { pantallaHome.mostrar() }

    fun irAMascotas() = mostrarSeccion { pantallaMascotas.mostrar() }

    fun irANuevaMascota() {
        refrescable = null
        pantallaNuevaMascota.mostrar()
    }

    fun irADetalleMascota(mascota: Mascota) {
        mascotaActual = mascota
        refrescable = null
        pantallaDetalleMascota.mostrar()
    }

    fun irARecordatorios() = mostrarSeccion { pantallaRecordatorios.mostrar() }

    fun irACalendario() = mostrarSeccion { pantallaCalendario.mostrar() }

    /** Asistente para agendar un evento; [mascota] deja elegida la mascota del primer paso. */
    fun irANuevoEvento(fecha: LocalDate?, mascota: String? = null) {
        refrescable = null
        pantallaNuevoEvento.mostrar(fecha, mascota)
    }

    fun irAPerfil() = mostrarSeccion { pantallaPerfil.mostrar() }

    fun irAEditarPerfil() {
        refrescable = null
        pantallaEditarPerfil.mostrar()
    }

    fun irAVeterinarios() = mostrarSeccion { pantallaVeterinarios.mostrar() }

    fun irASolicitudes() = mostrarSeccion { pantallaSolicitudes.mostrar() }

    /** Muestra una sección que se puede volver a dibujar sola cuando cambian los datos. */
    private fun mostrarSeccion(dibujar: () -> Unit) {
        refrescable = dibujar
        dibujar()
    }

    fun mostrarNotificaciones() = notificaciones.mostrar()

    fun abrirCarnet() = startActivity(Intent(this, CarnetSaludActivity::class.java))

    fun cerrarSesion() {
        barra.quitarMenu()
        Sesion.cerrarYVolver(this)
    }

    private companion object {
        const val INTERVALO_ACTUALIZACION_MS = 30_000L
    }
}
