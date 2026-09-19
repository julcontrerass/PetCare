package frgp.utn.edu.petcare

import android.content.Intent
import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.RecyclerView
import com.google.android.material.tabs.TabLayout

class RecordatoriosActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.recordatorios)

        val tabLayout = findViewById<TabLayout>(R.id.tabLayout)
        val recyclerView = findViewById<RecyclerView>(R.id.recyclerViewRecordatorios)

        // Datos de ejemplo
        val items = listOf(
            RecordatorioItem("Vacuna múltiple", "Koda", "15 May 2026", "Falta 5 dias", R.drawable.ic_calendar),
            RecordatorioItem("Control general", "Mika", "20 May 2026", "Falta 10 dias", R.drawable.ic_pencil),
            RecordatorioItem("Desparasitación", "Koda", "01 Jun 2026", "Falta 22 dias", R.drawable.ic_dog)
        )
        recyclerView.adapter = RecordatoriosAdapter(items)
        
        // Seleccionar la pestaña de Recordatorios (índice 2)
        tabLayout.getTabAt(2)?.select()

        tabLayout.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab?) {
                when (tab?.position) {
                    0 -> {
                        startActivity(Intent(this@RecordatoriosActivity, DetalleDeMascotaActivity::class.java))
                        overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right)
                        finish()
                    }
                    1 -> {
                        startActivity(Intent(this@RecordatoriosActivity, HistorialClinicoActivity::class.java))
                        overridePendingTransition(R.anim.slide_in_left, R.anim.slide_out_right)
                        finish()
                    }
                }
            }
            override fun onTabUnselected(tab: TabLayout.Tab?) {}
            override fun onTabReselected(tab: TabLayout.Tab?) {}
        })
    }
}