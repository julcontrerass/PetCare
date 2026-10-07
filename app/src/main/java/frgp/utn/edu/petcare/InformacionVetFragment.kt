package frgp.utn.edu.petcare

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment

class InformacionVetFragment : Fragment() {
    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_informacion_vet, container, false)
        val p = DetallePacienteActivity.pacienteDe(requireActivity() as androidx.appcompat.app.AppCompatActivity)
        view.findViewById<android.widget.TextView>(R.id.tvPeso).text = p.peso
        view.findViewById<android.widget.TextView>(R.id.tvMicrochip).text = p.microchip
        view.findViewById<android.widget.TextView>(R.id.tvColor).text = p.color
        view.findViewById<android.widget.TextView>(R.id.tvObservaciones).text = p.observaciones
        view.findViewById<android.widget.TextView>(R.id.tvPropNombre).text = p.propietario
        view.findViewById<android.widget.TextView>(R.id.tvPropDireccion).text = p.direccion
        view.findViewById<android.widget.TextView>(R.id.tvPropTelefono).text = p.telefono
        view.findViewById<android.widget.TextView>(R.id.tvPropEmail).text = p.email
        return view
    }
}