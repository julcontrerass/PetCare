package frgp.utn.edu.petcare.ui.dueno

import android.graphics.Typeface
import frgp.utn.edu.petcare.ui.common.Avisos
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.RelativeLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import com.google.android.material.card.MaterialCardView
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.data.DuenoRepo
import frgp.utn.edu.petcare.model.NotificacionDueno
import frgp.utn.edu.petcare.model.TipoNotificacion
import java.time.Duration
import java.time.LocalDateTime

/** Lista de notificaciones del dueño en un diálogo. */
class NotificacionesDialogo(private val host: DuenoActivity) {

    private fun dp(valor: Int) = host.dp(valor)

    fun mostrar() {
        DuenoRepo.marcarNotificacionesLeidas()
        host.actualizarBadgeNotificaciones()

        val lista = DuenoRepo.notificaciones
        val contenido = LinearLayout(host).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(16), dp(20), dp(16))
        }
        if (lista.isEmpty()) {
            contenido.addView(TextView(host).apply {
                text = "No tenés notificaciones."
                setTextColor(ContextCompat.getColor(host, R.color.text_gray))
                setPadding(0, dp(16), 0, dp(16))
                gravity = Gravity.CENTER
            })
        } else {
            lista.forEach { contenido.addView(tarjeta(it)) }
        }

        val constructor = AlertDialog.Builder(host)
            .setTitle("Notificaciones")
            .setView(ScrollView(host).apply { addView(contenido) })
            .setPositiveButton("Cerrar") { dialogo, _ -> dialogo.dismiss() }
        if (lista.isNotEmpty()) {
            constructor.setNeutralButton("Limpiar notificaciones") { _, _ ->
                DuenoRepo.limpiarNotificaciones()
                host.actualizarBadgeNotificaciones()
                Avisos.mostrar(host, "Notificaciones borradas")
            }
        }
        val dialogo = constructor.create()
        dialogo.show()
        dialogo.window?.setBackgroundDrawable(ContextCompat.getDrawable(host, R.drawable.bg_dialog_rounded))
    }

    private class Estilo(val fondo: Int, val color: Int, val icono: Int)

    private fun estilo(n: NotificacionDueno) = when (n.tipo) {
        TipoNotificacion.CANCELACION -> Estilo(R.drawable.bg_icon_orange, R.color.accent_orange, R.drawable.ic_cancel)
        TipoNotificacion.TURNO -> Estilo(R.drawable.bg_icon_purple, R.color.accent_purple, R.drawable.ic_calendar)
        TipoNotificacion.ACCESO -> Estilo(R.drawable.bg_icon_teal, R.color.success_green, R.drawable.ic_check_circle)
        TipoNotificacion.MASCOTA -> Estilo(R.drawable.bg_icon_teal, R.color.primary_teal, R.drawable.ic_dog)
        TipoNotificacion.CUENTA -> Estilo(R.drawable.bg_icon_orange, R.color.accent_orange, R.drawable.ic_lock)
    }

    /** "Ahora mismo", "Hace 5 min", "Hace 2 h" o "Hace 3 días". */
    private fun tiempo(creada: LocalDateTime): String {
        val minutos = Duration.between(creada, LocalDateTime.now()).toMinutes()
        return when {
            minutos < 1 -> "Ahora mismo"
            minutos < 60 -> "Hace $minutos min"
            minutos < 24 * 60 -> "Hace ${minutos / 60} h"
            else -> "Hace ${minutos / (24 * 60)} días"
        }
    }

    private fun tarjeta(n: NotificacionDueno): View {
        val estilo = estilo(n)
        val tarjeta = MaterialCardView(host).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(10) }
            setCardBackgroundColor(ContextCompat.getColor(host, R.color.white))
            radius = dp(12).toFloat()
            cardElevation = dp(1).toFloat()
            strokeWidth = dp(1)
            strokeColor = ContextCompat.getColor(host, R.color.divider_light)
        }

        val fila = RelativeLayout(host).apply {
            layoutParams = RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.MATCH_PARENT, RelativeLayout.LayoutParams.WRAP_CONTENT
            )
            setPadding(dp(12), dp(12), dp(12), dp(12))
        }

        val iconoId = View.generateViewId()
        val circulo = FrameLayout(host).apply {
            id = iconoId
            layoutParams = RelativeLayout.LayoutParams(dp(36), dp(36))
            setBackgroundResource(estilo.fondo)
        }
        circulo.addView(ImageView(host).apply {
            layoutParams = FrameLayout.LayoutParams(dp(18), dp(18)).apply { gravity = Gravity.CENTER }
            setImageResource(estilo.icono)
            setColorFilter(ContextCompat.getColor(host, estilo.color))
        })
        fila.addView(circulo)

        val textos = LinearLayout(host).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.MATCH_PARENT, RelativeLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                addRule(RelativeLayout.END_OF, iconoId)
                marginStart = dp(12)
            }
        }
        textos.addView(TextView(host).apply {
            text = n.titulo
            setTextColor(ContextCompat.getColor(host, R.color.black))
            setTypeface(typeface, Typeface.BOLD)
            textSize = 14f
        })
        textos.addView(TextView(host).apply {
            text = n.mensaje
            setTextColor(ContextCompat.getColor(host, R.color.text_gray))
            textSize = 12f
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = dp(2) }
        })
        textos.addView(TextView(host).apply {
            text = tiempo(n.creada)
            setTextColor(ContextCompat.getColor(host, R.color.text_gray))
            textSize = 10f
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = dp(4) }
        })
        fila.addView(textos)
        tarjeta.addView(fila)
        return tarjeta
    }
}
