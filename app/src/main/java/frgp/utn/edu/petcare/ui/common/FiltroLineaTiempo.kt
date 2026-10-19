package frgp.utn.edu.petcare.ui.common

import android.app.DatePickerDialog
import android.content.Context
import android.text.Editable
import android.text.TextWatcher
import android.view.Gravity
import android.view.View
import android.widget.EditText
import android.widget.HorizontalScrollView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.content.ContextCompat
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.util.Fechas
import java.time.LocalDate

/**
 * Buscador y filtros de una línea de tiempo: texto libre, tipo de evento y rango de fechas.
 * [vista] se agrega arriba de la lista y [admite] decide qué filas quedan; cada cambio llama a [alCambiar].
 */
class FiltroLineaTiempo(
    private val contexto: Context,
    private val tipos: List<String>,
    private val alCambiar: () -> Unit
) {
    private var consulta = ""
    private var tipo: String? = null
    private var desde: LocalDate? = null
    private var hasta: LocalDate? = null

    private val chips = mutableListOf<Pair<String?, TextView>>()
    private val botonDesde: TextView
    private val botonHasta: TextView
    private val limpiar: TextView

    val vista: View

    private fun dp(v: Int) = (v * contexto.resources.displayMetrics.density).toInt()

    init {
        val raiz = LinearLayout(contexto).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(8), dp(16), dp(4))
        }

        // ---- Buscador
        val caja = LinearLayout(contexto).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundResource(R.drawable.bg_login_field)
            setPadding(dp(16), 0, dp(16), 0)
            layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp(46))
        }
        caja.addView(ImageView(contexto).apply {
            layoutParams = LinearLayout.LayoutParams(dp(20), dp(20))
            setImageResource(R.drawable.ic_search)
            setColorFilter(ContextCompat.getColor(contexto, R.color.text_gray))
            contentDescription = null
        })
        caja.addView(EditText(contexto).apply {
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.MATCH_PARENT, 1f)
                .apply { marginStart = dp(10) }
            background = null
            hint = "Buscar en el historial"
            inputType = android.text.InputType.TYPE_CLASS_TEXT
            maxLines = 1
            textSize = 15f
            setTextColor(ContextCompat.getColor(contexto, R.color.black))
            setHintTextColor(ContextCompat.getColor(contexto, R.color.text_gray))
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, st: Int, c: Int, a: Int) {}
                override fun onTextChanged(s: CharSequence?, st: Int, b: Int, c: Int) {
                    consulta = s.toString().trim()
                    alCambiar()
                    actualizar()
                }
                override fun afterTextChanged(s: Editable?) {}
            })
        })
        raiz.addView(caja)

        // ---- Tipos de evento
        if (tipos.size > 1) {
            val fila = LinearLayout(contexto).apply { orientation = LinearLayout.HORIZONTAL }
            (listOf<String?>(null) + tipos).forEach { t ->
                val chip = TextView(contexto, null, 0, R.style.PetFilterChip).apply {
                    text = t ?: "Todos"
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply { marginEnd = dp(8) }
                    setOnClickListener {
                        tipo = t
                        alCambiar()
                        actualizar()
                    }
                }
                chips.add(t to chip)
                fila.addView(chip)
            }
            raiz.addView(HorizontalScrollView(contexto).apply {
                isHorizontalScrollBarEnabled = false
                clipToPadding = false
                setPadding(0, dp(10), 0, dp(4))
                addView(fila)
            })
        }

        // ---- Fechas
        val fechas = LinearLayout(contexto).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(6), 0, dp(2))
        }
        botonDesde = botonFecha { elegir(desde) { desde = it } }
        botonHasta = botonFecha { elegir(hasta) { hasta = it } }
        limpiar = TextView(contexto).apply {
            text = "Limpiar"
            textSize = 13f
            setTextColor(ContextCompat.getColor(contexto, R.color.primary_teal))
            setPadding(dp(8), dp(8), dp(8), dp(8))
            setOnClickListener {
                consulta = ""
                tipo = null
                desde = null
                hasta = null
                (caja.getChildAt(1) as EditText).setText("")
                alCambiar()
                actualizar()
            }
        }
        fechas.addView(botonDesde)
        fechas.addView(botonHasta)
        fechas.addView(limpiar)
        raiz.addView(fechas)

        vista = raiz
        actualizar()
    }

    private fun botonFecha(alTocar: () -> Unit) = TextView(contexto).apply {
        layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
            .apply { marginEnd = dp(8) }
        gravity = Gravity.CENTER
        textSize = 13f
        setPadding(dp(10), dp(9), dp(10), dp(9))
        setOnClickListener { alTocar() }
    }

    private fun elegir(actual: LocalDate?, guardar: (LocalDate?) -> Unit) {
        val base = actual ?: LocalDate.now()
        DatePickerDialog(contexto, { _, a, m, d ->
            guardar(LocalDate.of(a, m + 1, d))
            alCambiar()
            actualizar()
        }, base.year, base.monthValue - 1, base.dayOfMonth).apply {
            setButton(DatePickerDialog.BUTTON_NEUTRAL, "Quitar") { _, _ ->
                guardar(null)
                alCambiar()
                actualizar()
            }
        }.show()
    }

    private fun actualizar() {
        chips.forEach { (t, chip) ->
            val activo = t == tipo
            chip.setBackgroundResource(if (activo) R.drawable.bg_pill_teal else R.drawable.bg_pill_white)
            chip.setTextColor(ContextCompat.getColor(contexto, if (activo) R.color.white else R.color.text_gray))
        }
        listOf(botonDesde to desde, botonHasta to hasta).forEachIndexed { i, (boton, fecha) ->
            boton.text = (if (i == 0) "Desde: " else "Hasta: ") + (fecha?.let { Fechas.corta(it) } ?: "—")
            boton.setBackgroundResource(if (fecha != null) R.drawable.bg_pill_teal else R.drawable.bg_pill_white)
            boton.setTextColor(ContextCompat.getColor(contexto, if (fecha != null) R.color.white else R.color.text_gray))
        }
        limpiar.visibility =
            if (consulta.isNotEmpty() || tipo != null || desde != null || hasta != null) View.VISIBLE else View.GONE
    }

    /** True si hay algún filtro puesto (para mostrar "sin resultados" en vez de "sin eventos"). */
    val activo: Boolean get() = consulta.isNotEmpty() || tipo != null || desde != null || hasta != null

    fun admite(texto: String, tipoEvento: String, fecha: LocalDate?): Boolean {
        if (tipo != null && !tipoEvento.equals(tipo, ignoreCase = true)) return false
        if (desde != null && (fecha == null || fecha.isBefore(desde))) return false
        if (hasta != null && (fecha == null || fecha.isAfter(hasta))) return false
        return consulta.isEmpty() || texto.contains(consulta, ignoreCase = true)
    }
}
