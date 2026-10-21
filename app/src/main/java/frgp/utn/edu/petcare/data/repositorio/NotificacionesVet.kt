package frgp.utn.edu.petcare.data.repositorio

import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import frgp.utn.edu.petcare.data.avisos.AvisosDelSistema
import frgp.utn.edu.petcare.data.Errores
import frgp.utn.edu.petcare.data.remoto.NotificacionDto
import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.model.TipoNotificacion
import frgp.utn.edu.petcare.ui.common.Avisos
import frgp.utn.edu.petcare.ui.common.PanelAvisos
import frgp.utn.edu.petcare.util.Fechas
import kotlinx.coroutines.launch

/** Avisos del veterinario: turnos nuevos, cambios y cancelaciones, y solicitudes de acceso. */
object NotificacionesVet {

    private var ultimas: List<NotificacionDto> = emptyList()

    /** Hay avisos que el veterinario todavía no abrió (para el punto rojo de la campana). */
    val hayNuevas: Boolean get() = ultimas.any { !it.leida }

    /** Cuántos avisos todavía no se abrieron. */
    val sinLeer: Int get() = ultimas.count { !it.leida }

    fun limpiar() {
        ultimas = emptyList()
    }

    suspend fun cargar(silencioso: Boolean = false) {
        ultimas = Servicios.fuente.notificaciones()
        Servicios.contextoApp?.let { runCatching { AvisosDelSistema.mostrarNuevas(it, ultimas, silencioso) } }
    }

    /** Borra una sola notificación: se saca ya de la lista y se borra del servidor en segundo plano. */
    fun borrar(id: String) {
        ultimas = ultimas.filterNot { it.id == id }
        Servicios.escribir { Servicios.fuente.borrarNotificacion(id) }
    }

    fun mostrar(actividad: AppCompatActivity, alCambiar: () -> Unit = {}) {
        actividad.lifecycleScope.launch {
            try {
                cargar()
                val avisos = ultimas
                val noLeidas = avisos.filter { !it.leida }.map { it.id }.toSet()
                val items = avisos.map {
                    PanelAvisos.Item(
                        TipoNotificacion.deClave(it.tipo), it.titulo, it.mensaje,
                        Fechas.instante(it.createdAt), it.id in noLeidas, origen = it
                    )
                }
                PanelAvisos.mostrar(
                    actividad, items,
                    alBorrar = { item ->
                        borrar((item.origen as NotificacionDto).id)
                        alCambiar()
                    },
                    alBorrarTodas = {
                        ultimas = emptyList()
                        Servicios.escribir { Servicios.fuente.borrarNotificaciones() }
                        alCambiar()
                        Avisos.exito(actividad, "Notificaciones borradas")
                    }
                )
                if (noLeidas.isNotEmpty()) {
                    ultimas = avisos.map { it.copy(leida = true) }
                    Servicios.escribir { Servicios.fuente.marcarNotificacionesLeidas() }
                    alCambiar()
                }
            } catch (e: Exception) {
                Avisos.error(actividad, Errores.mensaje(e))
            }
        }
    }
}
