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
import frgp.utn.edu.petcare.ui.auth.AuthActivity
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

    private val selectorDeImagen = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
        if (uri != null) alElegirImagen?.invoke(uri)
    }
    private var alElegirImagen: ((Uri) -> Unit)? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
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

        irAHome()
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
        layoutInflater.inflate(layout, contenedor, true)
        barra.resaltar(navId)
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

    fun irAHome() = pantallaHome.mostrar()

    fun irAMascotas() = pantallaMascotas.mostrar()

    fun irANuevaMascota() = pantallaNuevaMascota.mostrar()

    fun irADetalleMascota(mascota: Mascota) {
        mascotaActual = mascota
        pantallaDetalleMascota.mostrar()
    }

    fun irARecordatorios() = pantallaRecordatorios.mostrar()

    fun irACalendario() = pantallaCalendario.mostrar()

    /** Asistente para agendar un evento; [mascota] deja elegida la mascota del primer paso. */
    fun irANuevoEvento(fecha: LocalDate?, mascota: String? = null) = pantallaNuevoEvento.mostrar(fecha, mascota)

    fun irAPerfil() = pantallaPerfil.mostrar()

    fun irAEditarPerfil() = pantallaEditarPerfil.mostrar()

    fun irAVeterinarios() = pantallaVeterinarios.mostrar()

    fun irASolicitudes() = pantallaSolicitudes.mostrar()

    fun mostrarNotificaciones() = notificaciones.mostrar()

    fun abrirCarnet() = startActivity(Intent(this, CarnetSaludActivity::class.java))

    fun cerrarSesion() {
        barra.quitarMenu()
        val intent = Intent(this, AuthActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
        startActivity(intent)
    }
}
