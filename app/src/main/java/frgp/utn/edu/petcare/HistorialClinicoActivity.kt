package frgp.utn.edu.petcare

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.tabs.TabLayout

class HistorialClinicoActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.historial_clinico)

        val tabLayout = findViewById<TabLayout>(R.id.tabLayout)
        val recyclerView = findViewById<RecyclerView>(R.id.recyclerViewHistorial)

        // Datos de ejemplo
        val items = listOf(
            HistorialItem("Consulta veterinaria", "10 May 2026 · Dr. Juan Pérez", R.drawable.ic_list, R.color.icon_blue_bg),
            HistorialItem("Vacuna múltiple", "15 Abr 2026 · Dr. Juan Pérez", R.drawable.ic_pencil, R.color.icon_green_bg),
            HistorialItem("Desparasitación", "01 Mar 2026 · Dr. Juan Pérez", R.drawable.ic_dog, R.color.icon_orange_bg),
            HistorialItem("Análisis de sangre", "10 Feb 2026 · Dr. Juan Pérez", R.drawable.ic_list, R.color.icon_purple_bg),
            HistorialItem("Cirugía", "15 Jul 2025 · Dr. Juan Pérez", R.drawable.ic_dog, R.color.icon_pink_bg),
            HistorialItem("Control general", "10 Ene 2025 · Dr. Juan Pérez", R.drawable.ic_calendar, R.color.icon_teal_bg)
        )
        recyclerView.adapter = HistorialAdapter(items)
        
        // Seleccionar la pestaña de Historial (índice 1)
        tabLayout.getTabAt(1)?.select()

        tabLayout.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                when (tab?.position) {
                    0 -> {
                        startActivity(Intent(this@HistorialClinicoActivity, DetalleDeMascotaActivity::class.java))
                        overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right)
                        finish()
                    }
                    2 -> {
                        startActivity(Intent(this@HistorialClinicoActivity, RecordatoriosActivity::class.java))
                        overridePendingTransition(R.anim.slide_in_right, R.anim.slide_out_left)
                        finish()
                    }
                }
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })
    }
}