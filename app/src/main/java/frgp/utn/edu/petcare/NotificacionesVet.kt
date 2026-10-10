package frgp.utn.edu.petcare

import android.view.Gravity
import frgp.utn.edu.petcare.data.avisos.AvisosDelSistema
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.lifecycle.lifecycleScope
import frgp.utn.edu.petcare.data.Errores
import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.data.remoto.NotificacionDto
import frgp.utn.edu.petcare.model.TipoNotificacion
import frgp.utn.edu.petcare.ui.common.Avisos
import frgp.utn.edu.petcare.ui.common.TarjetaAviso
import kotlinx.coroutines.launch

/** Avisos del veterinario: turnos nuevos, cambios y cancelaciones, y solicitudes de acceso. */
object NotificacionesVet {

    private var ultimas: List<NotificacionDto> = emptyList()

    /** Hay avisos que el veterinario todavía no abrió (para el punto rojo de la campana). */
    val hayNuevas: Boolean get() = ultimas.any { !it.leida }

    fun limpiar() {
        ultimas = emptyList()
    }

    suspend fun cargar(silencioso: Boolean = false) {
        ultimas = Servicios.fuente.notificaciones()
        Servicios.contextoApp?.let { runCatching { AvisosDelSistema.mostrarNuevas(it, ultimas, silencioso) } }
    }

    fun mostrar(actividad: AppCompatActivity, alCambiar: () -> Unit = {}) {
        actividad.lifecycleScope.launch {
            try {
                cargar()
                val avisos = ultimas
                val noLeidas = avisos.filter { !it.leida }.map { it.id }.toSet()
                val dp = { valor: Int -> (valor * actividad.resources.displayMetrics.density).toInt() }
                val contenido = LinearLayout(actividad).apply {
                    orientation = LinearLayout.VERTICAL
                    setPadding(dp(20), dp(16), dp(20), dp(16))
                }
                if (avisos.isEmpty()) {
                    contenido.addView(TextView(actividad).apply {
                        text = "No tenés notificaciones."
                        setTextColor(ContextCompat.getColor(actividad, R.color.text_gray))
                        setPadding(0, dp(16), 0, dp(16))
                        gravity = Gravity.CENTER
                    })
                } else {
                    avisos.forEach {
                        contenido.addView(
                            TarjetaAviso.crear(
                                actividad, TipoNotificacion.deClave(it.tipo), it.titulo, it.mensaje,
                                Fechas.instante(it.createdAt), it.id in noLeidas
                            )
                        )
                    }
                }
                val dialogo = AlertDialog.Builder(actividad)
                    .setTitle("Notificaciones")
                    .setView(ScrollView(actividad).apply { addView(contenido) })
                    .setPositiveButton("Cerrar", null)
                if (avisos.isNotEmpty()) {
                    dialogo.setNeutralButton("Borrar todas") { _, _ ->
                        ultimas = emptyList()
                        Servicios.escribir { Servicios.fuente.borrarNotificaciones() }
                        alCambiar()
                        Avisos.exito(actividad, "Notificaciones borradas")
                    }
                    if (noLeidas.isNotEmpty()) {
                        ultimas = avisos.map { it.copy(leida = true) }
                        Servicios.escribir { Servicios.fuente.marcarNotificacionesLeidas() }
                        alCambiar()
                    }
                }
                val creado = dialogo.create()
                creado.show()
                creado.window?.setBackgroundDrawable(ContextCompat.getDrawable(actividad, R.drawable.bg_dialog_rounded))
            } catch (e: Exception) {
                Avisos.error(actividad, Errores.mensaje(e))
            }
        }
    }
}
