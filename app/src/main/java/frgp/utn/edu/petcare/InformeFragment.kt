package frgp.utn.edu.petcare

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import androidx.appcompat.app.AppCompatActivity
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import frgp.utn.edu.petcare.ui.common.Avisos
import kotlinx.coroutines.launch

/** Pestaña "Informe" de la ficha del paciente: lo que el veterinario escribe durante o después del turno. */
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
        val turno = AgendaRepo.porId(turnoId)
        val motivoTurno = turno?.motivo.orEmpty()

        fun mostrar(informe: InformeData) {
            etMotivo?.setText(informe.motivo.ifBlank { motivoTurno })
            etDiagnostico?.setText(informe.diagnostico)
            etTratamiento?.setText(informe.tratamiento)
        }

        // Lo que ya había escrito el veterinario se pide al servidor; mientras tanto se ve el motivo del turno
        mostrar(InformesRepo.obtener(paciente.id, turnoId))
        viewLifecycleOwner.lifecycleScope.launch {
            runCatching { InformesRepo.cargar(paciente.id, turnoId) }.onSuccess { mostrar(it) }
        }

        btnGuardar?.setOnClickListener {
            val m = etMotivo?.text?.toString().orEmpty().trim()
            val d = etDiagnostico?.text?.toString().orEmpty().trim()
            val t = etTratamiento?.text?.toString().orEmpty().trim()
            if (d.isEmpty() && t.isEmpty()) {
                Avisos.aviso(requireContext(), "Completá al menos el diagnóstico o el tratamiento")
                return@setOnClickListener
            }

            InformesRepo.guardar(paciente.id, m, d, t, turnoId)
            if (turno == null || turno.estado != EstadoEvento.PENDIENTE) {
                Avisos.exito(requireContext(), "Informe guardado")
                return@setOnClickListener
            }
            // Durante un turno, guardar el informe es el momento natural para cerrarlo
            Avisos.confirmar(
                requireContext(), "Informe guardado",
                "¿Querés dar por terminado el turno de ${paciente.nombre}? Queda como completado en tu agenda " +
                    "y el dueño puede ver el informe.",
                textoAceptar = "Completar turno", textoCancelar = "Todavía no", peligro = false,
                icono = R.drawable.ic_check_circle
            ) {
                AgendaRepo.cambiarEstado(turno, EstadoEvento.COMPLETADO)
                requireActivity().finish()
            }
        }

        return view
    }
}
