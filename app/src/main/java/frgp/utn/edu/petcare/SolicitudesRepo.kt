package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.data.Servicios

class SolicitudItem(
    val id: String,
    val solicitante: String,
    val mascota: String,
    val hace: String,
    val fotoPath: String? = null,
    var estado: Estado = Estado.PENDIENTE
) {
    enum class Estado { PENDIENTE, ACEPTADA, RECHAZADA }
}

/** Dueños que quieren compartir una mascota con el veterinario en sesión. */
object SolicitudesRepo {

    val paraVeterinario: MutableList<SolicitudItem> = mutableListOf()

    fun limpiar() = paraVeterinario.clear()

    suspend fun cargar() {
        val f = Servicios.fuente
        val pendientes = f.accesos().filter { it.estado == "pendiente" && it.iniciadoPor == "dueno" }
        val mascotas = f.mascotasDelVeterinario().associateBy { it.id }
        val lista = pendientes.map { a ->
            val mascota = mascotas[a.mascotaId]
            val dueno = mascota?.dueno?.nombre ?: mascota?.propietarioNombre ?: "Un dueño"
            SolicitudItem(
                id = a.id, solicitante = dueno,
                mascota = "Quiere compartir a ${mascota?.nombre ?: "una mascota"}",
                hace = Fechas.haceTexto(a.createdAt)
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
