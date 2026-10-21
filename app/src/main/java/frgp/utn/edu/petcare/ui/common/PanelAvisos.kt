package frgp.utn.edu.petcare.ui.common

import android.graphics.Color
import android.graphics.Typeface
import android.view.LayoutInflater
import android.view.View
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.material.bottomsheet.BottomSheetBehavior
import com.google.android.material.bottomsheet.BottomSheetDialog
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.model.TipoNotificacion
import java.time.LocalDate
import java.time.LocalDateTime

/**
 * Panel de notificaciones del dueño y del veterinario: sube desde abajo, agrupa los avisos por día
 * (hoy, ayer, esta semana, anteriores), resalta los que no se leyeron y se puede vaciar de una vez.
 */
object PanelAvisos {

    /** Un aviso listo para mostrar; [origen] guarda el objeto original para que quien llama sepa cuál borrar. */
    class Item(
        val tipo: TipoNotificacion,
        val titulo: String,
        val mensaje: String,
        val creada: LocalDateTime,
        val sinLeer: Boolean,
        val origen: Any? = null
    )

    /** Texto del grupo de fecha en el que cae un aviso. */
    fun grupo(fecha: LocalDate, hoy: LocalDate = LocalDate.now()): String = when {
        fecha == hoy -> "HOY"
        fecha == hoy.minusDays(1) -> "AYER"
        !fecha.isBefore(hoy.minusDays(6)) -> "ESTA SEMANA"
        else -> "ANTERIORES"
    }

    /** Texto de la bajada del título según cuántos avisos quedan sin leer. */
    fun resumen(total: Int, sinLeer: Int): String = when {
        total == 0 -> "Estás al día"
        sinLeer == 0 -> "Todo leído"
        sinLeer == 1 -> "1 sin leer"
        else -> "$sinLeer sin leer"
    }

    fun mostrar(
        actividad: AppCompatActivity,
        avisos: List<Item>,
        alBorrar: (Item) -> Unit,
        alBorrarTodas: () -> Unit
    ): BottomSheetDialog {
        val dp = { valor: Int -> (valor * actividad.resources.displayMetrics.density).toInt() }
        val restantes = avisos.sortedByDescending { it.creada }.toMutableList()
        val hoja = BottomSheetDialog(actividad)
        val vista = LayoutInflater.from(actividad).inflate(R.layout.panel_avisos, null, false)
        hoja.setContentView(vista)

        val contenedor = vista.findViewById<LinearLayout>(R.id.contenedorAvisos)
        val resumenView = vista.findViewById<TextView>(R.id.tvResumenAvisos)
        val vacio = vista.findViewById<View>(R.id.estadoVacio)
        val botonTodas = vista.findViewById<TextView>(R.id.btnBorrarTodas)

        fun encabezado(texto: String) = TextView(actividad).apply {
            this.text = texto
            setTextColor(ContextCompat.getColor(actividad, R.color.text_gray))
            textSize = 12f
            letterSpacing = 0.08f
            setTypeface(typeface, Typeface.BOLD)
            setPadding(dp(4), dp(10), 0, dp(8))
        }

        fun pintar() {
            contenedor.removeAllViews()
            TarjetaPermiso.crear(actividad)?.let { contenedor.addView(it) }
            val sinLeer = restantes.count { it.sinLeer }
            resumenView.text = resumen(restantes.size, sinLeer)
            resumenView.setTextColor(
                ContextCompat.getColor(actividad, if (sinLeer > 0) R.color.primary_teal else R.color.text_aviso)
            )
            resumenView.setTypeface(null, if (sinLeer > 0) Typeface.BOLD else Typeface.NORMAL)
            botonTodas.visibility = if (restantes.isEmpty()) View.GONE else View.VISIBLE
            vacio.visibility = if (restantes.isEmpty()) View.VISIBLE else View.GONE

            val hoy = LocalDate.now()
            var grupoActual: String? = null
            restantes.forEach { item ->
                val grupo = grupo(item.creada.toLocalDate(), hoy)
                if (grupo != grupoActual) {
                    contenedor.addView(encabezado(grupo))
                    grupoActual = grupo
                }
                contenedor.addView(
                    TarjetaAviso.crear(
                        actividad, item.tipo, item.titulo, item.mensaje, item.creada, item.sinLeer,
                        alBorrar = { tarjeta ->
                            tarjeta.isEnabled = false
                            tarjeta.animate().alpha(0f).translationX(dp(48).toFloat()).setDuration(160).withEndAction {
                                if (restantes.remove(item)) {
                                    alBorrar(item)
                                    pintar()
                                }
                            }.start()
                        }
                    )
                )
            }
        }

        botonTodas.setOnClickListener {
            AlertDialog.Builder(actividad)
                .setTitle("Borrar todas las notificaciones")
                .setMessage("Esta acción no se puede deshacer.")
                .setPositiveButton("Borrar") { _, _ ->
                    restantes.clear()
                    alBorrarTodas()
                    pintar()
                }
                .setNegativeButton("Cancelar", null)
                .show()
        }

        pintar()
        hoja.setOnShowListener {
            // El fondo redondeado lo pone el propio panel: el contenedor de la hoja queda transparente
            val contenedorHoja = hoja.findViewById<FrameLayout>(com.google.android.material.R.id.design_bottom_sheet)
            contenedorHoja?.setBackgroundColor(Color.TRANSPARENT)
            contenedorHoja?.let {
                BottomSheetBehavior.from(it).apply {
                    state = BottomSheetBehavior.STATE_EXPANDED
                    skipCollapsed = true
                }
            }
        }
        hoja.show()
        return hoja
    }
}
