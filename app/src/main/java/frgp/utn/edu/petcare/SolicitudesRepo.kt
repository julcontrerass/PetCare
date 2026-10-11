package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.data.Servicios

class SolicitudItem(
    val id: String,
    val solicitante: String,
    val mascota: String,
    val hace: String,
    val fotoPath: String? = null,
    var estado: Estado = Estado.PENDIENTE,
    /** La pidió el propio veterinario: espera la respuesta del dueño y no tiene botones para resolverla. */
    val enviada: Boolean = false
) {
    enum class Estado { PENDIENTE, ACEPTADA, RECHAZADA }
}

/**
 * Solicitudes de acceso del veterinario en sesión: las que él le hizo a un dueño (con su estado) y las que un
 * dueño le compartió y todavía no respondió.
 */
object SolicitudesRepo {

    val paraVeterinario: MutableList<SolicitudItem> = mutableListOf()

    fun limpiar() = paraVeterinario.clear()

    suspend fun cargar() {
        val lista = Servicios.fuente.misSolicitudes().map { s ->
            val propia = s.iniciadoPor == "veterinario"
            SolicitudItem(
                id = s.id, solicitante = s.duenoNombre ?: "Un dueño",
                mascota = if (propia) "Pediste acceso a ${s.mascotaNombre}" else "Quiere compartir a ${s.mascotaNombre}",
                hace = Fechas.haceTexto(s.createdAt),
                estado = when (s.estado) {
                    "activo" -> SolicitudItem.Estado.ACEPTADA
                    "rechazado", "inactivo" -> SolicitudItem.Estado.RECHAZADA
                    else -> SolicitudItem.Estado.PENDIENTE
                },
                enviada = propia
            )
        }
        paraVeterinario.clear()
        paraVeterinario.addAll(lista)
    }

    fun pendientesVeterinario() = paraVeterinario.count { it.estado == SolicitudItem.Estado.PENDIENTE }

    /** El veterinario acepta o rechaza que un dueño le comparta una mascota. */
    fun resolver(item: SolicitudItem, aceptar: Boolean) {
        item.estado = if (aceptar) SolicitudItem.Estado.ACEPTADA else SolicitudItem.Estado.RECHAZADA
        Servicios.escribir(
            alFallar = { cargar(); PacientesRepo.cargar(); Servicios.avisarCambio() },
            alTerminar = { PacientesRepo.cargar(); Servicios.avisarCambio() }
        ) {
            Servicios.fuente.actualizarAcceso(item.id, if (aceptar) "activo" else "rechazado")
        }
    }
}
