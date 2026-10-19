package frgp.utn.edu.petcare.ui.veterinario

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.RecyclerView
import frgp.utn.edu.petcare.data.repositorio.AgendaRepo
import frgp.utn.edu.petcare.data.repositorio.EstadoEvento
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.ui.common.FiltroLineaTiempo
import frgp.utn.edu.petcare.util.Fechas

class HistorialPacienteFragment : Fragment() {
    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_historial_paciente, container, false)
        val paciente = DetallePacienteActivity.pacienteDe(requireActivity() as AppCompatActivity)

        val rvEventos = view.findViewById<RecyclerView>(R.id.rvEventosClinicos)

        val eventos = AgendaRepo.deMascota(paciente.id)
        val eventosAdapter = HistorialVetAdapter(emptyList())
        rvEventos?.adapter = eventosAdapter
        val vacio = view.findViewById<View>(R.id.emptyHistorial)

        // Buscador y filtros por tipo de evento y fechas
        lateinit var filtro: FiltroLineaTiempo
        fun dibujar() {
            val uiItems = eventos.filter {
                filtro.admite(listOf(it.tipo, it.motivo, it.veterinario, it.notas).joinToString(" "), it.tipo, it.fecha)
            }.map { e ->
                val estado = if (e.estado == EstadoEvento.COMPLETADO) "" else " · ${e.estado.etiqueta}"
                HistorialVetUIItem.Event(
                    "%02d".format(e.fecha.dayOfMonth), Fechas.mesCorto(e.fecha), e.motivo,
                    e.veterinario + estado, e.notas, DetalleEventoVetActivity.iconoDe(e.tipo),
                    HistorialCategory.TODOS, e.id
                )
            }
            eventosAdapter.updateItems(uiItems)
            vacio.visibility = if (uiItems.isEmpty()) View.VISIBLE else View.GONE
            rvEventos?.visibility = if (uiItems.isEmpty()) View.GONE else View.VISIBLE
            vacio.findViewById<android.widget.ImageView>(R.id.ivEmptyIcon).setImageResource(R.drawable.ic_document)
            val porFiltro = eventos.isNotEmpty() && filtro.activo
            vacio.findViewById<android.widget.TextView>(R.id.tvEmptyTitle).text =
                if (porFiltro) "Sin resultados" else "Sin eventos clínicos"
            vacio.findViewById<android.widget.TextView>(R.id.tvEmptyMessage).text =
                if (porFiltro) "Ningún evento coincide con la búsqueda o los filtros"
                else "Los turnos y consultas de este paciente aparecen acá"
        }
        filtro = FiltroLineaTiempo(requireContext(), eventos.map { it.tipo }.distinct().sorted()) { dibujar() }
        view.findViewById<android.widget.LinearLayout>(R.id.filtrosHistorialVet).addView(filtro.vista)
        dibujar()

        return view
    }
}
