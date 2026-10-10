package frgp.utn.edu.petcare.data.avisos

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import frgp.utn.edu.petcare.Fechas
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.data.remoto.NotificacionDto
import frgp.utn.edu.petcare.ui.auth.AuthActivity
import frgp.utn.edu.petcare.ui.common.Avisos
import java.time.Duration
import java.time.LocalDateTime

/**
 * Las notificaciones que el teléfono muestra fuera de la app: avisos del servidor (turno nuevo, cambio,
 * cancelación, turno finalizado) y recordatorios de que se acerca un turno.
 */
object AvisosDelSistema {

    const val CANAL_AVISOS = "avisos"
    const val CANAL_RECORDATORIOS = "recordatorios"

    private const val ARCHIVO = "petcare_avisos_sistema"
    private const val CLAVE_VISTOS = "vistos"
    private const val MAXIMO_VISTOS = 300

    /** Solo se avisa de lo que pasó en las últimas horas: lo más viejo ya lo vio el usuario dentro de la app. */
    private val ANTIGUEDAD_MAXIMA = Duration.ofHours(24)

    fun crearCanales(contexto: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val gestor = contexto.getSystemService(NotificationManager::class.java) ?: return
        gestor.createNotificationChannel(
            NotificationChannel(CANAL_AVISOS, "Avisos de turnos", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Turnos nuevos, cambios, cancelaciones y turnos finalizados"
            }
        )
        gestor.createNotificationChannel(
            NotificationChannel(CANAL_RECORDATORIOS, "Recordatorios", NotificationManager.IMPORTANCE_HIGH).apply {
                description = "Aviso cuando se acerca la fecha de un turno"
            }
        )
    }

    /** True si el usuario permitió las notificaciones (en Android 13 o más hay que pedirlo). */
    fun permitido(contexto: Context): Boolean {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(contexto, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return false
        return NotificationManagerCompat.from(contexto).areNotificationsEnabled()
    }

    @SuppressLint("MissingPermission")
    fun mostrar(contexto: Context, id: Int, titulo: String, mensaje: String, canal: String = CANAL_AVISOS) {
        if (!permitido(contexto)) return
        crearCanales(contexto)
        val abrir = Intent(contexto, AuthActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        val destino = PendingIntent.getActivity(
            contexto, id, abrir, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        val notificacion = NotificationCompat.Builder(contexto, canal)
            .setSmallIcon(R.drawable.ic_notifications)
            .setContentTitle(titulo)
            .setContentText(mensaje)
            .setStyle(NotificationCompat.BigTextStyle().bigText(mensaje))
            .setColor(ContextCompat.getColor(contexto, R.color.primary_teal))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setContentIntent(destino)
            .build()
        runCatching { NotificationManagerCompat.from(contexto).notify(id, notificacion) }
    }

    private fun preferencias(contexto: Context) = contexto.getSharedPreferences(ARCHIVO, Context.MODE_PRIVATE)

    private fun vistos(contexto: Context): MutableSet<String> =
        preferencias(contexto).getStringSet(CLAVE_VISTOS, emptySet())!!.toMutableSet()

    private fun guardarVistos(contexto: Context, ids: Set<String>) {
        // Se conservan solo los últimos para que la lista no crezca sin límite
        val recortados = if (ids.size > MAXIMO_VISTOS) ids.toList().takeLast(MAXIMO_VISTOS).toSet() else ids
        preferencias(contexto).edit().putStringSet(CLAVE_VISTOS, recortados).apply()
    }

    /**
     * Avisa de las notificaciones del servidor que todavía no se mostraron. Con [silencioso] solo se marcan como
     * vistas (al iniciar sesión no tiene sentido sonar por lo que ya estaba). Con la app abierta se muestra un
     * aviso dentro de la pantalla en lugar de una notificación del sistema.
     */
    fun mostrarNuevas(contexto: Context, avisos: List<NotificacionDto>, silencioso: Boolean = false, ahora: LocalDateTime = LocalDateTime.now()) {
        val ya = vistos(contexto)
        val nuevos = avisos.filter { it.id !in ya }
        if (nuevos.isEmpty()) return
        guardarVistos(contexto, ya + nuevos.map { it.id })
        if (silencioso) return
        nuevos.filter { !it.leida && Duration.between(Fechas.instante(it.createdAt), ahora) <= ANTIGUEDAD_MAXIMA }
            .forEach { aviso ->
                if (Avisos.enPrimerPlano) {
                    Avisos.mostrar(null, "${aviso.titulo}: ${aviso.mensaje}")
                } else {
                    mostrar(contexto, aviso.id.hashCode(), aviso.titulo, aviso.mensaje, CANAL_AVISOS)
                }
            }
    }

    /** Olvida lo que se había mostrado (al cerrar sesión). */
    fun olvidar(contexto: Context) {
        preferencias(contexto).edit().clear().apply()
    }
}
