package frgp.utn.edu.petcare.data.repositorio

import frgp.utn.edu.petcare.data.CatalogoMedico
import frgp.utn.edu.petcare.model.SedeVet
import java.time.LocalDate
import java.time.LocalTime

/**
 * Reglas de disponibilidad del veterinario: días de atención, franja horaria del perfil y turnos ya ocupados en
 * la agenda. Cada turno dura lo que corresponde a su servicio; los horarios arrancan cada [PASO_MIN] minutos.
 */
object DisponibilidadVet {

    /** Duración que se usa cuando todavía no se sabe qué servicio es. */
    const val DURACION_MIN = 30

    /** Cada cuántos minutos arranca un horario de la grilla. */
    const val PASO_MIN = 30

    data class Horario(val hora: String, val libre: Boolean)

    /** El lugar que se usa cuando no se indica uno: el principal (o, sin lugares cargados, los datos de siempre). */
    private fun lugar(sede: SedeVet?): SedeVet = sede ?: PerfilVetRepo.sede(null) ?: SedeVet(
        id = "", nombre = PerfilVetRepo.clinica,
        dias = PerfilVetRepo.diasSeleccionados.withIndex().filter { it.value }.map { it.index + 1 }.toSet(),
        apertura = PerfilVetRepo.horaApertura, cierre = PerfilVetRepo.horaCierre
    )

    fun trabajaEl(fecha: LocalDate, sede: SedeVet? = null): Boolean =
        fecha.dayOfWeek.value in lugar(sede).dias

    fun nombreDia(fecha: LocalDate): String = PerfilVetRepo.todosLosDias[fecha.dayOfWeek.value - 1]

    private fun minutos(hora: String): Int? {
        val partes = hora.trim().split(":")
        val h = partes.getOrNull(0)?.toIntOrNull() ?: return null
        val m = partes.getOrNull(1)?.toIntOrNull() ?: return null
        return h * 60 + m
    }

    private fun formato(min: Int) = "%02d:%02d".format(min / 60, min % 60)

    /** "10:00" + 90 min = "11:30". */
    fun horaFin(hora: String, duracionMin: Int): String = formato(((minutos(hora) ?: 0) + duracionMin) % (24 * 60))

    /** Un turno pendiente ocupa el horario si su franja se superpone con la del turno que se quiere cargar. */
    fun ocupado(fecha: LocalDate, hora: String, duracionMin: Int, ignorarId: String? = null): Boolean {
        val inicio = minutos(hora) ?: return false
        return AgendaRepo.eventos.any { e ->
            if (e.id == ignorarId || e.estado != EstadoEvento.PENDIENTE || e.fecha != fecha) return@any false
            val otro = minutos(e.hora) ?: return@any false
            inicio < otro + e.duracionMin && otro < inicio + duracionMin
        }
    }

    private fun yaPaso(fecha: LocalDate, min: Int): Boolean {
        val hoy = LocalDate.now()
        if (fecha.isBefore(hoy)) return true
        if (fecha != hoy) return false
        val ahora = LocalTime.now()
        return min <= ahora.hour * 60 + ahora.minute
    }

    /** Los horarios de inicio de la franja de atención para un turno de [duracionMin], marcando cuáles siguen libres. */
    fun horarios(
        fecha: LocalDate, duracionMin: Int = DURACION_MIN, ignorarId: String? = null, sede: SedeVet? = null
    ): List<Horario> {
        if (!trabajaEl(fecha, sede)) return emptyList()
        val inicio = minutos(lugar(sede).apertura) ?: return emptyList()
        val fin = minutos(lugar(sede).cierre) ?: return emptyList()
        val lista = mutableListOf<Horario>()
        var t = inicio
        while (t + duracionMin <= fin) {
            val hora = formato(t)
            lista.add(Horario(hora, !yaPaso(fecha, t) && !ocupado(fecha, hora, duracionMin, ignorarId)))
            t += PASO_MIN
        }
        return lista
    }

    /** Devuelve el motivo por el que no se puede agendar, o null si está todo bien. */
    fun validar(
        fecha: LocalDate, hora: String, duracionMin: Int = DURACION_MIN, ignorarId: String? = null,
        sede: SedeVet? = null
    ): String? {
        val donde = lugar(sede)
        val enOtro = if (PerfilVetRepo.sedes.size > 1 && donde.nombre.isNotBlank()) " en ${donde.nombre}" else ""
        if (fecha.isBefore(LocalDate.now())) return "No podés seleccionar una fecha que ya pasó"
        if (!trabajaEl(fecha, sede)) return "No atendés los ${nombreDia(fecha).lowercase()}$enOtro"
        val m = minutos(hora) ?: return "Elegí un horario"
        val inicio = minutos(donde.apertura) ?: 0
        val fin = minutos(donde.cierre) ?: 24 * 60
        if (m < inicio || m >= fin) {
            return "El horario está fuera de tu atención$enOtro (${donde.apertura} a ${donde.cierre} hs)"
        }
        if (m + duracionMin > fin) {
            return "El turno dura ${CatalogoMedico.textoDuracion(duracionMin)} y no llega a terminar antes de que " +
                "cierres (${donde.cierre} hs)"
        }
        if (yaPaso(fecha, m)) return "Ese horario ya pasó"
        if (ocupado(fecha, hora, duracionMin, ignorarId)) return "Ya tenés un turno en ese horario"
        return null
    }
}
