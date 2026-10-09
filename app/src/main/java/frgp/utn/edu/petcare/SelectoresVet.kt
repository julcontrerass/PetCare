package frgp.utn.edu.petcare

import android.graphics.Paint
import android.graphics.Typeface
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.GridLayout
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import java.time.LocalDate
import java.time.YearMonth

private fun dp(ctx: android.content.Context, valor: Int) = (valor * ctx.resources.displayMetrics.density).toInt()

private fun crearDialogo(activity: AppCompatActivity, vista: View): AlertDialog {
    val dialog = AlertDialog.Builder(activity).setView(vista).create()
    dialog.window?.setBackgroundDrawableResource(android.R.color.transparent)
    return dialog
}

/** Calendario mensual: los días en que el veterinario no atiende se muestran en negro y no se pueden elegir. */
object SelectorFechaVet {

    private val SEMANA = arrayOf("L", "M", "X", "J", "V", "S", "D")

    fun mostrar(activity: AppCompatActivity, inicial: LocalDate?, alElegir: (LocalDate) -> Unit) {
        val vista = LayoutInflater.from(activity).inflate(R.layout.dialog_fecha_vet, null)
        val dialog = crearDialogo(activity, vista)
        val hoy = LocalDate.now()
        val mesActual = YearMonth.from(hoy)
        var mes = YearMonth.from(inicial ?: hoy)

        val tvMes = vista.findViewById<TextView>(R.id.tvMes)
        val grid = vista.findViewById<GridLayout>(R.id.gridDias)
        val btnAnterior = vista.findViewById<View>(R.id.btnMesAnterior)
        val btnSiguiente = vista.findViewById<View>(R.id.btnMesSiguiente)

        val diasActivos = PerfilVetRepo.todosLosDias.filterIndexed { i, _ -> PerfilVetRepo.diasSeleccionados[i] }
        vista.findViewById<TextView>(R.id.tvDiasAtencion).text =
            if (diasActivos.isEmpty()) "No configuraste días de atención en tu perfil"
            else "Atendés: " + diasActivos.joinToString(", ") { it.take(3) }

        val encabezado = vista.findViewById<LinearLayout>(R.id.headerSemana)
        SEMANA.forEach { letra ->
            encabezado.addView(TextView(activity).apply {
                text = letra
                gravity = Gravity.CENTER
                setTextColor(ContextCompat.getColor(activity, R.color.text_gray))
                textSize = 12f
                setTypeface(typeface, Typeface.BOLD)
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
            })
        }

        fun pintar() {
            tvMes.text = Fechas.mesAnio(mes.atDay(1))
            btnAnterior.alpha = if (mes.isAfter(mesActual)) 1f else 0.35f
            grid.removeAllViews()
            val offset = mes.atDay(1).dayOfWeek.value - 1
            for (dia in 1..mes.lengthOfMonth()) {
                val fecha = mes.atDay(dia)
                val pos = offset + dia - 1
                val pasado = fecha.isBefore(hoy)
                val bloqueado = !pasado && !DisponibilidadVet.trabajaEl(fecha)
                val elegido = fecha == inicial
                val celda = TextView(activity).apply {
                    text = dia.toString()
                    gravity = Gravity.CENTER
                    textSize = 14f
                    layoutParams = GridLayout.LayoutParams(
                        GridLayout.spec(pos / 7), GridLayout.spec(pos % 7, 1f)
                    ).apply {
                        width = 0
                        height = dp(activity, 44)
                        setMargins(dp(activity, 2), dp(activity, 2), dp(activity, 2), dp(activity, 2))
                    }
                }
                val ctx = activity
                when {
                    pasado -> celda.setTextColor(ContextCompat.getColor(ctx, R.color.divider_color))
                    bloqueado -> {
                        celda.setBackgroundResource(R.drawable.bg_dia_bloqueado)
                        celda.setTextColor(ContextCompat.getColor(ctx, R.color.white))
                        celda.setOnClickListener {
                            Toast.makeText(
                                ctx, "No atendés los ${DisponibilidadVet.nombreDia(fecha).lowercase()}", Toast.LENGTH_SHORT
                            ).show()
                        }
                    }
                    else -> {
                        celda.setTextColor(ContextCompat.getColor(ctx, R.color.brand_navy))
                        celda.setTypeface(celda.typeface, Typeface.BOLD)
                        if (elegido) {
                            celda.setBackgroundResource(R.drawable.bg_dia_seleccionado)
                            celda.setTextColor(ContextCompat.getColor(ctx, R.color.white))
                        } else if (fecha == hoy) {
                            celda.setBackgroundResource(R.drawable.bg_day_today)
                        }
                        celda.setOnClickListener {
                            alElegir(fecha)
                            dialog.dismiss()
                        }
                    }
                }
                grid.addView(celda)
            }
        }

        btnAnterior.setOnClickListener {
            if (mes.isAfter(mesActual)) { mes = mes.minusMonths(1); pintar() }
        }
        btnSiguiente.setOnClickListener { mes = mes.plusMonths(1); pintar() }
        vista.findViewById<View>(R.id.btnCancelarDialogo).setOnClickListener { dialog.dismiss() }
        pintar()
        dialog.show()
    }
}

