package frgp.utn.edu.petcare.ui.veterinario

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import frgp.utn.edu.petcare.data.repositorio.InformesRepo
import frgp.utn.edu.petcare.data.repositorio.Paciente
import frgp.utn.edu.petcare.data.repositorio.PacientesRepo
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.ui.common.Avisos
import frgp.utn.edu.petcare.ui.common.FichaClinica
import kotlinx.coroutines.launch

class InformacionVetFragment : Fragment() {

    private var contenedor: LinearLayout? = null
    private var tarjetaAlertas: View? = null
    private var tarjetaPeso: View? = null

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_informacion_vet, container, false)
        val p = DetallePacienteActivity.pacienteDe(requireActivity() as androidx.appcompat.app.AppCompatActivity)
        mostrarDatos(view, p)

        // Alertas y evolución del peso van arriba de los datos clínicos
        contenedor = (view as? ViewGroup)?.getChildAt(0) as? LinearLayout
        dibujarAlertas(p)
        viewLifecycleOwner.lifecycleScope.launch {
            val pesos = runCatching { InformesRepo.pesos(p.id) }.getOrNull() ?: return@launch
            tarjetaPeso?.let { contenedor?.removeView(it) }
            tarjetaPeso = FichaClinica.peso(requireContext(), pesos)?.also {
                contenedor?.addView(it, if (tarjetaAlertas != null) 1 else 0)
            }
        }
        return view
    }

    private fun mostrarDatos(view: View, p: Paciente) {
        view.findViewById<TextView>(R.id.tvPeso).text = p.peso
        view.findViewById<TextView>(R.id.tvMicrochip).text = p.microchip
        view.findViewById<TextView>(R.id.tvColor).text = p.color
        view.findViewById<TextView>(R.id.tvObservaciones).text = p.observaciones
        view.findViewById<TextView>(R.id.tvPropNombre).text = p.propietario
        view.findViewById<TextView>(R.id.tvPropDireccion).text = p.direccion
        view.findViewById<TextView>(R.id.tvPropTelefono).text = p.telefono
        view.findViewById<TextView>(R.id.tvPropEmail).text = p.email
    }

    /** Al volver a esta pestaña (por ejemplo después de guardar el informe) se muestran los datos al día. */
    override fun onResume() {
        super.onResume()
        val vista = view ?: return
        val id = DetallePacienteActivity.pacienteDe(requireActivity() as androidx.appcompat.app.AppCompatActivity).id
        PacientesRepo.porId(id)?.let { mostrarDatos(vista, it) }
    }

    private fun dibujarAlertas(p: Paciente) {
        val actual = PacientesRepo.porId(p.id) ?: p
        tarjetaAlertas?.let { contenedor?.removeView(it) }
        tarjetaAlertas = FichaClinica.alertas(requireContext(), actual.alertas) { editarAlertas(actual) }
            .also { contenedor?.addView(it, 0) }
    }

    private fun editarAlertas(p: Paciente) {
        val campo = EditText(requireContext()).apply {
            hint = "Ej: Alérgico a la penicilina. Nervioso con otros perros."
            setText(p.alertas)
            minLines = 3
            gravity = android.view.Gravity.TOP
            inputType = android.text.InputType.TYPE_CLASS_TEXT or android.text.InputType.TYPE_TEXT_FLAG_MULTI_LINE or
                android.text.InputType.TYPE_TEXT_FLAG_CAP_SENTENCES
        }
        val caja = LinearLayout(requireContext()).apply {
            setPadding(48, 24, 48, 0)
            addView(campo, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT))
        }
        AlertDialog.Builder(requireContext())
            .setTitle("Alertas de ${p.nombre}")
            .setView(caja)
            .setPositiveButton("Guardar") { _, _ ->
                PacientesRepo.guardarAlertas(p.id, campo.text.toString())
                dibujarAlertas(p)
                Avisos.exito(requireContext(), "Alertas guardadas")
            }
            .setNegativeButton("Cancelar", null)
            .show()
    }
}
