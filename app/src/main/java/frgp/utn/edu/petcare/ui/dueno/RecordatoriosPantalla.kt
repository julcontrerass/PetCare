package frgp.utn.edu.petcare.ui.dueno

import android.content.res.ColorStateList
import android.graphics.Color
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import androidx.appcompat.app.AlertDialog
import frgp.utn.edu.petcare.data.repositorio.DuenoRepo
import frgp.utn.edu.petcare.data.repositorio.RecordatorioManual
import frgp.utn.edu.petcare.data.repositorio.RecordatoriosRepo
import frgp.utn.edu.petcare.ui.common.Avisos
import frgp.utn.edu.petcare.ui.common.EditorRecordatorio
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.ui.common.Efectos
import frgp.utn.edu.petcare.util.Fechas
import java.time.LocalDate

/**
 * Recordatorios (turnos próximos y completados). El mismo contenido se usa a pantalla completa y dentro de
 * la pestaña "Recordatorios" de una mascota, donde se limita a los eventos de esa mascota.
 */
class RecordatoriosPantalla(host: DuenoActivity) : Pantalla(host) {

    /** Qué se está viendo: los turnos que vienen, los que ya pasaron o los recordatorios hechos a mano. */
    private enum class Pestana { PROXIMOS, COMPLETADOS, MIOS }

    private var pestana = Pestana.PROXIMOS
    private val proximos: Boolean get() = pestana == Pestana.PROXIMOS
    private var mascota: String? = null

    /** Crea un recordatorio propio, o un turno si se está viendo otra solapa. */
    private fun agregar(diaPorDefecto: LocalDate) {
        if (pestana == Pestana.MIOS) crearManual() else host.irANuevoEvento(diaPorDefecto)
    }

    private fun crearManual() {
        val elegibles = DuenoRepo.mascotasActivas.filter { mascota == null || it.nombre == mascota }
            .map { it.id to it.nombre }
        EditorRecordatorio.mostrar(host, elegibles) { refrescar() }
    }

    fun mostrar() {
        host.mostrarContenido(R.layout.pantalla_recordatorios, R.id.nav_lista)
        alTocar(R.id.btnBack) { host.irAHome() }
        alTocarConRebote(R.id.btnToolbarAdd) { agregar(LocalDate.now()) }
        configurarContenido(global = true, mascota = null)
    }

    /** Conecta los botones y la lista del contenido ya inflado. [mascota] limita los eventos a una sola mascota. */
    fun configurarContenido(global: Boolean, mascota: String?) {
        this.mascota = mascota
        pestana = Pestana.PROXIMOS
        refrescar()

        vista<Button>(R.id.btn_proximos)?.setOnClickListener { pestana = Pestana.PROXIMOS; refrescar() }
        vista<Button>(R.id.btn_completados)?.setOnClickListener { pestana = Pestana.COMPLETADOS; refrescar() }
        vista<Button>(R.id.btn_manuales)?.setOnClickListener { pestana = Pestana.MIOS; refrescar() }

        vista<View>(R.id.fabAdd)?.let { fab ->
            if (global) fab.visibility = View.GONE
            else fab.setOnClickListener { Efectos.rebote(it); agregar(host.diaSeleccionado) }
        }
        alTocarConRebote(R.id.btnEditarEvento) { host.dialogosEventos.elegirParaEditar(mascota) }
    }

    /** Los recordatorios hechos a mano (propios y los que dejó el veterinario): lo que viene primero y después lo pasado. */
    private fun itemsManuales(): List<RecordatorioItem> {
        val hoy = LocalDate.now()
        val id = mascota?.let { DuenoRepo.buscarMascota(it)?.id }
        val todos = RecordatoriosRepo.lista.filter { r ->
            DuenoRepo.mascotas.any { it.id == r.mascotaId } && (id == null || r.mascotaId == id)
        }
        val (proximos, pasados) = todos.partition { !it.fecha.isBefore(hoy) }
        return (proximos + pasados.reversed()).map { r ->
            val nombre = DuenoRepo.mascotas.firstOrNull { it.id == r.mascotaId }?.nombre.orEmpty()
            val autor = if (r.esMio) "" else " · De ${DuenoRepo.perfilDeVeterinario(r.creadoPor)?.nombre ?: "tu veterinario"}"
            val estado = when (val dias = Componentes.diasHasta(r.fecha)) {
                in Long.MIN_VALUE..-1L -> "Pasó"
                0L -> "Hoy" + (r.hora?.let { " - $it" } ?: "")
                1L -> "Mañana" + (r.hora?.let { " - $it" } ?: "")
                else -> "Falta $dias días"
            }
            RecordatorioItem(
                r.titulo, nombre + autor + r.nota.takeIf { it.isNotBlank() }?.let { " · $it" }.orEmpty(),
                Fechas.corta(r.fecha) + (r.hora?.let { " · $it hs" } ?: ""), estado,
                EstiloCategoria.icono(r.tipo), EstiloCategoria.fondo(r.tipo), EstiloCategoria.colorIcono(r.tipo),
                alTocar = if (r.esMio) ({ opciones(r) }) else null
            )
        }
    }

