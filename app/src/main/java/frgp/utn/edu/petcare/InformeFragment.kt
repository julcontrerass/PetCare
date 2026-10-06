package frgp.utn.edu.petcare

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import com.google.android.material.button.MaterialButton

class InformeFragment : Fragment() {
    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_informe_paciente, container, false)
        val paciente = DetallePacienteActivity.pacienteDe(requireActivity() as AppCompatActivity)
        val informe = InformesRepo.obtener(paciente.id)

        val etMotivo = view.findViewById<EditText>(R.id.etMotivoConsulta)
        val etDiagnostico = view.findViewById<EditText>(R.id.etDiagnostico)
        val etTratamiento = view.findViewById<EditText>(R.id.etTratamiento)
        val btnGuardar = view.findViewById<MaterialButton>(R.id.btnGuardarInforme)

        etMotivo?.setText(informe.motivo)
        etDiagnostico?.setText(informe.diagnostico)
        etTratamiento?.setText(informe.tratamiento)

        btnGuardar?.setOnClickListener {
            val m = etMotivo?.text?.toString().orEmpty()
            val d = etDiagnostico?.text?.toString().orEmpty()
            val t = etTratamiento?.text?.toString().orEmpty()

            InformesRepo.guardar(paciente.id, m, d, t)
            Toast.makeText(requireContext(), "Informe guardado correctamente", Toast.LENGTH_SHORT).show()
        }

        return view
    }
}
