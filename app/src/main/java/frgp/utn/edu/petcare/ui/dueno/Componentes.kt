package frgp.utn.edu.petcare.ui.dueno

import android.app.DatePickerDialog
import frgp.utn.edu.petcare.ui.common.Avisos
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.data.DuenoRepo
import frgp.utn.edu.petcare.ui.common.Efectos

/** Piezas de interfaz que usan varias secciones del dueño. */
object Componentes {

    /** Tarjeta "no hay nada por acá", con un botón opcional. */
    fun estadoVacio(
        host: DuenoActivity, padre: ViewGroup, icono: Int, titulo: String, mensaje: String,
        textoBoton: String? = null, alBoton: (() -> Unit)? = null
    ): View {
        val vista = host.layoutInflater.inflate(R.layout.view_empty_state, padre, false)
        vista.findViewById<ImageView>(R.id.ivEmptyIcon).setImageResource(icono)
        vista.findViewById<TextView>(R.id.tvEmptyTitle).text = titulo
        vista.findViewById<TextView>(R.id.tvEmptyMessage).text = mensaje
        if (textoBoton != null && alBoton != null) {
            vista.findViewById<TextView>(R.id.tvEmptyCta).apply {
                text = textoBoton
                visibility = View.VISIBLE
                setOnClickListener {
                    Efectos.rebote(it)
                    alBoton()
                }
            }
        }
        return vista
    }

    /** "Al día" o "Vacuna pendiente", según tenga una vacuna agendada para los próximos días. */
    fun chipEstadoMascota(host: DuenoActivity, chip: TextView?, nombreMascota: String) {
        chip ?: return
        val pendiente = DuenoRepo.tieneVacunaPendiente(nombreMascota)
        chip.setText(if (pendiente) R.string.estado_vacuna_pendiente else R.string.estado_al_dia)
        chip.setBackgroundResource(if (pendiente) R.drawable.bg_chip_warn else R.drawable.bg_chip_ok)
        chip.setTextColor(ContextCompat.getColor(host, if (pendiente) R.color.accent_orange_dark else R.color.success_green))
    }

    /** Fila "Hoy / Mañana / En N días" de los eventos próximos. */
    fun diasHasta(fecha: java.time.LocalDate): Long =
        java.time.temporal.ChronoUnit.DAYS.between(java.time.LocalDate.now(), fecha)

    /** Calendario para elegir una fecha de nacimiento; no deja elegir días que todavía no pasaron. */
    fun elegirFechaNacimiento(host: DuenoActivity, inicial: java.time.LocalDate?, alElegir: (java.time.LocalDate) -> Unit) {
        val base = inicial ?: java.time.LocalDate.now()
        DatePickerDialog(host, { _, anio, mes, dia ->
            val elegida = java.time.LocalDate.of(anio, mes + 1, dia)
            if (elegida.isAfter(java.time.LocalDate.now())) {
                Avisos.mostrar(host, "No podés seleccionar una fecha de nacimiento futura")
            } else {
                alElegir(elegida)
            }
        }, base.year, base.monthValue - 1, base.dayOfMonth).apply {
            datePicker.maxDate = System.currentTimeMillis()
        }.show()
    }
}
