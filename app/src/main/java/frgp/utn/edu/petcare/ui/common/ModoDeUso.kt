package frgp.utn.edu.petcare.ui.common

import android.content.Intent
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import frgp.utn.edu.petcare.data.Errores
import frgp.utn.edu.petcare.data.Sesion
import frgp.utn.edu.petcare.ui.dueno.DuenoActivity
import frgp.utn.edu.petcare.ui.veterinario.HomeVeterinarioActivity
import kotlinx.coroutines.launch

/** Pasa de usar la cuenta como dueño a usarla como veterinario (y al revés) sin cerrar la sesión. */
object ModoDeUso {

    fun cambiar(actividad: AppCompatActivity, nuevo: Sesion.Rol) {
        actividad.lifecycleScope.launch {
            try {
                Sesion.cambiarModo(nuevo)
                val destino = if (nuevo == Sesion.Rol.VETERINARIO) HomeVeterinarioActivity::class.java
                else DuenoActivity::class.java
                actividad.startActivity(
                    Intent(actividad, destino).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
                )
            } catch (e: Exception) {
                Avisos.error(actividad, Errores.mensaje(e))
            }
        }
    }
}
