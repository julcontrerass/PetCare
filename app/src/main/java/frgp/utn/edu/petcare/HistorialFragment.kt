package frgp.utn.edu.petcare

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.RecyclerView

class HistorialFragment : Fragment() {
    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_historial, container, false)
        
        val recyclerView = view.findViewById<RecyclerView>(R.id.recyclerViewHistorial)
        val items = listOf(
            HistorialItem("Consulta veterinaria", "10 May 2026 · Dr. Juan Pérez", R.drawable.ic_list, R.color.icon_blue_bg),
            HistorialItem("Vacuna múltiple", "15 Abr 2026 · Dr. Juan Pérez", R.drawable.ic_pencil, R.color.icon_green_bg),
            HistorialItem("Desparasitación", "01 Mar 2026 · Dr. Juan Pérez", R.drawable.ic_dog, R.color.icon_orange_bg),
            HistorialItem("Análisis de sangre", "10 Feb 2026 · Dr. Juan Pérez", R.drawable.ic_list, R.color.icon_purple_bg),
            HistorialItem("Cirugía", "15 Jul 2025 · Dr. Juan Pérez", R.drawable.ic_dog, R.color.icon_pink_bg),
            HistorialItem("Control general", "10 Ene 2025 · Dr. Juan Pérez", R.drawable.ic_calendar, R.color.icon_teal_bg)
        )
        recyclerView.adapter = HistorialAdapter(items)
        
        return view
    }
}