package frgp.utn.edu.petcare

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

        val items = listOf(
            ResumenItem("Última consulta", "18 May 2026", R.drawable.ic_clock),
            ResumenItem("Próximo recordatorio", "Vacuna antirrábica • 18 May 2027", R.drawable.ic_calendar),
            ResumenItem("Veterinarios autorizados", "1 veterinario", R.drawable.ic_pencil), // No user icon found in list, using pencil as fallback
            ResumenItem("Historial clínico", "Ver todos los eventos", R.drawable.ic_activity)
        )

        rvResumen.adapter = ResumenAdapter(items)
        return view
    }
}