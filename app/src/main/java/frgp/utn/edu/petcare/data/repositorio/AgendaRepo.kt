package frgp.utn.edu.petcare.data.repositorio

import frgp.utn.edu.petcare.data.remoto.NuevoTurnoDto
import frgp.utn.edu.petcare.data.remoto.TurnoDto
import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.data.Sesion
import java.time.LocalDate
import java.util.UUID
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

enum class EstadoEvento(val etiqueta: String) {
    PENDIENTE("Pendiente"),
    COMPLETADO("Completado"),
    CANCELADO("Cancelado")
}

data class EventoVet(
    val id: String,
    var pacienteId: String,
    var tipo: String,
    var motivo: String,
    var fecha: LocalDate,
    var hora: String,
    var estado: EstadoEvento,
    var notas: String,
    var veterinario: String,
    var veterinarioId: String? = null,
    /** Minutos que dura el turno; lo fija el servidor según el servicio. */
    var duracionMin: Int = 30,
    /** Lugar de atención donde es el turno. */
    var sedeId: String? = null
)

/** Turnos y consultas del veterinario en sesión. */
object AgendaRepo {

    private val TIPOS_GENERALES = listOf("Consulta", "Control", "Vacuna", "Desparasitación", "Tratamiento", "Cirugía", "Otro")

    /**
     * Tipos que se pueden elegir al cargar un turno propio: los servicios que ofrece el veterinario (cada uno con
     * su duración) y los generales. [actual] es el tipo que ya tiene un turno que se está editando.
     */
    fun tipos(actual: String? = null): List<String> =
        (PerfilVetRepo.serviciosOfrecidos() + TIPOS_GENERALES + listOfNotNull(actual?.takeIf { it.isNotBlank() })).distinct()

    val eventos: MutableList<EventoVet> = mutableListOf()

    fun limpiar() = eventos.clear()

    suspend fun cargar() {
        val nuevos = Servicios.fuente.turnos().map(::aEvento)
        eventos.clear()
        eventos.addAll(nuevos)
    }

    private fun aEvento(t: TurnoDto) = EventoVet(
        id = t.id, pacienteId = t.mascotaId, tipo = t.categoria,
        motivo = t.motivo?.takeIf { it.isNotBlank() } ?: t.categoria,
        fecha = LocalDate.parse(t.fecha), hora = t.hora.take(5),
        estado = when (t.estado) {
            "completado" -> EstadoEvento.COMPLETADO
            "cancelado" -> EstadoEvento.CANCELADO
            else -> EstadoEvento.PENDIENTE
        },
        notas = t.notas.orEmpty(), veterinario = PerfilVetRepo.nombre, veterinarioId = t.veterinarioId,
        duracionMin = t.duracionMin, sedeId = t.sedeId
    )

    private val alFallar: suspend () -> Unit = {
        cargar()
        Servicios.avisarCambio()
    }

    /** Agenda un turno propio. El servidor valida que el horario esté libre y dentro de la atención. */
    fun agregar(
        pacienteId: String, tipo: String, motivo: String, fecha: LocalDate, hora: String,
        estado: EstadoEvento, notas: String, sedeId: String? = null
    ): EventoVet {
        val id = UUID.randomUUID().toString()
        val vetId = Sesion.usuarioId
        val lugar = PerfilVetRepo.sede(sedeId)?.id?.takeIf { it.isNotBlank() }
        val e = EventoVet(
            id, pacienteId, tipo, motivo, fecha, hora, estado, notas, PerfilVetRepo.nombre, vetId,
            PerfilVetRepo.duracionDe(tipo), lugar
        )
        eventos.add(e)
        Servicios.escribir(alFallar = alFallar) {
            Servicios.fuente.crearTurno(
                NuevoTurnoDto(
                    id = id, mascotaId = pacienteId, veterinarioId = vetId, categoria = tipo, motivo = motivo,
                    fecha = fecha.toString(), hora = "$hora:00", estado = nombreEstado(estado),
                    notas = notas.ifBlank { null }, creadoPor = vetId ?: error("No hay una sesión iniciada"),
                    sedeId = lugar
                )
            )
        }
        return e
    }

    /** Guarda en el servidor los cambios hechos a un turno (tipo, motivo, fecha, hora y notas). */
    fun guardar(e: EventoVet) {
        Servicios.escribir(alFallar = alFallar) {
            Servicios.fuente.actualizarTurno(e.id, buildJsonObject {
                put("categoria", e.tipo)
                put("motivo", e.motivo)
                put("fecha", e.fecha.toString())
                put("hora", "${e.hora}:00")
                e.sedeId?.let { put("sede_id", it) }
                put("notas", e.notas.ifBlank { null })
            })
        }
    }

    fun cambiarEstado(e: EventoVet, estado: EstadoEvento) {
        e.estado = estado
        Servicios.escribir(alFallar = alFallar) {
            Servicios.fuente.actualizarTurno(e.id, buildJsonObject { put("estado", nombreEstado(estado)) })
        }
    }

    private fun nombreEstado(estado: EstadoEvento) = when (estado) {
        EstadoEvento.PENDIENTE -> "pendiente"
        EstadoEvento.COMPLETADO -> "completado"
        EstadoEvento.CANCELADO -> "cancelado"
    }

    fun porId(id: String?): EventoVet? = eventos.firstOrNull { it.id == id }

    private val orden = compareBy<EventoVet>({ it.fecha }, { it.hora })

    fun deHoy(): List<EventoVet> =
        eventos.filter { it.fecha == LocalDate.now() && it.estado == EstadoEvento.PENDIENTE }.sortedWith(orden)

    fun proximos(): List<EventoVet> =
        eventos.filter { it.estado == EstadoEvento.PENDIENTE && !it.fecha.isBefore(LocalDate.now()) }.sortedWith(orden)

    fun porEstado(estado: EstadoEvento): List<EventoVet> =
        eventos.filter { it.estado == estado }.sortedWith(orden.reversed())

    fun deMascota(pacienteId: String): List<EventoVet> =
        eventos.filter { it.pacienteId == pacienteId }.sortedWith(orden.reversed())

    fun ultimaConsulta(pacienteId: String): EventoVet? =
        eventos.filter { it.pacienteId == pacienteId && it.estado == EstadoEvento.COMPLETADO }
            .maxWithOrNull(compareBy({ it.fecha }, { it.hora }))

    fun proximoEvento(pacienteId: String): EventoVet? =
        proximos().firstOrNull { it.pacienteId == pacienteId }

    /** Pacientes distintos con turno hoy, estén pendientes o ya atendidos (los cancelados no cuentan). */
    fun pacientesHoy(): Int = eventos
        .filter { it.fecha == LocalDate.now() && it.estado != EstadoEvento.CANCELADO }
        .map { it.pacienteId }.distinct().size
}
