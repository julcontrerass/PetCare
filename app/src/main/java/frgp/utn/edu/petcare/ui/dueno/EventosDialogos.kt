package frgp.utn.edu.petcare.ui.dueno

import android.app.DatePickerDialog
import frgp.utn.edu.petcare.ui.common.Avisos
import android.app.TimePickerDialog
import android.view.View
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.Spinner
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import com.google.android.material.bottomsheet.BottomSheetDialog
import frgp.utn.edu.petcare.Fechas
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.data.DuenoRepo
import frgp.utn.edu.petcare.model.EventoMascota
import java.time.LocalDate
import java.util.Locale

/** Ficha, edición y cancelación de un turno. Las usan el calendario y las pestañas de la mascota. */
class EventosDialogos(private val host: DuenoActivity) {

    private fun dp(valor: Int) = host.dp(valor)

    /** Ficha del turno en una hoja inferior, con las acciones editar y cancelar. */
    fun mostrarDetalle(evento: EventoMascota, alCambiar: () -> Unit = {}) {
        val hoja = BottomSheetDialog(host)
        val vista = host.layoutInflater.inflate(R.layout.bottom_sheet_turno, null)
        hoja.setContentView(vista)

        val estilo = EstiloCategoria.turno(evento.categoria)
        vista.findViewById<View>(R.id.flTurnoIcono).setBackgroundResource(estilo.fondo)
        vista.findViewById<ImageView>(R.id.ivTurnoIcono).apply {
            setImageResource(estilo.icono)
            setColorFilter(ContextCompat.getColor(host, estilo.color))
        }
        vista.findViewById<TextView>(R.id.tvTurnoTitulo).text = evento.categoria
        vista.findViewById<TextView>(R.id.tvTurnoMascota).text = evento.mascota

        val proximo = !evento.fecha.isBefore(LocalDate.now())
        vista.findViewById<TextView>(R.id.tvTurnoEstado).apply {
            text = if (proximo) "Próximo" else "Realizado"
            setBackgroundResource(if (proximo) R.drawable.bg_badge_orange else R.drawable.bg_badge_green)
            setTextColor(ContextCompat.getColor(host, if (proximo) R.color.accent_orange else R.color.success_green))
        }
        vista.findViewById<TextView>(R.id.tvTurnoFecha).text = Fechas.larga(evento.fecha)
        vista.findViewById<TextView>(R.id.tvTurnoHora).text = "${evento.hora} hs"
        vista.findViewById<TextView>(R.id.tvTurnoVet).text = evento.veterinario.ifEmpty { "Sin asignar" }
        val hayObservaciones = evento.observaciones.isNotEmpty()
        vista.findViewById<View>(R.id.rowTurnoObs).visibility = if (hayObservaciones) View.VISIBLE else View.GONE
        if (hayObservaciones) vista.findViewById<TextView>(R.id.tvTurnoObs).text = evento.observaciones

        // Un turno que ya pasó queda como registro: no se edita ni se cancela
        vista.findViewById<View>(R.id.btnTurnoCancelar).visibility = if (proximo) View.VISIBLE else View.GONE
        vista.findViewById<View>(R.id.btnTurnoEditar).visibility = if (proximo) View.VISIBLE else View.GONE
        vista.findViewById<View>(R.id.btnTurnoEditar).setOnClickListener {
            hoja.dismiss()
            editar(evento, alCambiar)
        }
        vista.findViewById<View>(R.id.btnTurnoCancelar).setOnClickListener {
            hoja.dismiss()
            val conVeterinario = evento.veterinario.takeIf { it.isNotEmpty() }?.let { " con $it" }.orEmpty()
            Avisos.confirmar(
                host, "¿Cancelar este turno?",
                "Vas a cancelar el turno de ${evento.mascota} (${evento.categoria}) del " +
                    "${Fechas.corta(evento.fecha)} a las ${evento.hora} hs$conVeterinario." +
                    if (evento.veterinario.isNotEmpty()) " Se le avisa al veterinario." else "",
                textoAceptar = "Cancelar turno"
            ) {
                DuenoRepo.cancelarEvento(evento)
                Avisos.mostrar(host, "Turno cancelado")
                alCambiar()
            }
        }
        hoja.show()
    }

