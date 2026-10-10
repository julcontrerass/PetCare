package frgp.utn.edu.petcare.ui.dueno

import android.view.View
import android.view.ViewGroup
import android.view.animation.OvershootInterpolator
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.core.content.ContextCompat
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.data.DuenoRepo

/** Barra de navegación inferior del dueño y el menú "Más" que se abre sobre ella. */
class BarraInferior(private val host: DuenoActivity) {

    private var menuAbierto: View? = null
    private var ultimoResaltado = R.id.nav_home
    private var navAntesDelMenu = R.id.nav_home

    /** Cierra el menú "Más" con el botón atrás cuando está abierto. */
    val retrocesoDelMenu = object : OnBackPressedCallback(false) {
        override fun handleOnBackPressed() = cerrarMenu(restaurarNav = true, animar = true)
    }

    private val navIds = intArrayOf(R.id.nav_home, R.id.nav_mascotas, R.id.nav_lista, R.id.nav_mas)
    private val iconoIds = intArrayOf(R.id.iv_nav_home, R.id.iv_nav_mascotas, R.id.iv_nav_lista, R.id.iv_nav_mas)
    private val textoIds = intArrayOf(R.id.tv_nav_home, R.id.tv_nav_mascotas, R.id.tv_nav_lista, R.id.tv_nav_mas)

    fun configurar() {
        // La pestaña responde al instante y la sección se arma en el cuadro siguiente, así el toque nunca se traba
        fun ir(navId: Int, accion: () -> Unit) = View.OnClickListener {
            if (navId == ultimoResaltado && menuAbierto == null) return@OnClickListener
            resaltar(navId)
            it.post(accion)
        }
        host.findViewById<View>(R.id.nav_home)?.setOnClickListener(ir(R.id.nav_home) { host.irAHome() })
        host.findViewById<View>(R.id.nav_mascotas)?.setOnClickListener(ir(R.id.nav_mascotas) { host.irAMascotas() })
        host.findViewById<View>(R.id.nav_lista)?.setOnClickListener(ir(R.id.nav_lista) { host.irARecordatorios() })
        host.findViewById<View>(R.id.nav_mas)?.setOnClickListener { alternarMenu() }
        host.findViewById<View>(R.id.fab_add)?.setOnClickListener { fab ->
            fab.animate().scaleX(1.2f).scaleY(1.2f).setDuration(100).withEndAction {
                fab.animate().scaleX(1f).scaleY(1f).setDuration(100).start()
            }.start()
            host.irANuevoEvento(host.diaSeleccionado)
        }
    }

    /** Marca la pestaña activa y cierra el menú "Más" si estaba abierto. Con -1 no se marca ninguna. */
    fun resaltar(navId: Int) {
        quitarMenu()
        pintar(navId)
    }

    private fun pintar(navId: Int) {
        val cambio = navId != ultimoResaltado
        ultimoResaltado = navId
        val activo = ContextCompat.getColor(host, R.color.primary_teal)
        val inactivo = ContextCompat.getColor(host, R.color.text_gray)
        for (i in navIds.indices) {
            val contenedor = host.findViewById<View>(navIds[i]) ?: continue
            val icono = host.findViewById<ImageView>(iconoIds[i]) ?: continue
            val texto = host.findViewById<TextView>(textoIds[i]) ?: continue
            val elegido = navIds[i] == navId
            icono.setColorFilter(if (elegido) activo else inactivo)
            texto.setTextColor(if (elegido) activo else inactivo)
            // El ícono elegido crece un poco solo cuando cambia de pestaña, no cada vez que se redibuja la sección
            if (cambio || contenedor.scaleX != (if (elegido) 1.1f else 1f)) {
                contenedor.animate().scaleX(if (elegido) 1.1f else 1f).scaleY(if (elegido) 1.1f else 1f).setDuration(120).start()
            }
        }
    }

    // ---------- Menú "Más" ----------

    private fun alternarMenu() {
        if (menuAbierto != null) cerrarMenu(restaurarNav = true, animar = true) else abrirMenu()
    }

    private fun abrirMenu() {
        val raiz = host.findViewById<ViewGroup>(android.R.id.content) ?: return
        val nav = host.findViewById<View>(R.id.bottom_navigation_container)

        navAntesDelMenu = ultimoResaltado
        val overlay = host.layoutInflater.inflate(R.layout.menu_mas_popup, raiz, false)
        (overlay.layoutParams as FrameLayout.LayoutParams).bottomMargin =
            if (nav != null && nav.height > 0) nav.height else host.dp(80)
        overlay.setOnClickListener { cerrarMenu(restaurarNav = true, animar = true) }

        overlay.findViewById<View>(R.id.masMiPerfil).setOnClickListener { elegirOpcion(false) { host.irAPerfil() } }
        overlay.findViewById<View>(R.id.masVeterinarios).setOnClickListener { elegirOpcion(false) { host.irAVeterinarios() } }
        overlay.findViewById<View>(R.id.masSolicitudes).setOnClickListener { elegirOpcion(false) { host.irASolicitudes() } }
        overlay.findViewById<View>(R.id.masSalud).setOnClickListener { elegirOpcion(true) { host.abrirCarnet() } }
        overlay.findViewById<View>(R.id.masCalendario).setOnClickListener { elegirOpcion(false) { host.irACalendario() } }
        overlay.findViewById<View>(R.id.masNotificaciones).setOnClickListener {
            elegirOpcion(true) { host.mostrarNotificaciones() }
        }
        overlay.findViewById<View>(R.id.masCerrarSesion).setOnClickListener { elegirOpcion(false) { host.cerrarSesion() } }
        overlay.findViewById<View>(R.id.masBadgeNotificaciones).visibility =
            if (DuenoRepo.hayNotificacionesSinLeer) View.VISIBLE else View.GONE

        raiz.addView(overlay)
        menuAbierto = overlay
        retrocesoDelMenu.isEnabled = true
        pintar(R.id.nav_mas)

        val tarjeta = overlay.findViewById<View>(R.id.cardMasMenu)
        overlay.alpha = 0f
        tarjeta.scaleX = 0.9f
        tarjeta.scaleY = 0.9f
        tarjeta.translationY = host.dp(16).toFloat()
        tarjeta.post {
            tarjeta.pivotX = tarjeta.width * 0.85f
            tarjeta.pivotY = tarjeta.height.toFloat()
            overlay.animate().alpha(1f).setDuration(160).start()
            tarjeta.animate().scaleX(1f).scaleY(1f).translationY(0f).setDuration(220)
                .setInterpolator(OvershootInterpolator(0.8f)).start()
        }
    }

    private fun elegirOpcion(restaurarNav: Boolean, accion: () -> Unit) {
        cerrarMenu(restaurarNav, animar = false)
        accion()
    }

    fun quitarMenu() = cerrarMenu(restaurarNav = false, animar = false)

    private fun cerrarMenu(restaurarNav: Boolean, animar: Boolean) {
        val overlay = menuAbierto ?: return
        menuAbierto = null
        retrocesoDelMenu.isEnabled = false
        if (restaurarNav) pintar(navAntesDelMenu)

        val quitar = { (overlay.parent as? ViewGroup)?.removeView(overlay); Unit }
        if (animar) {
            overlay.findViewById<View>(R.id.cardMasMenu).animate().alpha(0f).scaleX(0.92f).scaleY(0.92f)
                .translationY(host.dp(12).toFloat()).setDuration(120).start()
            overlay.animate().alpha(0f).setDuration(140).withEndAction { quitar() }.start()
        } else {
            quitar()
        }
    }
}
