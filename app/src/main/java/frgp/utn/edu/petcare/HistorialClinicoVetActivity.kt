package frgp.utn.edu.petcare

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.Toolbar
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.tabs.TabLayout

class HistorialClinicoVetActivity : AppCompatActivity() {

    private lateinit var rvHistorial: RecyclerView
    private lateinit var adapter: HistorialVetAdapter
    private lateinit var fullItemList: List<HistorialVetUIItem>

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.historial_clinico_vista_veterinario)

        val toolbar = findViewById<Toolbar>(R.id.toolbar)
        setSupportActionBar(toolbar)
        supportActionBar?.setDisplayHomeAsUpEnabled(true)
        supportActionBar?.setDisplayShowTitleEnabled(false)
        toolbar.setNavigationOnClickListener { onBackPressed() }

        rvHistorial = findViewById(R.id.rvHistorial)
        val tabLayout = findViewById<TabLayout>(R.id.tabLayoutFilters)

        // Definir la lista completa original
        fullItemList = listOf(
            HistorialVetUIItem.Header("Mayo 2026"),
            HistorialVetUIItem.Event("12", "MAY", "Consulta veterinaria", "Dr. María González", "Revisión anual. Todo normal. Plan: Control en 1 año.", R.drawable.ic_clock, HistorialCategory.CONSULTA),
            HistorialVetUIItem.Event("18", "MAY", "Próximo recordatorio", "Vacuna antirrábica", "", R.drawable.ic_pencil, HistorialCategory.VACUNA),
            HistorialVetUIItem.Header("Abril 2026"),
            HistorialVetUIItem.Event("05", "ABR", "Desparasitación", "Dr. María González", "Aplicación de desparasitante interno. Siguiente dosis: 3 meses.", R.drawable.ic_activity, HistorialCategory.TRATAMIENTO),
            HistorialVetUIItem.Event("25", "ABR", "Análisis de sangre", "Dr. María González", "Resultados normales.", R.drawable.ic_list, HistorialCategory.CONSULTA)
        )

        adapter = HistorialVetAdapter(fullItemList)
        rvHistorial.adapter = adapter

        tabLayout.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                filterItems(tab?.position ?: 0)
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })
    }

    private fun filterItems(position: Int) {
        val selectedCategory = when (position) {
            0 -> HistorialCategory.TODOS
            1 -> HistorialCategory.CONSULTA
            2 -> HistorialCategory.VACUNA
            3 -> HistorialCategory.TRATAMIENTO
            else -> HistorialCategory.OTROS
        }

        if (selectedCategory == HistorialCategory.TODOS) {
            adapter.updateItems(fullItemList)
        } else {
            // Filtrar eventos y mantener los headers solo si tienen eventos que mostrar
            val filteredList = mutableListOf<HistorialVetUIItem>()
            var currentHeader: HistorialVetUIItem.Header? = null
            
            for (item in fullItemList) {
                if (item is HistorialVetUIItem.Header) {
                    currentHeader = item
                } else if (item is HistorialVetUIItem.Event && item.category == selectedCategory) {
                    // Si encontramos un evento que coincide, añadimos su cabecera si no se ha añadido aún
                    currentHeader?.let { 
                        filteredList.add(it)
                        currentHeader = null // Limpiar para no repetir el mismo header
                    }
                    filteredList.add(item)
                }
            }
            adapter.updateItems(filteredList)
        }
    }
}