package frgp.utn.edu.petcare.ui.dueno

import android.content.res.ColorStateList
import android.graphics.Color
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import frgp.utn.edu.petcare.Fechas
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.RecordatorioItem
import frgp.utn.edu.petcare.RecordatoriosAdapter
import frgp.utn.edu.petcare.data.DuenoRepo
import frgp.utn.edu.petcare.ui.common.Efectos
import java.time.LocalDate

/**
 * Recordatorios (turnos próximos y completados). El mismo contenido se usa a pantalla completa y dentro de
 * la pestaña "Recordatorios" de una mascota, donde se limita a los eventos de esa mascota.
 */
class RecordatoriosPantalla(host: DuenoActivity) : Pantalla(host) {

    private var proximos = true
    private var mascota: String? = null

    fun mostrar() {
        host.mostrarContenido(R.layout.recordatorios_dueno, R.id.nav_lista)
        alTocar(R.id.btnBack) { host.irAHome() }
        alTocarConRebote(R.id.btnToolbarAdd) { host.irANuevoEvento(LocalDate.now()) }
        configurarContenido(global = true, mascota = null)
    }

    /** Conecta los botones y la lista del contenido ya inflado. [mascota] limita los eventos a una sola mascota. */
    fun configurarContenido(global: Boolean, mascota: String?) {
        this.mascota = mascota
        proximos = true
        refrescar()

        val btnProximos = vista<Button>(R.id.btn_proximos)
        val btnCompletados = vista<Button>(R.id.btn_completados)
        btnProximos?.setOnClickListener { proximos = true; refrescar() }
        btnCompletados?.setOnClickListener { proximos = false; refrescar() }

        vista<View>(R.id.fabAdd)?.let { fab ->
            if (global) fab.visibility = View.GONE
            else fab.setOnClickListener { Efectos.rebote(it); host.irANuevoEvento(host.diaSeleccionado) }
        }
        alTocarConRebote(R.id.btnEditarEvento) { host.dialogosEventos.elegirParaEditar(mascota) }
    }

    private fun items(proximos: Boolean): List<RecordatorioItem> {
        return DuenoRepo.eventosOrdenados(proximos, mascota).map { evento ->
            val fecha = "${evento.fecha.dayOfMonth} ${Fechas.mesCorto(evento.fecha.monthValue)} ${evento.fecha.year}"
            val estado = if (proximos) {
                when (val dias = Componentes.diasHasta(evento.fecha)) {
                    in Long.MIN_VALUE..0L -> "Hoy - ${evento.hora}"
                    1L -> "Mañana - ${evento.hora}"
                    else -> "Falta $dias días"
                }
            } else {
                "Completado"
            }
            RecordatorioItem(
                evento.categoria, evento.mascota, fecha, estado, EstiloCategoria.icono(evento.categoria),
                EstiloCategoria.fondo(evento.categoria), EstiloCategoria.colorIcono(evento.categoria)
            )
        }
    }

    private fun refrescar() {
        val lista = items(proximos)

        vista<RecyclerView>(R.id.recyclerViewRecordatorios)?.apply {
            adapter = RecordatoriosAdapter(lista)
            visibility = if (lista.isEmpty()) View.GONE else View.VISIBLE
        }

        vista<View>(R.id.emptyRecordatorios)?.let { vacio ->
            vacio.visibility = if (lista.isEmpty()) View.VISIBLE else View.GONE
            vacio.findViewById<ImageView>(R.id.ivEmptyIcon).setImageResource(R.drawable.ic_notifications)
            vacio.findViewById<TextView>(R.id.tvEmptyTitle).text =
                if (proximos) "No hay recordatorios próximos" else "Todavía no hay recordatorios completados"
            vacio.findViewById<TextView>(R.id.tvEmptyMessage).text =
                if (proximos) "Creá uno para no olvidarte de vacunas y controles" else "Acá vas a ver los turnos que ya pasaron"
            vacio.findViewById<TextView>(R.id.tvEmptyCta).apply {
                if (proximos) {
                    text = "+ Crear recordatorio"
                    visibility = View.VISIBLE
                    setOnClickListener { host.irANuevoEvento(LocalDate.now()) }
                } else {
                    visibility = View.GONE
                }
            }
        }

        val btnProximos = vista<Button>(R.id.btn_proximos)
        val btnCompletados = vista<Button>(R.id.btn_completados)
        if (btnProximos != null && btnCompletados != null) {
            pintarSegmento(btnProximos, proximos)
            pintarSegmento(btnCompletados, !proximos)
        }

        vista<TextView>(R.id.tvRecCount)?.let {
            val cantidad = if (proximos) lista.size else items(true).size
            it.text = if (cantidad == 1) "1 próximo" else "$cantidad próximos"
        }
    }

    private fun pintarSegmento(boton: Button, activo: Boolean) {
        boton.backgroundTintList =
            if (activo) ContextCompat.getColorStateList(host, R.color.primary_teal) else ColorStateList.valueOf(Color.TRANSPARENT)
        boton.setTextColor(ContextCompat.getColor(host, if (activo) R.color.white else R.color.text_gray))
    }
}
