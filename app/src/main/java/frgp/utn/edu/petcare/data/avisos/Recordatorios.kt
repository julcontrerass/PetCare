package frgp.utn.edu.petcare.data.avisos

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkerParameters
import androidx.work.WorkManager
import frgp.utn.edu.petcare.data.repositorio.EstadoEvento
import frgp.utn.edu.petcare.data.repositorio.EventoVet
import frgp.utn.edu.petcare.data.repositorio.PacientesRepo
import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.model.EstadoTurno
import frgp.utn.edu.petcare.model.EventoMascota
import frgp.utn.edu.petcare.util.Fechas
import java.time.Duration
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.util.concurrent.TimeUnit

/**
 * Avisa en el teléfono cuando se acerca la fecha de un turno, aunque la app esté cerrada. Cada vez que cambian los
 * turnos se vuelve a calcular todo y se reprograma, así lo cancelado o movido no avisa de más.
 */
object Recordatorios {

    private const val ETIQUETA = "recordatorio"
    private const val TRABAJO_AVISOS = "avisos-pendientes"

    /** Un aviso a mostrar en [momento]. */
    class Aviso(val id: String, val momento: LocalDateTime, val titulo: String, val mensaje: String)

    private fun inicio(fecha: LocalDate, hora: String): LocalDateTime? =
        runCatching { LocalDateTime.of(fecha, LocalTime.parse(hora)) }.getOrNull()

    /** Dueño: un día antes y dos horas antes de cada turno pendiente. */
    fun paraDueno(eventos: List<EventoMascota>, ahora: LocalDateTime = LocalDateTime.now()): List<Aviso> =
        eventos.filter { it.estado == EstadoTurno.PENDIENTE }.flatMap { e ->
            val comienzo = inicio(e.fecha, e.hora) ?: return@flatMap emptyList()
            val detalle = "${e.mascota}: ${e.categoria}" + e.veterinario.takeIf { it.isNotBlank() }?.let { " con $it" }.orEmpty()
            listOf(
                Aviso("${e.id}-dia", comienzo.minusHours(24), "Mañana tenés un turno", "$detalle, mañana a las ${e.hora} hs"),
                Aviso("${e.id}-horas", comienzo.minusHours(2), "Tu turno es en 2 horas", "$detalle, hoy a las ${e.hora} hs")
            )
        }.filter { it.momento.isAfter(ahora) }

    /** Una vacuna con próxima dosis cargada. */
    class VacunaProxima(val id: String, val mascota: String, val vacuna: String, val proxima: LocalDate)

    /** Una medicación en curso: toma cada [cadaHoras] desde [inicio] durante [dias]. */
    class Medicacion(
        val id: String, val mascota: String, val medicamento: String, val dosis: String,
        val cadaHoras: Int, val inicio: LocalDateTime, val dias: Int
    )

    private val HORA_DE_AVISO = LocalTime.of(10, 0)

    /**
     * Dueño: una semana antes y el día de cada próxima dosis, y un solo aviso (a las 10) por cada vacuna que ya
     * venció. [yaAvisadas] son los avisos de vencida que ya se mostraron.
     */
    fun paraVacunas(
        vacunas: List<VacunaProxima>, ahora: LocalDateTime = LocalDateTime.now(), yaAvisadas: Set<String> = emptySet()
    ): List<Aviso> {
        val hoy = ahora.toLocalDate()
        return vacunas.flatMap { v ->
            val fecha = Fechas.corta(v.proxima)
            val avisos = mutableListOf(
                Aviso(
                    "${v.id}-vac-semana", v.proxima.minusDays(7).atTime(HORA_DE_AVISO), "Se acerca una vacuna",
                    "${v.mascota}: ${v.vacuna} le toca el $fecha (en una semana)"
                ),
                Aviso(
                    "${v.id}-vac-dia", v.proxima.atTime(HORA_DE_AVISO), "Hoy toca una vacuna",
                    "${v.mascota}: ${v.vacuna}. Sacá un turno para aplicarla"
                )
            )
            if (v.proxima.isBefore(hoy) && v.proxima.isAfter(hoy.minusDays(DIAS_PARA_AVISAR_VENCIDAS))) {
                val id = "${v.id}-vac-vencida-${v.proxima}"
                if (id !in yaAvisadas) {
                    val dia = if (ahora.toLocalTime().isBefore(HORA_DE_AVISO)) hoy else hoy.plusDays(1)
                    avisos.add(
                        Aviso(
                            id, dia.atTime(HORA_DE_AVISO), "Vacuna vencida",
                            "${v.mascota}: ${v.vacuna} está vencida desde el $fecha. Sacá un turno para ponerla al día"
                        )
                    )
                }
            }
            avisos
        }.filter { it.momento.isAfter(ahora) }
    }

    private const val DIAS_PARA_AVISAR_VENCIDAS = 90L

