package frgp.utn.edu.petcare

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.recyclerview.widget.RecyclerView

class RecordatoriosFragment : Fragment() {
    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View? {
        val view = inflater.inflate(R.layout.fragment_recordatorios, container, false)
        
        val recyclerView = view.findViewById<RecyclerView>(R.id.recyclerViewRecordatorios)
        val items = listOf(
            RecordatorioItem("Vacuna múltiple", "Koda", "15 May 2026", "Falta 5 dias", R.drawable.ic_calendar),
            RecordatorioItem("Control general", "Mika", "20 May 2026", "Falta 10 dias", R.drawable.ic_pencil),
            RecordatorioItem("Desparasitación", "Koda", "01 Jun 2026", "Falta 22 dias", R.drawable.ic_dog)
        )
        recyclerView.adapter = RecordatoriosAdapter(items)
        
        return view
    }
}