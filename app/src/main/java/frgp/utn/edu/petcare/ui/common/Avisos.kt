package frgp.utn.edu.petcare.ui.common

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.ContextWrapper
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.annotation.DrawableRes
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.google.android.material.button.MaterialButton
import frgp.utn.edu.petcare.R
import java.lang.ref.WeakReference

/**
 * Todos los mensajes que ve el usuario: avisos breves que bajan desde arriba (confirmaciones y datos que
 * faltan) y carteles con botón para los errores y las confirmaciones de acciones delicadas. Reemplaza a los
 * `Toast` del sistema para que se vean igual en toda la app.
 */
object Avisos {

    enum class Tipo(@DrawableRes val fondo: Int, @DrawableRes val icono: Int, val colorIcono: Int) {
        EXITO(R.drawable.bg_icon_green, R.drawable.ic_check_circle, R.color.success_green),
        AVISO(R.drawable.bg_icon_orange, R.drawable.ic_warning, R.color.accent_orange_dark),
        INFO(R.drawable.bg_icon_teal, R.drawable.ic_check_circle, R.color.primary_teal)
    }

    private const val DURACION_MS = 3200L
    private val principal = Handler(Looper.getMainLooper())
    private var actividadActual: WeakReference<Activity>? = null
    private var bannerActual: WeakReference<View>? = null
    private var cierreDelBanner: Runnable? = null

    private val palabrasDeExito = Regex(
        "actualizad|guardad|cancelad|creada|enviad|agregad|eliminad|subid|correctamente|completad|autorizad|" +
            "dado de alta|dada de alta|se sumó|borrad|reactivad|aceptad|marcad|restablecid|aprobad|registrad",
        RegexOption.IGNORE_CASE
    )

