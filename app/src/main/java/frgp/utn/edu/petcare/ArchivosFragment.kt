package frgp.utn.edu.petcare

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.RecyclerView

class ArchivosFragment : Fragment() {
    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_archivos, container, false)
        val rvArchivos = view.findViewById<RecyclerView>(R.id.rvArchivos)

        val items = listOf(
            ResumenItem("Receta Médica - Antibióticos", "Subido el 15 May 2026", R.drawable.ic_pencil),
            ResumenItem("Análisis de Sangre", "Subido el 10 Feb 2026", R.drawable.ic_list),
            ResumenItem("Certificado de Vacunación", "Subido el 20 Ene 2026", R.drawable.ic_calendar)
        )

        rvArchivos.adapter = ResumenAdapter(items)
        return view
    }
}