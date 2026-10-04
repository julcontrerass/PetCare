package frgp.utn.edu.petcare

import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.RecyclerView

class ResumenFragment : Fragment() {
    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_resumen_paciente, container, false)
        val rvResumen = view.findViewById<RecyclerView>(R.id.rvResumen)

        val paciente = DetallePacienteActivity.pacienteDe(requireActivity() as androidx.appcompat.app.AppCompatActivity)
        val ultima = AgendaRepo.ultimaConsulta(paciente.id)
        val proximo = AgendaRepo.proximoEvento(paciente.id)
        val items = listOf(
            ResumenItem("Última consulta", ultima?.let { "${Fechas.corta(it.fecha)} · ${it.motivo}" } ?: "Sin consultas", R.drawable.ic_clock),
            ResumenItem("Próximo recordatorio", proximo?.let { "${it.motivo} • ${Fechas.corta(it.fecha)}" } ?: "Sin recordatorios", R.drawable.ic_calendar),
            ResumenItem("Veterinarios autorizados", "1 veterinario", R.drawable.ic_pencil),
            ResumenItem("Historial clínico", "Ver todos los eventos", R.drawable.ic_activity)
        )

        val adapter = ResumenAdapter(items)
        adapter.setOnItemClickListener { position ->
            if (position == 3) { // Historial clínico
                val intent = Intent(requireContext(), HistorialClinicoVetActivity::class.java)
                intent.putExtra(DetallePacienteActivity.EXTRA_PACIENTE_ID, paciente.id)
                startActivity(intent)
            }
        }
        rvResumen.adapter = adapter
        return view
    }
}