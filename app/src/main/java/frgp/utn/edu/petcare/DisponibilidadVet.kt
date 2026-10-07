package frgp.utn.edu.petcare

import java.time.LocalDate
import java.time.LocalTime

/**
 * Reglas de disponibilidad del veterinario: días de atención, franja horaria del perfil
 * y turnos ya ocupados en la agenda. Los turnos duran [DURACION_MIN] minutos.
 */
object DisponibilidadVet {

    const val DURACION_MIN = 30

    data class Horario(val hora: String, val libre: Boolean)

    fun trabajaEl(fecha: LocalDate): Boolean =
        PerfilVetRepo.diasSeleccionados[fecha.dayOfWeek.value - 1]

    fun nombreDia(fecha: LocalDate): String = PerfilVetRepo.todosLosDias[fecha.dayOfWeek.value - 1]

    private fun minutos(hora: String): Int? {
        val partes = hora.trim().split(":")
        val h = partes.getOrNull(0)?.toIntOrNull() ?: return null
        val m = partes.getOrNull(1)?.toIntOrNull() ?: return null
        return h * 60 + m
    }

    private fun formato(min: Int) = "%02d:%02d".format(min / 60, min % 60)

    /** Un turno pendiente ocupa el horario si se superpone con la duración de otro. */
    fun ocupado(fecha: LocalDate, hora: String, ignorarId: Int? = null): Boolean {
        val m = minutos(hora) ?: return false
        return AgendaRepo.eventos.any { e ->
            e.id != ignorarId && e.estado == EstadoEvento.PENDIENTE && e.fecha == fecha &&
                minutos(e.hora)?.let { kotlin.math.abs(it - m) < DURACION_MIN } == true
        }
    }

    private fun yaPaso(fecha: LocalDate, min: Int): Boolean {
        val hoy = LocalDate.now()
        if (fecha.isBefore(hoy)) return true
        if (fecha != hoy) return false
        val ahora = LocalTime.now()
        return min <= ahora.hour * 60 + ahora.minute
    }

    /** Todos los horarios de la franja de atención, marcando cuáles siguen libres. */
    fun horarios(fecha: LocalDate, ignorarId: Int? = null): List<Horario> {
        if (!trabajaEl(fecha)) return emptyList()
        val inicio = minutos(PerfilVetRepo.horaApertura) ?: return emptyList()
        val fin = minutos(PerfilVetRepo.horaCierre) ?: return emptyList()
        val lista = mutableListOf<Horario>()
        var t = inicio
        while (t + DURACION_MIN <= fin) {
            val hora = formato(t)
            lista.add(Horario(hora, !yaPaso(fecha, t) && !ocupado(fecha, hora, ignorarId)))
            t += DURACION_MIN
        }
        return lista
    }

    /** Devuelve el motivo por el que no se puede agendar, o null si está todo bien. */
    fun validar(fecha: LocalDate, hora: String, ignorarId: Int? = null): String? {
        if (fecha.isBefore(LocalDate.now())) return "No podés seleccionar una fecha que ya pasó"
        if (!trabajaEl(fecha)) return "No atendés los ${nombreDia(fecha).lowercase()}"
        val m = minutos(hora) ?: return "Elegí un horario"
        val inicio = minutos(PerfilVetRepo.horaApertura) ?: 0
        val fin = minutos(PerfilVetRepo.horaCierre) ?: 24 * 60
        if (m < inicio || m + DURACION_MIN > fin) {
            return "El horario está fuera de tu atención (${PerfilVetRepo.horaApertura} a ${PerfilVetRepo.horaCierre} hs)"
        }
        if (yaPaso(fecha, m)) return "Ese horario ya pasó"
        if (ocupado(fecha, hora, ignorarId)) return "Ya tenés un turno en ese horario"
        return null
    }
}
