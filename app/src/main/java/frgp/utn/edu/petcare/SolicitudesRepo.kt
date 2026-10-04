package frgp.utn.edu.petcare

class SolicitudItem @JvmOverloads constructor(
    val solicitante: String,
    val mascota: String,
    val hace: String,
    val fotoRes: Int,
    var estado: Estado = Estado.PENDIENTE,
    /** Paciente que se suma al veterinario al aceptar (solo solicitudes del lado veterinario). */
    val paciente: Paciente? = null
) {
    enum class Estado { PENDIENTE, ACEPTADA, RECHAZADA }
}

/** Solicitudes de acceso de la sesión (demo, en memoria). */
object SolicitudesRepo {

    /** Dueños que comparten una mascota con el veterinario. */
    val paraVeterinario: MutableList<SolicitudItem> = mutableListOf(
        SolicitudItem(
            "Marcos Pérez", "Quiere compartir a Max", "Hace 1 hora", R.drawable.juani,
            paciente = PacientesRepo.nuevo("Max", PacientesRepo.ESPECIE_PERRO, "Labrador", "Macho", "Marcos Pérez", "+54 11 5555-0101")
        ),
        SolicitudItem(
            "Ana García", "Quiere compartir a Rocky", "Hace 3 horas", R.drawable.luna,
            paciente = PacientesRepo.nuevo("Rocky", PacientesRepo.ESPECIE_PERRO, "Beagle", "Macho", "Ana García", "+54 11 5555-0202")
        ),
        SolicitudItem(
            "Lucía Díaz", "Quiere compartir a Nina", "Ayer", R.drawable.milo,
            paciente = PacientesRepo.nuevo("Nina", PacientesRepo.ESPECIE_GATO, "Común europeo", "Hembra", "Lucía Díaz", "+54 11 5555-0303")
        )
    )

    fun pendientesVeterinario() = paraVeterinario.count { it.estado == SolicitudItem.Estado.PENDIENTE }
}