    private fun campoSoloLectura(pista: String) = EditText(host).apply {
        hint = pista
        isFocusable = false
        isClickable = true
    }

    /** Formulario para cambiar fecha, hora, veterinario y observaciones de un turno. */
    fun editar(evento: EventoMascota, alCambiar: () -> Unit = {}) {
        val formulario = LinearLayout(host).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(16), dp(20), dp(4))
        }

        var fecha = evento.fecha
        val etFecha = campoSoloLectura("Fecha").apply { setText(Fechas.larga(fecha)) }
        etFecha.setOnClickListener {
            DatePickerDialog(host, { _, anio, mes, dia ->
                val nueva = LocalDate.of(anio, mes + 1, dia)
                if (nueva.isBefore(LocalDate.now())) {
                    Avisos.mostrar(host, "No podés seleccionar una fecha que ya pasó")
                } else {
                    fecha = nueva
                    etFecha.setText(Fechas.larga(nueva))
                }
            }, fecha.year, fecha.monthValue - 1, fecha.dayOfMonth).apply {
                datePicker.minDate = System.currentTimeMillis() - 1000
            }.show()
        }

        val etHora = campoSoloLectura("Hora").apply { setText(evento.hora) }
        etHora.setOnClickListener {
            val partes = etHora.text.toString().split(":")
            val hora = partes.getOrNull(0)?.toIntOrNull() ?: 9
            val minutos = partes.getOrNull(1)?.toIntOrNull() ?: 0
            TimePickerDialog(host, { _, h, m -> etHora.setText(String.format(Locale.getDefault(), "%02d:%02d", h, m)) },
                hora, minutos, true).show()
        }

        val nombres = listOf("Sin asignar") + DuenoRepo.todosLosVeterinarios().map { it.nombre }
        val selectorVeterinario = Spinner(host).apply {
            adapter = ArrayAdapter(host, android.R.layout.simple_spinner_dropdown_item, nombres)
            setSelection(nombres.indexOf(evento.veterinario).coerceAtLeast(0))
        }
        val etObservaciones = EditText(host).apply {
            hint = "Observaciones"
            setText(evento.observaciones)
            minLines = 2
        }
        listOf(etFecha, etHora, selectorVeterinario, etObservaciones).forEach { formulario.addView(it) }

        AlertDialog.Builder(host)
            .setTitle("Editar turno de ${evento.mascota}")
            .setView(formulario)
            .setPositiveButton("Guardar") { _, _ ->
                if (fecha.isBefore(LocalDate.now())) {
                    Avisos.mostrar(host, "No podés seleccionar una fecha que ya pasó")
                    return@setPositiveButton
                }
                val veterinario = if (selectorVeterinario.selectedItemPosition == 0) "" else selectorVeterinario.selectedItem as String
                DuenoRepo.modificarEvento(evento, fecha, etHora.text.toString(), veterinario, etObservaciones.text.toString().trim())
                Avisos.mostrar(host, "Turno actualizado")
                alCambiar()
            }
            .setNegativeButton(R.string.btn_cancelar, null)
            .show()
    }

    /** Botón "Editar evento" de las pestañas de la mascota: elige uno de sus eventos para editarlo. */
    fun elegirParaEditar(mascota: String?) {
        val propios = DuenoRepo.eventosDeMascota(mascota).sortedByDescending { it.fecha }
        if (propios.isEmpty()) {
            Avisos.mostrar(host, "No hay eventos para editar")
            return
        }
        val etiquetas = propios.map {
            "${it.fecha.dayOfMonth} ${Fechas.mesCorto(it.fecha.monthValue)} ${it.fecha.year} · ${it.categoria} · ${it.mascota}"
        }.toTypedArray()
        AlertDialog.Builder(host)
            .setTitle("Elegí el evento a editar")
            .setItems(etiquetas) { _, indice -> editar(propios[indice]) }
            .setNegativeButton(R.string.btn_cancelar, null)
            .show()
    }
}
