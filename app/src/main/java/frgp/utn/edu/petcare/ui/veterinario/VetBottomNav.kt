package frgp.utn.edu.petcare.ui.veterinario

import android.content.Intent
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.bottomnavigation.BottomNavigationView
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.ui.common.VetUi

/**
 * Barra inferior de las pantallas que se abren encima de una sección (ficha del paciente, solicitudes, vacunas):
 * tocar una solapa vuelve al contenedor [HomeVeterinarioActivity] en esa sección.
 */
object VetBottomNav {

    fun setup(activity: AppCompatActivity, selectedItemId: Int) {
        VetUi.barras(activity)
        val bottomNav = activity.findViewById<BottomNavigationView>(R.id.bottomNavigation) ?: return
        bottomNav.selectedItemId = selectedItemId

        activity.findViewById<View>(R.id.fabCenter)?.setOnClickListener {
            activity.startActivity(Intent(activity, AgregarConsultaActivity::class.java))
        }

        bottomNav.setOnItemSelectedListener { item ->
            when (item.itemId) {
                selectedItemId -> true
                R.id.nav_inicio, R.id.nav_pacientes, R.id.nav_agenda, R.id.nav_mas -> {
                    irA(activity, item.itemId)
                    false
                }
                else -> false
            }
        }
    }

    private fun irA(activity: AppCompatActivity, navId: Int) {
        val intent = Intent(activity, HomeVeterinarioActivity::class.java)
            .putExtra(HomeVeterinarioActivity.EXTRA_SECCION, navId)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        activity.startActivity(intent)
        activity.finish()
    }
}
