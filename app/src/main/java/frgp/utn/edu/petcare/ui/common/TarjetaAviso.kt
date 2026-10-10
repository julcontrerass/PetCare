package frgp.utn.edu.petcare.ui.common

import android.content.Context
import android.graphics.Typeface
import android.view.Gravity
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.RelativeLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.google.android.material.card.MaterialCardView
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.model.TipoNotificacion
import java.time.Duration
import java.time.LocalDateTime

/** Una notificación en la lista del dueño o del veterinario: ícono según el tipo, título, mensaje y hora. */
object TarjetaAviso {

    private class Estilo(val fondo: Int, val color: Int, val icono: Int)

    private fun estilo(tipo: TipoNotificacion) = when (tipo) {
        TipoNotificacion.CANCELACION -> Estilo(R.drawable.bg_icon_orange, R.color.accent_orange, R.drawable.ic_cancel)
        TipoNotificacion.TURNO -> Estilo(R.drawable.bg_icon_purple, R.color.accent_purple, R.drawable.ic_calendar)
        TipoNotificacion.COMPLETADO -> Estilo(R.drawable.bg_icon_green, R.color.success_green, R.drawable.ic_check_circle)
        TipoNotificacion.ACCESO -> Estilo(R.drawable.bg_icon_teal, R.color.success_green, R.drawable.ic_check_circle)
        TipoNotificacion.MASCOTA -> Estilo(R.drawable.bg_icon_teal, R.color.primary_teal, R.drawable.ic_dog)
        TipoNotificacion.CUENTA -> Estilo(R.drawable.bg_icon_orange, R.color.accent_orange, R.drawable.ic_lock)
    }

    /** "Ahora mismo", "Hace 5 min", "Hace 2 h" o "Hace 3 días". */
    fun tiempo(creada: LocalDateTime, ahora: LocalDateTime = LocalDateTime.now()): String {
        val minutos = Duration.between(creada, ahora).toMinutes()
        return when {
            minutos < 1 -> "Ahora mismo"
            minutos < 60 -> "Hace $minutos min"
            minutos < 24 * 60 -> "Hace ${minutos / 60} h"
            else -> "Hace ${minutos / (24 * 60)} días"
        }
    }

    fun crear(
        contexto: Context, tipo: TipoNotificacion, titulo: String, mensaje: String, creada: LocalDateTime,
        sinLeer: Boolean = false
    ): View {
        val dp = { valor: Int -> (valor * contexto.resources.displayMetrics.density).toInt() }
        val estilo = estilo(tipo)
        val tarjeta = MaterialCardView(contexto).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(10) }
            setCardBackgroundColor(ContextCompat.getColor(contexto, R.color.white))
            radius = dp(12).toFloat()
            cardElevation = dp(1).toFloat()
            strokeWidth = dp(1)
            strokeColor = ContextCompat.getColor(contexto, if (sinLeer) R.color.primary_teal else R.color.divider_light)
        }

        val fila = RelativeLayout(contexto).apply {
            layoutParams = RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.MATCH_PARENT, RelativeLayout.LayoutParams.WRAP_CONTENT
            )
            setPadding(dp(12), dp(12), dp(12), dp(12))
        }

        val iconoId = View.generateViewId()
        val circulo = FrameLayout(contexto).apply {
            id = iconoId
            layoutParams = RelativeLayout.LayoutParams(dp(36), dp(36))
            setBackgroundResource(estilo.fondo)
        }
        circulo.addView(ImageView(contexto).apply {
            layoutParams = FrameLayout.LayoutParams(dp(18), dp(18)).apply { gravity = Gravity.CENTER }
            setImageResource(estilo.icono)
            setColorFilter(ContextCompat.getColor(contexto, estilo.color))
        })
        fila.addView(circulo)

        val textos = LinearLayout(contexto).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = RelativeLayout.LayoutParams(
                RelativeLayout.LayoutParams.MATCH_PARENT, RelativeLayout.LayoutParams.WRAP_CONTENT
            ).apply {
                addRule(RelativeLayout.END_OF, iconoId)
                marginStart = dp(12)
            }
        }
        textos.addView(TextView(contexto).apply {
            text = titulo
            setTextColor(ContextCompat.getColor(contexto, R.color.black))
            setTypeface(typeface, Typeface.BOLD)
            textSize = 14f
        })
        textos.addView(TextView(contexto).apply {
            text = mensaje
            setTextColor(ContextCompat.getColor(contexto, R.color.text_gray))
            textSize = 12f
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { topMargin = dp(2) }
        })
        textos.addView(TextView(contexto).apply {
            text = tiempo(creada)
            setTextColor(ContextCompat.getColor(contexto, R.color.text_gray))
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