/** Grilla de horarios del día elegido: solo se pueden tomar los que están libres dentro de la atención. */
object SelectorHoraVet {

    fun mostrar(
        activity: AppCompatActivity, fecha: LocalDate, horaActual: String?, ignorarId: String?,
        alElegir: (String) -> Unit
    ) {
        val vista = LayoutInflater.from(activity).inflate(R.layout.dialog_hora_vet, null)
        val dialog = crearDialogo(activity, vista)
        val horarios = DisponibilidadVet.horarios(fecha, ignorarId)

        vista.findViewById<TextView>(R.id.tvResumenHorario).text =
            "${Fechas.relativa(fecha)} · ${Fechas.corta(fecha)} · atendés de " +
                "${PerfilVetRepo.horaApertura} a ${PerfilVetRepo.horaCierre} hs"

        val grid = vista.findViewById<GridLayout>(R.id.gridHoras)
        horarios.forEachIndexed { i, h ->
            val chip = TextView(activity).apply {
                text = h.hora
                gravity = Gravity.CENTER
                textSize = 14f
                setTypeface(typeface, Typeface.BOLD)
                layoutParams = GridLayout.LayoutParams(
                    GridLayout.spec(i / 3), GridLayout.spec(i % 3, 1f)
                ).apply {
                    width = 0
                    height = dp(activity, 44)
                    setMargins(dp(activity, 4), dp(activity, 4), dp(activity, 4), dp(activity, 4))
                }
            }
            when {
                !h.libre -> {
                    chip.setBackgroundResource(R.drawable.bg_slot_ocupado)
                    chip.setTextColor(ContextCompat.getColor(activity, R.color.text_gray))
                    chip.paintFlags = chip.paintFlags or Paint.STRIKE_THRU_TEXT_FLAG
                    chip.setOnClickListener {
                        Toast.makeText(activity, "Ese horario no está disponible", Toast.LENGTH_SHORT).show()
                    }
                }
                h.hora == horaActual -> {
                    chip.setBackgroundResource(R.drawable.bg_time_chip_selected)
                    chip.setTextColor(ContextCompat.getColor(activity, R.color.white))
                    chip.setOnClickListener { alElegir(h.hora); dialog.dismiss() }
                }
                else -> {
                    chip.setBackgroundResource(R.drawable.bg_time_chip)
                    chip.setTextColor(ContextCompat.getColor(activity, R.color.brand_navy))
                    chip.setOnClickListener { alElegir(h.hora); dialog.dismiss() }
                }
            }
            grid.addView(chip)
        }
        vista.findViewById<View>(R.id.tvSinHorarios).visibility =
            if (horarios.none { it.libre }) View.VISIBLE else View.GONE
        vista.findViewById<View>(R.id.btnCancelarDialogo).setOnClickListener { dialog.dismiss() }
        dialog.show()
    }
}
