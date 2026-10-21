package frgp.utn.edu.petcare.ui.common

import android.content.Context
import android.view.LayoutInflater
import android.view.View
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat
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

    /**
     * Arma la tarjeta. Si la notificación está sin leer se resalta con un fondo suave y un punto;
     * [alBorrar] recibe la tarjeta cuando se toca la cruz (si es null, la cruz no se muestra).
     */
    fun crear(
        contexto: Context, tipo: TipoNotificacion, titulo: String, mensaje: String, creada: LocalDateTime,
        sinLeer: Boolean = false, alBorrar: ((View) -> Unit)? = null
    ): View {
        val estilo = estilo(tipo)
        val tarjeta = LayoutInflater.from(contexto).inflate(R.layout.item_aviso, null, false)
        tarjeta.setBackgroundResource(if (sinLeer) R.drawable.bg_aviso_sin_leer else R.drawable.bg_aviso_tarjeta)
        tarjeta.findViewById<FrameLayout>(R.id.circuloAviso).setBackgroundResource(estilo.fondo)
        tarjeta.findViewById<ImageView>(R.id.ivIconoAviso).apply {
            setImageResource(estilo.icono)
            setColorFilter(ContextCompat.getColor(contexto, estilo.color))
        }
        tarjeta.findViewById<TextView>(R.id.tvTituloAviso).text = titulo
        tarjeta.findViewById<TextView>(R.id.tvMensajeAviso).text = mensaje
        tarjeta.findViewById<TextView>(R.id.tvHoraAviso).text = tiempo(creada)
        tarjeta.findViewById<View>(R.id.puntoSinLeer).visibility = if (sinLeer) View.VISIBLE else View.GONE
        tarjeta.findViewById<View>(R.id.btnBorrarAviso).apply {
            if (alBorrar == null) visibility = View.GONE else setOnClickListener { alBorrar(tarjeta) }
        }
        return tarjeta
    }
}
