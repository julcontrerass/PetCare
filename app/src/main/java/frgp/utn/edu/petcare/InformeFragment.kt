package frgp.utn.edu.petcare

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import kotlinx.coroutines.launch

class InformeFragment : Fragment() {
    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_informe_paciente, container, false)
        val paciente = DetallePacienteActivity.pacienteDe(requireActivity() as AppCompatActivity)

        val etMotivo = view.findViewById<EditText>(R.id.etMotivoConsulta)
        val etDiagnostico = view.findViewById<EditText>(R.id.etDiagnostico)
        val etTratamiento = view.findViewById<EditText>(R.id.etTratamiento)
        val btnGuardar = view.findViewById<MaterialButton>(R.id.btnGuardarInforme)

        val turnoId = requireActivity().intent.getStringExtra(DetalleEventoVetActivity.EXTRA_EVENTO_ID)
        val motivoTurno = AgendaRepo.porId(turnoId)?.motivo.orEmpty()

        fun mostrar(informe: InformeData) {
            etMotivo?.setText(informe.motivo.ifBlank { motivoTurno })
            etDiagnostico?.setText(informe.diagnostico)
            etTratamiento?.setText(informe.tratamiento)
        }

        // Lo que ya había escrito el veterinario se pide al servidor; mientras tanto se ve el motivo del turno
        mostrar(InformesRepo.obtener(paciente.id))
        viewLifecycleOwner.lifecycleScope.launch {
            runCatching { InformesRepo.cargar(paciente.id) }.onSuccess { mostrar(it) }
        }

        btnGuardar?.setOnClickListener {
            val m = etMotivo?.text?.toString().orEmpty()
            val d = etDiagnostico?.text?.toString().orEmpty()
            val t = etTratamiento?.text?.toString().orEmpty()

            InformesRepo.guardar(paciente.id, m, d, t, turnoId)
            Toast.makeText(requireContext(), "Informe guardado correctamente", Toast.LENGTH_SHORT).show()
        }

        return view
    }
}