    /** Hay que llamarlo una vez al iniciar la aplicación para saber sobre qué pantalla mostrar los mensajes. */
    fun iniciar(app: Application) {
        app.registerActivityLifecycleCallbacks(object : Application.ActivityLifecycleCallbacks {
            override fun onActivityResumed(activity: Activity) {
                actividadActual = WeakReference(activity)
            }

            override fun onActivityPaused(activity: Activity) {
                if (actividadActual?.get() === activity) actividadActual = null
            }

            override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {}
            override fun onActivityStarted(activity: Activity) {}
            override fun onActivityStopped(activity: Activity) {}
            override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) {}
            override fun onActivityDestroyed(activity: Activity) {}
        })
    }

    private fun actividadDe(contexto: Context?): Activity? {
        var c = contexto
        while (c is ContextWrapper) {
            if (c is Activity) return c
            c = c.baseContext
        }
        return actividadActual?.get()
    }

    // ---------- Avisos breves ----------

    /** Muestra el mensaje como confirmación o como advertencia según lo que dice. */
    fun mostrar(contexto: Context?, mensaje: String) {
        mostrar(contexto, mensaje, if (palabrasDeExito.containsMatchIn(mensaje)) Tipo.EXITO else Tipo.AVISO)
    }

    fun mostrar(contexto: Context, recurso: Int) = mostrar(contexto, contexto.getString(recurso))

    fun exito(contexto: Context?, mensaje: String) = mostrar(contexto, mensaje, Tipo.EXITO)

    fun aviso(contexto: Context?, mensaje: String) = mostrar(contexto, mensaje, Tipo.AVISO)

    fun mostrar(contexto: Context?, mensaje: String, tipo: Tipo) {
        val actividad = actividadDe(contexto)
        val contenedor = actividad?.findViewById<ViewGroup>(android.R.id.content)
        if (actividad == null || contenedor == null || actividad.isFinishing) {
            contexto?.let { Toast.makeText(it, mensaje, Toast.LENGTH_SHORT).show() }
            return
        }
        retirarBanner()

        val banner = LayoutInflater.from(actividad).inflate(R.layout.aviso_banner, contenedor, false)
        banner.findViewById<View>(R.id.avisoIconoFondo).setBackgroundResource(tipo.fondo)
        banner.findViewById<ImageView>(R.id.avisoIcono).apply {
            setImageResource(tipo.icono)
            setColorFilter(ContextCompat.getColor(actividad, tipo.colorIcono))
        }
        banner.findViewById<TextView>(R.id.avisoTexto).text = mensaje

        val margen = (16 * actividad.resources.displayMetrics.density).toInt()
        val arriba = ViewCompat.getRootWindowInsets(actividad.window.decorView)
            ?.getInsets(WindowInsetsCompat.Type.systemBars())?.top ?: 0
        banner.layoutParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.TOP
        ).apply { setMargins(margen, arriba + margen / 2, margen, 0) }
        banner.alpha = 0f
        banner.translationY = -margen * 3f
        banner.setOnClickListener { retirarBanner() }
        contenedor.addView(banner)
        banner.animate().alpha(1f).translationY(0f).setDuration(220).start()

        bannerActual = WeakReference(banner)
        val cierre = Runnable { retirarBanner() }
        cierreDelBanner = cierre
        principal.postDelayed(cierre, DURACION_MS)
    }

    private fun retirarBanner() {
        cierreDelBanner?.let { principal.removeCallbacks(it) }
        cierreDelBanner = null
        val banner = bannerActual?.get() ?: return
        bannerActual = null
        banner.animate().alpha(0f).translationY(-banner.height / 2f).setDuration(160).withEndAction {
            (banner.parent as? ViewGroup)?.removeView(banner)
        }.start()
    }

    // ---------- Carteles ----------

    /** Cartel de error: explica qué pasó y se cierra con un botón. */
    fun error(contexto: Context?, mensaje: String, titulo: String? = null) {
        val actividad = actividadDe(contexto)
        if (actividad == null || actividad.isFinishing) {
            contexto?.let { Toast.makeText(it, mensaje, Toast.LENGTH_LONG).show() }
            return
        }
        val tituloFinal = titulo ?: when {
            "conexión" in mensaje -> "Sin conexión"
            "permiso" in mensaje -> "No tenés permiso"
            else -> "No se pudo completar"
        }
        cartel(
            actividad, tituloFinal, mensaje, R.drawable.ic_warning, peligro = true,
            textoAceptar = "Entendido", textoCancelar = null, alAceptar = {}
        )
    }

    /** Cartel informativo con un solo botón (por ejemplo, "revisá tu correo"). */
    fun informar(
        contexto: Context,
        titulo: String,
        mensaje: String,
        @DrawableRes icono: Int = R.drawable.ic_check_circle,
        textoAceptar: String = "Entendido",
        cancelable: Boolean = true,
        alAceptar: () -> Unit = {}
    ) {
        val actividad = actividadDe(contexto) ?: return
        cartel(actividad, titulo, mensaje, icono, peligro = false, textoAceptar, null, alAceptar, cancelable)
    }

    /** Cartel de confirmación para una acción que no se puede deshacer o que conviene pensar dos veces. */
    fun confirmar(
        contexto: Context,
        titulo: String,
        mensaje: String,
        textoAceptar: String,
        textoCancelar: String = "Volver",
        peligro: Boolean = true,
        @DrawableRes icono: Int = R.drawable.ic_cancel,
        alAceptar: () -> Unit
    ) {
        val actividad = actividadDe(contexto) ?: return
        cartel(actividad, titulo, mensaje, icono, peligro, textoAceptar, textoCancelar, alAceptar)
    }

    private fun cartel(
        actividad: Activity,
        titulo: String,
        mensaje: String,
        @DrawableRes icono: Int,
        peligro: Boolean,
        textoAceptar: String,
        textoCancelar: String?,
        alAceptar: () -> Unit,
        cancelable: Boolean = true
    ) {
        val vista = LayoutInflater.from(actividad).inflate(R.layout.dialog_cartel, null)
        val color = ContextCompat.getColor(actividad, if (peligro) R.color.danger_red else R.color.primary_teal)
        vista.findViewById<View>(R.id.cartelIconoFondo)
            .setBackgroundResource(if (peligro) R.drawable.bg_icon_red else R.drawable.bg_icon_teal)
        vista.findViewById<ImageView>(R.id.cartelIcono).apply {
            setImageResource(icono)
            setColorFilter(color)
        }
        vista.findViewById<TextView>(R.id.cartelTitulo).text = titulo
        vista.findViewById<TextView>(R.id.cartelMensaje).text = mensaje

        val dialogo = AlertDialog.Builder(actividad).setView(vista).setCancelable(cancelable).create()
        vista.findViewById<MaterialButton>(R.id.btnCartelAceptar).apply {
            text = textoAceptar
            backgroundTintList = android.content.res.ColorStateList.valueOf(color)
            setOnClickListener {
                dialogo.dismiss()
                alAceptar()
            }
        }
        vista.findViewById<MaterialButton>(R.id.btnCartelCancelar).apply {
            if (textoCancelar != null) {
                visibility = View.VISIBLE
                text = textoCancelar
                setOnClickListener { dialogo.dismiss() }
            }
        }
        dialogo.window?.setBackgroundDrawable(ColorDrawable(Color.TRANSPARENT))
        dialogo.show()
        val ancho = (actividad.resources.displayMetrics.widthPixels * 0.88f).toInt()
        dialogo.window?.setLayout(ancho, ViewGroup.LayoutParams.WRAP_CONTENT)
    }
}
