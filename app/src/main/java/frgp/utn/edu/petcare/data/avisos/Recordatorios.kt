package frgp.utn.edu.petcare.data.avisos

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import frgp.utn.edu.petcare.EstadoEvento
import frgp.utn.edu.petcare.EventoVet
import frgp.utn.edu.petcare.PacientesRepo
import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.model.EstadoTurno
import frgp.utn.edu.petcare.model.EventoMascota
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
        return Result.success()
    }

    companion object {
        const val ID = "id"
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
