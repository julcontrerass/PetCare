package frgp.utn.edu.petcare

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment

class PropietarioFragment : Fragment() {
    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_propietario, container, false)
        val p = DetallePacienteActivity.pacienteDe(requireActivity() as androidx.appcompat.app.AppCompatActivity)
        view.findViewById<android.widget.TextView>(R.id.tvPropNombre).text = p.propietario
        view.findViewById<android.widget.TextView>(R.id.tvPropDireccion).text = p.direccion
        view.findViewById<android.widget.TextView>(R.id.tvPropTelefono).text = p.telefono
        view.findViewById<android.widget.TextView>(R.id.tvPropEmail).text = p.email
        return view
    }
}