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

        return view
    }
}
