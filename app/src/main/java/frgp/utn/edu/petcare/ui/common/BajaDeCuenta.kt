package frgp.utn.edu.petcare.ui.common

import frgp.utn.edu.petcare.ui.common.Avisos
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import frgp.utn.edu.petcare.data.Errores
import frgp.utn.edu.petcare.data.Sesion
import kotlinx.coroutines.launch

/** Pide confirmación y borra la cuenta del usuario con todo lo que cargó (mascotas, turnos y archivos). */
object BajaDeCuenta {

    fun confirmar(actividad: AppCompatActivity) {
        Avisos.confirmar(
            actividad, "¿Eliminar tu cuenta?",
            "Se borran tu cuenta y todo lo que cargaste: mascotas, turnos, historial y archivos. " +
                "Esta acción no se puede deshacer.",
            textoAceptar = "Eliminar cuenta", textoCancelar = "Cancelar"
        ) { eliminar(actividad) }
    }

    private fun eliminar(actividad: AppCompatActivity) {
        actividad.lifecycleScope.launch {
            try {
                Sesion.eliminarCuenta()
                Avisos.mostrar(actividad, "Tu cuenta fue eliminada")
                Sesion.volverAlIngreso(actividad)
            } catch (e: Exception) {
                Avisos.error(actividad, Errores.mensaje(e))
            }
        }
    }
}
