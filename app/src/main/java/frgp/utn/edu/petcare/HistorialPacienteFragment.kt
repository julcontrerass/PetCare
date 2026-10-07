package frgp.utn.edu.petcare

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.RecyclerView

class HistorialPacienteFragment : Fragment() {
    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_historial_paciente, container, false)
        val paciente = DetallePacienteActivity.pacienteDe(requireActivity() as AppCompatActivity)

        val rvEventos = view.findViewById<RecyclerView>(R.id.rvEventosClinicos)

        val eventos = AgendaRepo.deMascota(paciente.id)
        val uiItems = mutableListOf<HistorialVetUIItem>()
        for (e in eventos) {
            val estado = if (e.estado == EstadoEvento.COMPLETADO) "" else " · ${e.estado.etiqueta}"
            uiItems.add(
                HistorialVetUIItem.Event(
                    "%02d".format(e.fecha.dayOfMonth), Fechas.mesCorto(e.fecha), e.motivo,
                    e.veterinario + estado, e.notas, DetalleEventoVetActivity.iconoDe(e.tipo),
                    HistorialCategory.TODOS, e.id
                )
            )
        }
        val eventosAdapter = HistorialVetAdapter(uiItems)
        rvEventos?.adapter = eventosAdapter

        val vacio = view.findViewById<View>(R.id.emptyHistorial)
        vacio.visibility = if (uiItems.isEmpty()) View.VISIBLE else View.GONE
        rvEventos?.visibility = if (uiItems.isEmpty()) View.GONE else View.VISIBLE
        vacio.findViewById<android.widget.ImageView>(R.id.ivEmptyIcon).setImageResource(R.drawable.ic_document)
        vacio.findViewById<android.widget.TextView>(R.id.tvEmptyTitle).text = "Sin eventos clínicos"
        vacio.findViewById<android.widget.TextView>(R.id.tvEmptyMessage).text = "Los turnos y consultas de este paciente aparecen acá"

        return view
    }
}