    /** Dueño: las tomas de los próximos dos días de cada medicación indicada por el veterinario. */
    fun paraMedicacion(
        medicaciones: List<Medicacion>, ahora: LocalDateTime = LocalDateTime.now(), maximo: Int = 48
    ): List<Aviso> = medicaciones.flatMap { m ->
        if (m.cadaHoras <= 0) return@flatMap emptyList()
        val fin = m.inicio.plusDays(m.dias.toLong())
        val limite = ahora.plusHours(48)
        val pasadas = Duration.between(m.inicio, ahora).toMinutes().coerceAtLeast(0)
        val paso = m.cadaHoras * 60L
        var t = m.inicio.plusMinutes(((pasadas + paso - 1) / paso) * paso)
        if (!t.isAfter(ahora)) t = t.plusMinutes(paso)
        val tomas = mutableListOf<Aviso>()
        while (t.isBefore(fin) && t.isBefore(limite) && tomas.size < maximo) {
            val detalle = m.medicamento + m.dosis.takeIf { it.isNotBlank() }?.let { " ($it)" }.orEmpty()
            tomas.add(Aviso("${m.id}-dosis-${t.toLocalDate()}-${t.hour}-${t.minute}", t, "Hora de la medicación", "${m.mascota}: $detalle"))
            t = t.plusMinutes(paso)
        }
        tomas
    }.sortedBy { it.momento }.take(maximo)

    /** Veterinario: el resumen de las 8 de cada día con turnos y una hora antes de cada turno pendiente. */
    fun paraVeterinario(eventos: List<EventoVet>, ahora: LocalDateTime = LocalDateTime.now()): List<Aviso> {
        val pendientes = eventos.filter { it.estado == EstadoEvento.PENDIENTE }
        val porHora = pendientes.flatMap { e ->
            val comienzo = inicio(e.fecha, e.hora) ?: return@flatMap emptyList()
            val paciente = PacientesRepo.nombreDe(e.pacienteId)
            listOf(Aviso("${e.id}-hora", comienzo.minusHours(1), "Próximo turno en 1 hora", "$paciente · ${e.motivo} a las ${e.hora} hs"))
        }
        val resumenes = pendientes.groupBy { it.fecha }.map { (fecha, turnos) ->
            val cantidad = turnos.size
            Aviso(
                "dia-$fecha", fecha.atTime(8, 0), "Tu agenda de hoy",
                if (cantidad == 1) "Tenés 1 turno hoy" else "Tenés $cantidad turnos hoy"
            )
        }
        return (porHora + resumenes).filter { it.momento.isAfter(ahora) }
    }

    /** Reemplaza los recordatorios programados por [avisos]. */
    fun programar(contexto: Context, avisos: List<Aviso>, ahora: LocalDateTime = LocalDateTime.now()) {
        runCatching {
            val trabajos = WorkManager.getInstance(contexto)
            trabajos.cancelAllWorkByTag(ETIQUETA)
            val zona = ZoneId.systemDefault()
            avisos.forEach { aviso ->
                val espera = Duration.between(ahora.atZone(zona), aviso.momento.atZone(zona)).toMillis().coerceAtLeast(0)
                val datos = Data.Builder()
                    .putInt(RecordatorioWorker.ID, aviso.id.hashCode())
                    .putString(RecordatorioWorker.CLAVE, aviso.id)
                    .putString(RecordatorioWorker.TITULO, aviso.titulo)
                    .putString(RecordatorioWorker.MENSAJE, aviso.mensaje)
                    .build()
                trabajos.enqueue(
                    OneTimeWorkRequestBuilder<RecordatorioWorker>()
                        .setInitialDelay(espera, TimeUnit.MILLISECONDS)
                        .setInputData(datos)
                        .addTag(ETIQUETA)
                        .build()
                )
            }
        }
    }

    /** Revisa cada tanto si hay avisos nuevos del servidor mientras la app está cerrada (el mínimo de Android es 15 min). */
    fun vigilarAvisos(contexto: Context) {
        runCatching {
            WorkManager.getInstance(contexto).enqueueUniquePeriodicWork(
                TRABAJO_AVISOS, ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<AvisosPendientesWorker>(15, TimeUnit.MINUTES).build()
            )
        }
    }

    /** Cancela todo al cerrar la sesión: la cuenta que sigue no tiene que recibir los avisos de la anterior. */
    fun cancelarTodo(contexto: Context) {
        runCatching {
            val trabajos = WorkManager.getInstance(contexto)
            trabajos.cancelAllWorkByTag(ETIQUETA)
            trabajos.cancelUniqueWork(TRABAJO_AVISOS)
        }
    }
}

/** Muestra un recordatorio programado. */
class RecordatorioWorker(contexto: Context, parametros: WorkerParameters) : CoroutineWorker(contexto, parametros) {

    override suspend fun doWork(): Result {
        val titulo = inputData.getString(TITULO) ?: return Result.success()
        val mensaje = inputData.getString(MENSAJE).orEmpty()
        AvisosDelSistema.mostrar(
            applicationContext, inputData.getInt(ID, 0), titulo, mensaje, AvisosDelSistema.CANAL_RECORDATORIOS
        )
        // El aviso de vacuna vencida se da una sola vez: se anota cuando ya salió
        inputData.getString(CLAVE)?.takeIf { "-vac-vencida-" in it }
            ?.let { AvisosDelSistema.marcarVacunaAvisada(applicationContext, it) }
        return Result.success()
    }

    companion object {
        const val ID = "id"
        const val CLAVE = "clave"
        const val TITULO = "titulo"
        const val MENSAJE = "mensaje"
    }
}

/** Pide los avisos del servidor con la app cerrada y muestra los que todavía no se mostraron. */
class AvisosPendientesWorker(contexto: Context, parametros: WorkerParameters) : CoroutineWorker(contexto, parametros) {

    override suspend fun doWork(): Result = try {
        if (Servicios.fuente.restaurarSesion() != null) {
            AvisosDelSistema.mostrarNuevas(applicationContext, Servicios.fuente.notificaciones())
        }
        Result.success()
    } catch (e: Exception) {
        Result.retry()
    }
}
