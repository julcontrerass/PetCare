package frgp.utn.edu.petcare.ui.dueno

import android.app.DatePickerDialog
import android.content.res.ColorStateList
import frgp.utn.edu.petcare.ui.common.ArchivosUi
import frgp.utn.edu.petcare.model.EstadoTurno
import kotlinx.coroutines.launch
import androidx.lifecycle.lifecycleScope
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

        val proximo = DuenoRepo.esEditable(evento)
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

        // Lo que el veterinario dejó en la consulta (informe, vacunas y archivos) se pide al abrir la hoja
        host.lifecycleScope.launch {
            val detalle = runCatching { DuenoRepo.detalleDelTurno(evento) }.getOrNull() ?: return@launch
            mostrarDetalleClinico(vista.findViewById(R.id.llTurnoDetalle), detalle)
        }

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

    private fun fila(
        contenedor: LinearLayout, icono: Int, titulo: String, valor: String, accion: (() -> Unit)? = null
    ) {
        val fila = host.layoutInflater.inflate(R.layout.item_turno_detalle, contenedor, false)
        fila.findViewById<ImageView>(R.id.ivDetalleIcono).setImageResource(icono)
        fila.findViewById<TextView>(R.id.tvDetalleTitulo).text = titulo
        fila.findViewById<TextView>(R.id.tvDetalleValor).text = valor
        if (accion != null) {
            fila.findViewById<View>(R.id.tvDetalleAccion).visibility = View.VISIBLE
            fila.setOnClickListener { accion() }
        } else {
            fila.isClickable = false
        }
        contenedor.addView(fila)
    }

    /** Agrega a la hoja del turno lo que cargó el veterinario: informe, registros de salud y archivos. */
    private fun mostrarDetalleClinico(contenedor: LinearLayout, d: DuenoRepo.DetalleTurno) {
        contenedor.removeAllViews()
        if (d.motivo.isNotBlank()) fila(contenedor, R.drawable.ic_list, "Motivo de la consulta", d.motivo)
        if (d.diagnostico.isNotBlank()) fila(contenedor, R.drawable.ic_medical, "Diagnóstico", d.diagnostico)
        if (d.tratamiento.isNotBlank()) fila(contenedor, R.drawable.ic_syringe, "Tratamiento indicado", d.tratamiento)
        if (d.registros.isNotEmpty()) {
            fila(contenedor, R.drawable.ic_pulse, "Cargado en el carnet de salud", d.registros.joinToString("\n"))
        }
        d.estudios.forEach { estudio ->
            fila(contenedor, R.drawable.ic_document, "${estudio.tipo.ifBlank { "Estudio" }} que adjuntaste", estudio.nombre) {
                host.lifecycleScope.launch {
                    ArchivosUi.abrir(host, "archivos", estudio.ruta, estudio.extension)
                }
            }
        }
        d.archivos.forEach { archivo ->
            fila(contenedor, R.drawable.ic_document, "Archivo adjunto", archivo.nombre) {
                host.lifecycleScope.launch {
                    ArchivosUi.abrir(host, "archivos", archivo.ruta, archivo.extension)
                }
            }
        }
    }

    /** Edita el turno con el asistente de horarios (días y horas del veterinario, sin los ya reservados). */
    fun editar(evento: EventoMascota, @Suppress("UNUSED_PARAMETER") alCambiar: () -> Unit = {}) {
        host.irAEditarEvento(evento)
    }

    /** Botón "Editar evento": muestra los turnos próximos en tarjetas y deja elegir cuál editar. */
    fun elegirParaEditar(mascota: String?) {
        val editables = DuenoRepo.eventosEditables(mascota)
        if (editables.isEmpty()) {
            Avisos.aviso(host, "No tenés turnos próximos para editar. Los turnos completados no se pueden modificar.")
            return
        }
        val hoja = BottomSheetDialog(host)
        val vista = host.layoutInflater.inflate(R.layout.sheet_elegir_turno, null)
        hoja.setContentView(vista)
        vista.findViewById<TextView>(R.id.tvElegirSubtitulo).text =
            if (editables.size == 1) "Tenés 1 turno próximo. Solo se pueden editar los turnos próximos."
            else "Tenés ${editables.size} turnos próximos. Solo se pueden editar los próximos."
        val lista = vista.findViewById<LinearLayout>(R.id.llTurnosEditables)
        editables.forEach { evento ->
            val tarjeta = host.layoutInflater.inflate(R.layout.item_turno_editable, lista, false)
            tarjeta.findViewById<View>(R.id.flTurnoIconoEditable).backgroundTintList =
                ColorStateList.valueOf(ContextCompat.getColor(host, EstiloCategoria.fondo(evento.categoria)))
            tarjeta.findViewById<ImageView>(R.id.ivTurnoIconoEditable).apply {
                setImageResource(EstiloCategoria.icono(evento.categoria))
                setColorFilter(ContextCompat.getColor(host, EstiloCategoria.colorIcono(evento.categoria)))
            }
            tarjeta.findViewById<TextView>(R.id.tvTurnoEditableTitulo).text = evento.categoria
            val conVet = evento.veterinario.takeIf { it.isNotBlank() } ?: "Sin veterinario asignado"
            tarjeta.findViewById<TextView>(R.id.tvTurnoEditableDetalle).text = "${evento.mascota} · $conVet"
            tarjeta.findViewById<TextView>(R.id.tvTurnoEditableDia).text =
                "${evento.fecha.dayOfMonth} ${Fechas.mesCorto(evento.fecha.monthValue).uppercase()}"
            tarjeta.findViewById<TextView>(R.id.tvTurnoEditableHora).text = "${evento.hora} hs"
            tarjeta.setOnClickListener {
                hoja.dismiss()
                editar(evento)
            }
            lista.addView(tarjeta)
        }
        vista.findViewById<View>(R.id.btnCerrarElegirTurno).setOnClickListener { hoja.dismiss() }
        hoja.show()
    }
}
