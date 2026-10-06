package frgp.utn.edu.petcare

import android.content.Intent
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.bottomnavigation.BottomNavigationView

object VetBottomNav {

    fun setup(activity: AppCompatActivity, selectedItemId: Int) {
        val bottomNav = activity.findViewById<BottomNavigationView>(R.id.bottomNavigation) ?: return
        bottomNav.selectedItemId = selectedItemId

        activity.findViewById<View>(R.id.fabCenter)?.setOnClickListener {
            activity.startActivity(Intent(activity, AgregarConsultaActivity::class.java))
        }

        bottomNav.setOnItemSelectedListener { item ->
            when (item.itemId) {
                selectedItemId -> true
                R.id.nav_inicio -> {
                    irA(activity, HomeVeterinarioActivity::class.java)
                    true
                }
                R.id.nav_pacientes -> {
                    irA(activity, MisPacientesActivity::class.java)
                    true
                }
                R.id.nav_agenda -> {
                    irA(activity, AgendaVetActivity::class.java)
                    true
                }
                R.id.nav_mas -> {
                    irA(activity, PerfilVetActivity::class.java)
                    true
                }
                else -> false
            }
        }
    }

    private fun irA(activity: AppCompatActivity, destino: Class<*>) {
        if (activity::class.java == destino) return
        val intent = Intent(activity, destino)
        intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        activity.startActivity(intent)
        if (activity !is HomeVeterinarioActivity) {
            activity.finish()
        }
    }
}
