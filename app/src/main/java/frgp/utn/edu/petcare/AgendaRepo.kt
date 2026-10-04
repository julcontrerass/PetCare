package frgp.utn.edu.petcare

import java.time.LocalDate

enum class EstadoEvento(val etiqueta: String) {
    PENDIENTE("Pendiente"),
    COMPLETADO("Completado"),
    CANCELADO("Cancelado")
}

data class EventoVet(
    val id: Int,
    var pacienteId: Int,
    var tipo: String,
    var motivo: String,
    var fecha: LocalDate,
    var hora: String,
    var estado: EstadoEvento,
    var notas: String,
    var veterinario: String
)

object Fechas {
    private val meses = arrayOf("Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic")
    private val mesesLargos = arrayOf(
        "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
        "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
    )

    fun corta(f: LocalDate) = "%02d %s %d".format(f.dayOfMonth, meses[f.monthValue - 1], f.year)
    fun mesAnio(f: LocalDate) = "${mesesLargos[f.monthValue - 1]} ${f.year}"
    fun mesCorto(f: LocalDate) = meses[f.monthValue - 1].uppercase()

    fun relativa(f: LocalDate, hoy: LocalDate = LocalDate.now()): String = when (f) {
        hoy -> "Hoy"
        hoy.plusDays(1) -> "Mañana"
        hoy.minusDays(1) -> "Ayer"
        else -> corta(f)
    }
}

/** Turnos y consultas del veterinario (datos de demostración en memoria). */
object AgendaRepo {

    val tipos = listOf("Consulta", "Vacuna", "Tratamiento", "Cirugía", "Control", "Otro")

    private var siguienteId = 1
    val eventos: MutableList<EventoVet> = mutableListOf()

    init {
        val hoy = LocalDate.now()
        val vet = PerfilVetRepo.nombre
        agregar(3, "Vacuna", "Vacuna anual", hoy, "10:00", EstadoEvento.PENDIENTE, "Traer carnet de vacunación.", vet)
        agregar(4, "Cirugía", "Cirugía (revisión)", hoy, "11:30", EstadoEvento.PENDIENTE, "Control de puntos y cicatrización.", vet)
        agregar(1, "Consulta", "Consulta por picazón", hoy, "15:00", EstadoEvento.PENDIENTE, "Rascado frecuente en las orejas.", vet)
        agregar(5, "Control", "Control general", hoy, "16:30", EstadoEvento.PENDIENTE, "", vet)
        agregar(2, "Control", "Control de peso", hoy.plusDays(1), "09:30", EstadoEvento.PENDIENTE, "", vet)
        agregar(1, "Vacuna", "Refuerzo antirrábico", hoy.plusDays(3), "12:00", EstadoEvento.PENDIENTE, "", vet)
        agregar(4, "Consulta", "Revisión anual", hoy.minusDays(18), "10:00", EstadoEvento.COMPLETADO, "Todo normal. Control en 1 año.", vet)
        agregar(4, "Tratamiento", "Desparasitación", hoy.minusDays(40), "11:00", EstadoEvento.COMPLETADO, "Siguiente dosis en 3 meses.", vet)
        agregar(1, "Consulta", "Análisis de sangre", hoy.minusDays(30), "16:00", EstadoEvento.COMPLETADO, "Resultados normales.", vet)
        agregar(3, "Control", "Control general", hoy.minusDays(10), "10:30", EstadoEvento.COMPLETADO, "", vet)
        agregar(2, "Consulta", "Consulta dermatológica", hoy.minusDays(5), "14:00", EstadoEvento.CANCELADO, "Cancelado por el propietario.", vet)
    }

    fun agregar(
        pacienteId: Int, tipo: String, motivo: String, fecha: LocalDate, hora: String,
        estado: EstadoEvento, notas: String, veterinario: String
    ): EventoVet {
        val e = EventoVet(siguienteId++, pacienteId, tipo, motivo, fecha, hora, estado, notas, veterinario)
        eventos.add(e)
        return e
    }

    fun porId(id: Int): EventoVet? = eventos.firstOrNull { it.id == id }

    private val orden = compareBy<EventoVet>({ it.fecha }, { it.hora })

    fun deHoy(): List<EventoVet> =
        eventos.filter { it.fecha == LocalDate.now() && it.estado == EstadoEvento.PENDIENTE }.sortedWith(orden)

    fun proximos(): List<EventoVet> =
        eventos.filter { it.estado == EstadoEvento.PENDIENTE && !it.fecha.isBefore(LocalDate.now()) }.sortedWith(orden)

    fun porEstado(estado: EstadoEvento): List<EventoVet> =
        eventos.filter { it.estado == estado }.sortedWith(orden.reversed())

    fun deMascota(pacienteId: Int): List<EventoVet> =
        eventos.filter { it.pacienteId == pacienteId }.sortedWith(orden.reversed())

    fun ultimaConsulta(pacienteId: Int): EventoVet? =
        eventos.filter { it.pacienteId == pacienteId && it.estado == EstadoEvento.COMPLETADO }
            .maxWithOrNull(compareBy({ it.fecha }, { it.hora }))

    fun proximoEvento(pacienteId: Int): EventoVet? =
        proximos().firstOrNull { it.pacienteId == pacienteId }

    fun pacientesHoy(): Int = deHoy().map { it.pacienteId }.distinct().size
}
