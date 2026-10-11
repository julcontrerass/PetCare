package frgp.utn.edu.petcare.ui.common

import android.content.Context
import android.graphics.Typeface
import android.view.View
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import com.google.android.material.card.MaterialCardView
import frgp.utn.edu.petcare.R
import java.time.LocalDate

/** Tarjetas de la ficha de una mascota que comparten el dueño y el veterinario: alertas clínicas y peso. */
object FichaClinica {

    private fun dp(contexto: Context, valor: Int) = (valor * contexto.resources.displayMetrics.density).toInt()

    private fun tarjeta(contexto: Context, fondo: Int, borde: Int): MaterialCardView = MaterialCardView(contexto).apply {
        layoutParams = LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply {
            topMargin = dp(contexto, 4)
            bottomMargin = dp(contexto, 14)
        }
        setCardBackgroundColor(ContextCompat.getColor(contexto, fondo))
        radius = dp(contexto, 14).toFloat()
        cardElevation = 0f
        strokeWidth = dp(contexto, 1)
        strokeColor = ContextCompat.getColor(contexto, borde)
    }

    /**
     * Alertas que hay que tener presentes en cada consulta (alergias, carácter, condiciones crónicas). Con
     * [alEditar] el veterinario puede cambiarlas; sin él, solo se leen.
     */
    fun alertas(contexto: Context, texto: String, alEditar: (() -> Unit)? = null): View {
        val hay = texto.isNotBlank()
        val tarjeta = tarjeta(
            contexto, if (hay) R.color.light_orange else R.color.white,
            if (hay) R.color.accent_orange else R.color.divider_light
        )
        val contenido = LinearLayout(contexto).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(contexto, 14), dp(contexto, 12), dp(contexto, 14), dp(contexto, 12))
        }
        contenido.addView(TextView(contexto).apply {
            text = if (hay) "Alertas clínicas" else "Alertas clínicas: ninguna cargada"
            setTextColor(ContextCompat.getColor(contexto, R.color.brand_navy))
            textSize = 14f
            setTypeface(typeface, Typeface.BOLD)
        })
        if (hay) {
            contenido.addView(TextView(contexto).apply {
                this.text = texto
                setTextColor(ContextCompat.getColor(contexto, R.color.brand_navy))
                textSize = 14f
                setPadding(0, dp(contexto, 4), 0, 0)
            })
        }
        if (alEditar != null) {
            contenido.addView(TextView(contexto).apply {
                text = if (hay) "Editar alertas" else "Agregar alertas (alergias, carácter, condiciones)"
                setTextColor(ContextCompat.getColor(contexto, R.color.primary_teal))
                textSize = 13.5f
                setTypeface(typeface, Typeface.BOLD)
                setPadding(0, dp(contexto, 8), 0, 0)
                setOnClickListener { alEditar() }
            })
        }
        tarjeta.addView(contenido)
        return tarjeta
    }

    /** La evolución del peso; null si todavía no hay al menos dos mediciones. */
    fun peso(contexto: Context, puntos: List<Pair<LocalDate, Double>>): View? {
        if (puntos.size < 2) return null
        val tarjeta = tarjeta(contexto, R.color.white, R.color.divider_light)
        val contenido = LinearLayout(contexto).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(contexto, 14), dp(contexto, 12), dp(contexto, 14), dp(contexto, 8))
        }
        contenido.addView(TextView(contexto).apply {
            text = "Evolución del peso"
            setTextColor(ContextCompat.getColor(contexto, R.color.brand_navy))
            textSize = 14f
            setTypeface(typeface, Typeface.BOLD)
        })
        contenido.addView(GraficoPesoView(contexto).apply { this.puntos = puntos })
        tarjeta.addView(contenido)
        return tarjeta
    }
}
