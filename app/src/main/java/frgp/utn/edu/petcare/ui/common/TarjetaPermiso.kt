package frgp.utn.edu.petcare.ui.common

import android.content.Context
import android.graphics.Typeface
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.google.android.material.button.MaterialButton
import com.google.android.material.card.MaterialCardView
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.data.avisos.AvisosDelSistema

/** Aviso, arriba de la lista de notificaciones, de que el teléfono tiene apagadas las de la app. */
object TarjetaPermiso {

    /** Devuelve la tarjeta, o null si las notificaciones del teléfono ya están permitidas. */
    fun crear(contexto: Context): View? {
        if (AvisosDelSistema.permitido(contexto)) return null
        val dp = { valor: Int -> (valor * contexto.resources.displayMetrics.density).toInt() }
        val tarjeta = MaterialCardView(contexto).apply {
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(14) }
            setCardBackgroundColor(ContextCompat.getColor(contexto, R.color.light_orange))
            radius = dp(12).toFloat()
            cardElevation = 0f
            strokeWidth = dp(1)
            strokeColor = ContextCompat.getColor(contexto, R.color.accent_orange)
        }
        val contenido = LinearLayout(contexto).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(14), dp(12), dp(14), dp(12))
        }
        contenido.addView(TextView(contexto).apply {
            text = "Las notificaciones del teléfono están desactivadas"
            setTextColor(ContextCompat.getColor(contexto, R.color.brand_navy))
            textSize = 14.5f
            setTypeface(typeface, Typeface.BOLD)
        })
        contenido.addView(TextView(contexto).apply {
            text = "Activalas para que te avisemos de tus turnos aunque la app esté cerrada."
            setTextColor(ContextCompat.getColor(contexto, R.color.text_gray))
            textSize = 13f
            setPadding(0, dp(4), 0, dp(10))
        })
        contenido.addView(MaterialButton(contexto).apply {
            text = "Activar"
            isAllCaps = false
            backgroundTintList = ContextCompat.getColorStateList(contexto, R.color.primary_teal)
            setOnClickListener { AvisosDelSistema.abrirAjustes(contexto) }
        })
        tarjeta.addView(contenido)
        return tarjeta
    }
}