    private fun opciones(r: RecordatorioManual) {
        AlertDialog.Builder(host)
            .setTitle(r.titulo)
            .setItems(arrayOf("Editar", "Eliminar")) { _, i ->
                if (i == 0) {
                    val mascotas = DuenoRepo.mascotas.map { it.id to it.nombre }
                    EditorRecordatorio.mostrar(host, mascotas, r) { refrescar() }
                } else {
                    Avisos.confirmar(
                        host, "¿Eliminar el recordatorio?", "\"${r.titulo}\" se borra y ya no te va a avisar.",
                        textoAceptar = "Eliminar"
                    ) {
                        RecordatoriosRepo.borrar(r)
                        refrescar()
                    }
                }
            }
            .setNegativeButton(R.string.btn_cancelar, null)
            .show()
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
                EstiloCategoria.fondo(evento.categoria), EstiloCategoria.colorIcono(evento.categoria),
                evento.veterinarioId
            )
        }
    }

    private fun refrescar() {
        val lista = if (pestana == Pestana.MIOS) itemsManuales() else items(proximos)

        vista<RecyclerView>(R.id.recyclerViewRecordatorios)?.apply {
            adapter = RecordatoriosAdapter(lista)
            visibility = if (lista.isEmpty()) View.GONE else View.VISIBLE
        }

        vista<View>(R.id.emptyRecordatorios)?.let { vacio ->
            vacio.visibility = if (lista.isEmpty()) View.VISIBLE else View.GONE
            vacio.findViewById<ImageView>(R.id.ivEmptyIcon).setImageResource(R.drawable.ic_notifications)
            vacio.findViewById<TextView>(R.id.tvEmptyTitle).text = when (pestana) {
                Pestana.PROXIMOS -> "No hay recordatorios próximos"
                Pestana.COMPLETADOS -> "Todavía no hay recordatorios completados"
                Pestana.MIOS -> "No tenés recordatorios propios"
            }
            vacio.findViewById<TextView>(R.id.tvEmptyMessage).text = when (pestana) {
                Pestana.PROXIMOS -> "Creá uno para no olvidarte de vacunas y controles"
                Pestana.COMPLETADOS -> "Acá vas a ver los turnos que ya pasaron"
                Pestana.MIOS -> "Creá uno para acordarte de una vacuna, un baño o lo que necesites"
            }
            vacio.findViewById<TextView>(R.id.tvEmptyCta).apply {
                if (pestana != Pestana.COMPLETADOS) {
                    text = "+ Crear recordatorio"
                    visibility = View.VISIBLE
                    setOnClickListener { agregar(LocalDate.now()) }
                } else {
                    visibility = View.GONE
                }
            }
        }

        vista<Button>(R.id.btn_proximos)?.let { pintarSegmento(it, pestana == Pestana.PROXIMOS) }
        vista<Button>(R.id.btn_completados)?.let { pintarSegmento(it, pestana == Pestana.COMPLETADOS) }
        vista<Button>(R.id.btn_manuales)?.let { pintarSegmento(it, pestana == Pestana.MIOS) }

        vista<TextView>(R.id.tvRecCount)?.let {
            val cantidad = if (pestana == Pestana.PROXIMOS) lista.size else items(true).size
            it.text = if (cantidad == 1) "1 próximo" else "$cantidad próximos"
        }
    }

    private fun pintarSegmento(boton: Button, activo: Boolean) {
        boton.backgroundTintList =
            if (activo) ContextCompat.getColorStateList(host, R.color.primary_teal) else ColorStateList.valueOf(Color.TRANSPARENT)
        boton.setTextColor(ContextCompat.getColor(host, if (activo) R.color.white else R.color.text_gray))
    }
}
