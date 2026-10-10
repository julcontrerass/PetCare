package frgp.utn.edu.petcare

import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.data.Sesion
import frgp.utn.edu.petcare.data.remoto.NuevoTurnoDto
import frgp.utn.edu.petcare.data.remoto.TurnoDto
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.OffsetDateTime
import java.time.ZoneId
import java.util.UUID

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
    var veterinarioId: String? = null
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

    private val diasSemana = arrayOf("Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo")

    /** "Mayo" a partir del número de mes (1 a 12). */
    fun nombreMes(mes: Int) = mesesLargos[mes - 1]

    /** "Mayo 2026" cuando se pasa un año-mes. */
    fun mesAnio(ym: java.time.YearMonth) = "${mesesLargos[ym.monthValue - 1]} ${ym.year}"

    /** "Ene", "Feb"... */
    fun mesCorto(mes: Int) = meses[mes - 1]

    fun diaSemana(f: LocalDate) = diasSemana[f.dayOfWeek.value - 1]

    /** "15 de mayo de 2026". */
    fun larga(f: LocalDate) = "${f.dayOfMonth} de ${nombreMes(f.monthValue).lowercase()} de ${f.year}"

    /** "15 Mar 2026" ("15 mar 2026" o "15/03/2026" también se entienden). */
    fun parsear(texto: String?): LocalDate? {
        if (texto == null) return null
        Regex("(\\d{1,2})\\s+([A-Za-zñÑ]{3,})\\.?\\s+(\\d{4})").find(texto)?.let { t ->
            val mes = t.groupValues[2].lowercase().take(3)
            val indice = meses.indexOfFirst { it.lowercase() == mes }
            if (indice >= 0) {
                return runCatching { LocalDate.of(t.groupValues[3].toInt(), indice + 1, t.groupValues[1].toInt()) }.getOrNull()
            }
        }
        Regex("(\\d{1,2})/(\\d{1,2})/(\\d{4})").find(texto)?.let { n ->
            return runCatching {
                LocalDate.of(n.groupValues[3].toInt(), n.groupValues[2].toInt(), n.groupValues[1].toInt())
            }.getOrNull()
        }
        return null
    }

    fun relativa(f: LocalDate, hoy: LocalDate = LocalDate.now()): String = when (f) {
        hoy -> "Hoy"
        hoy.plusDays(1) -> "Mañana"
        hoy.minusDays(1) -> "Ayer"
        else -> corta(f)
    }

    /** Convierte la fecha con zona horaria que manda el servidor a la hora local del teléfono. */
    fun instante(texto: String?): LocalDateTime =
        runCatching { OffsetDateTime.parse(texto).atZoneSameInstant(ZoneId.systemDefault()).toLocalDateTime() }
            .getOrDefault(LocalDateTime.now())

    /** "Hace 5 min", "Hace 2 horas", "Ayer" o la fecha, según cuánto pasó. */
    fun haceTexto(texto: String?, ahora: LocalDateTime = LocalDateTime.now()): String {
        val momento = instante(texto)
        val minutos = java.time.Duration.between(momento, ahora).toMinutes().coerceAtLeast(0)
        return when {
            minutos < 1 -> "Ahora"
            minutos < 60 -> "Hace $minutos min"
            minutos < 24 * 60 -> "Hace ${minutos / 60} ${if (minutos / 60 == 1L) "hora" else "horas"}"
            else -> relativa(momento.toLocalDate(), ahora.toLocalDate())
        }
    }
}

/** Turnos y consultas del veterinario en sesión. */
object AgendaRepo {

    val tipos = listOf("Consulta", "Vacuna", "Tratamiento", "Cirugía", "Control", "Otro")

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
        notas = t.notas.orEmpty(), veterinario = PerfilVetRepo.nombre, veterinarioId = t.veterinarioId
    )

    private val alFallar: suspend () -> Unit = {
        cargar()
        Servicios.avisarCambio()
    }

    /** Agenda un turno propio. El servidor valida que el horario esté libre y dentro de la atención. */
    fun agregar(
        pacienteId: String, tipo: String, motivo: String, fecha: LocalDate, hora: String,
        estado: EstadoEvento, notas: String
    ): EventoVet {
        val id = UUID.randomUUID().toString()
        val vetId = Sesion.usuarioId
        val e = EventoVet(id, pacienteId, tipo, motivo, fecha, hora, estado, notas, PerfilVetRepo.nombre, vetId)
        eventos.add(e)
        Servicios.escribir(alFallar = alFallar) {
            Servicios.fuente.crearTurno(
                NuevoTurnoDto(
                    id = id, mascotaId = pacienteId, veterinarioId = vetId, categoria = tipo, motivo = motivo,
                    fecha = fecha.toString(), hora = "$hora:00", estado = nombreEstado(estado),
                    notas = notas.ifBlank { null }, creadoPor = vetId ?: error("No hay una sesión iniciada")
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
