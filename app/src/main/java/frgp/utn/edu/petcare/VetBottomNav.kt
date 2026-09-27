package frgp.utn.edu.petcare

import android.content.Intent
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.bottomnavigation.BottomNavigationView

object VetBottomNav {

    fun setup(activity: AppCompatActivity, selectedItemId: Int) {
        val bottomNav = activity.findViewById<BottomNavigationView>(R.id.bottomNavigation) ?: return
        bottomNav.selectedItemId = selectedItemId

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
                R.id.nav_agenda, R.id.nav_mas -> {
                    mostrarEnDesarrollo(activity)
                    false
                }
                else -> false
            }
        }
    }

    fun mostrarEnDesarrollo(activity: AppCompatActivity) {
        Toast.makeText(activity, R.string.funcion_en_desarrollo, Toast.LENGTH_SHORT).show()
    }

    private fun irA(activity: AppCompatActivity, destino: Class<*>) {
        val intent = Intent(activity, destino)
        intent.addFlags(Intent.FLAG_ACTIVITY_REORDER_TO_FRONT)
        activity.startActivity(intent)
        activity.finish()
    }
}
