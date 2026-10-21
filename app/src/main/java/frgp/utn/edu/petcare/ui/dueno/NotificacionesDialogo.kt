package frgp.utn.edu.petcare.ui.dueno

import frgp.utn.edu.petcare.data.repositorio.DuenoRepo
import frgp.utn.edu.petcare.model.NotificacionDueno
import frgp.utn.edu.petcare.ui.common.Avisos
import frgp.utn.edu.petcare.ui.common.PanelAvisos

/** Lista de notificaciones del dueño, en un panel que sube desde abajo. */
class NotificacionesDialogo(private val host: DuenoActivity) {

    fun mostrar() {
        val lista = DuenoRepo.notificaciones.toList()
        // Las que todavía no se vieron se marcan en la lista y recién después se dan por leídas
        val noLeidas = lista.filter { !it.leida }.toSet()
        DuenoRepo.marcarNotificacionesLeidas()
        host.actualizarBadgeNotificaciones()

        val avisos = lista.map {
            PanelAvisos.Item(it.tipo, it.titulo, it.mensaje, it.creada, it in noLeidas, origen = it)
        }
        PanelAvisos.mostrar(
            host, avisos,
            alBorrar = { item ->
                DuenoRepo.borrarNotificacion(item.origen as NotificacionDueno)
                host.actualizarBadgeNotificaciones()
            },
            alBorrarTodas = {
                DuenoRepo.limpiarNotificaciones()
                host.actualizarBadgeNotificaciones()
                Avisos.mostrar(host, "Notificaciones borradas")
            }
        )
    }
}
