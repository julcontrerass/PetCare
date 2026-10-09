package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.ui.common.Avisos
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import frgp.utn.edu.petcare.data.Errores
import frgp.utn.edu.petcare.data.Servicios
import kotlinx.coroutines.launch

/** Avisos del veterinario: solicitudes de acceso, turnos nuevos y cancelaciones. */
object NotificacionesVet {

    fun mostrar(actividad: AppCompatActivity) {
        actividad.lifecycleScope.launch {
            try {
                val avisos = Servicios.fuente.notificaciones()
                val dialogo = AlertDialog.Builder(actividad).setTitle("Notificaciones")
                if (avisos.isEmpty()) {
                    dialogo.setMessage("No tenés nuevas notificaciones.")
                        .setPositiveButton("Aceptar", null)
                } else {
                    val textos = avisos.map { "${it.titulo}\n${it.mensaje}\n${Fechas.haceTexto(it.createdAt)}" }
                    dialogo.setItems(textos.toTypedArray(), null)
                        .setPositiveButton("Cerrar", null)
                        .setNeutralButton("Borrar todas") { _, _ ->
                            Servicios.escribir { Servicios.fuente.borrarNotificaciones() }
                        }
                    Servicios.escribir { Servicios.fuente.marcarNotificacionesLeidas() }
                }
                dialogo.show()
            } catch (e: Exception) {
                Avisos.error(actividad, Errores.mensaje(e))
            }
        }
    }
}
