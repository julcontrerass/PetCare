package frgp.utn.edu.petcare.ui.common

import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.data.Errores
import frgp.utn.edu.petcare.data.Sesion
import kotlinx.coroutines.launch

/** Pide confirmación y borra la cuenta del usuario con todo lo que cargó (mascotas, turnos y archivos). */
object BajaDeCuenta {

    fun confirmar(actividad: AppCompatActivity) {
        val dialogo = AlertDialog.Builder(actividad)
            .setTitle("Eliminar mi cuenta")
            .setMessage(
                "Se borran tu cuenta y todo lo que cargaste: mascotas, turnos, historial y archivos. " +
                    "Esta acción no se puede deshacer."
            )
            .setPositiveButton("Eliminar cuenta") { _, _ -> eliminar(actividad) }
            .setNegativeButton(R.string.btn_cancelar, null)
            .create()
        dialogo.show()
        dialogo.getButton(AlertDialog.BUTTON_POSITIVE)?.setTextColor(ContextCompat.getColor(actividad, R.color.danger_red))
    }

    private fun eliminar(actividad: AppCompatActivity) {
        actividad.lifecycleScope.launch {
            try {
                Sesion.eliminarCuenta()
                Toast.makeText(actividad, "Tu cuenta fue eliminada", Toast.LENGTH_LONG).show()
                Sesion.volverAlIngreso(actividad)
            } catch (e: Exception) {
                Toast.makeText(actividad, Errores.mensaje(e), Toast.LENGTH_LONG).show()
            }
        }
    }
}
