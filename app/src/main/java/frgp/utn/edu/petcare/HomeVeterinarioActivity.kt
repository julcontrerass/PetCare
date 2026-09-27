package frgp.utn.edu.petcare

import android.os.Bundle
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.RecyclerView

class HomeVeterinarioActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.home_veterinario)

        val rvConsultas = findViewById<RecyclerView>(R.id.rvConsultas)
        VetBottomNav.setup(this, R.id.nav_inicio)

        findViewById<View>(R.id.ivNotifications)?.setOnClickListener {
            VetBottomNav.mostrarEnDesarrollo(this)
        }
        findViewById<View>(R.id.tvVerAgenda)?.setOnClickListener {
            VetBottomNav.mostrarEnDesarrollo(this)
        }
        findViewById<View>(R.id.fabCenter)?.setOnClickListener {
            VetBottomNav.mostrarEnDesarrollo(this)
        }

        val items = listOf(
            HomeVetItem("Max", "Vacuna anual", "10:00", ItemType.CONSULTA),
            HomeVetItem("Luna", "Cirugía (revisión)", "11:30", ItemType.CONSULTA),
            HomeVetItem("Koda", "Consulta por picazón", "15:00", ItemType.CONSULTA),
            HomeVetItem("Toby", "Control general", "16:30", ItemType.CONSULTA),
            HomeVetItem("Nueva solicitud de acceso", "Marcos Pérez - Max", "", ItemType.SOLICITUD, R.drawable.juani, "Hace 1 hora"),
            HomeVetItem("Recordatorio de control enviado", "Ana García - Rocky", "", ItemType.SOLICITUD, R.drawable.luna, "Hace 3 horas")
        )

        rvConsultas.adapter = HomeVetAdapter(items)
    }
}