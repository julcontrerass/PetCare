package frgp.utn.edu.petcare.ui.dueno

import frgp.utn.edu.petcare.ui.common.Avisos
import android.view.Gravity
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.core.content.ContextCompat
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.data.DuenoRepo
import frgp.utn.edu.petcare.ui.common.TarjetaAviso

/** Lista de notificaciones del dueño en un diálogo. */
class NotificacionesDialogo(private val host: DuenoActivity) {

    private fun dp(valor: Int) = host.dp(valor)

    fun mostrar() {
        val lista = DuenoRepo.notificaciones
        // Las que todavía no se vieron se marcan en la lista y recién después se dan por leídas
        val noLeidas = lista.filter { !it.leida }.toSet()
        DuenoRepo.marcarNotificacionesLeidas()
        host.actualizarBadgeNotificaciones()
        val contenido = LinearLayout(host).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(20), dp(16), dp(20), dp(16))
        }
        if (lista.isEmpty()) {
            contenido.addView(TextView(host).apply {
                text = "No tenés notificaciones."
                setTextColor(ContextCompat.getColor(host, R.color.text_gray))
                setPadding(0, dp(16), 0, dp(16))
                gravity = Gravity.CENTER
            })
        } else {
            lista.forEach {
                contenido.addView(TarjetaAviso.crear(host, it.tipo, it.titulo, it.mensaje, it.creada, it in noLeidas))
            }
        }

        val constructor = AlertDialog.Builder(host)
            .setTitle("Notificaciones")
            .setView(ScrollView(host).apply { addView(contenido) })
            .setPositiveButton("Cerrar") { dialogo, _ -> dialogo.dismiss() }
        if (lista.isNotEmpty()) {
            constructor.setNeutralButton("Limpiar notificaciones") { _, _ ->
                DuenoRepo.limpiarNotificaciones()
                host.actualizarBadgeNotificaciones()
                Avisos.mostrar(host, "Notificaciones borradas")
            }
        }
        val dialogo = constructor.create()
        dialogo.show()
        dialogo.window?.setBackgroundDrawable(ContextCompat.getDrawable(host, R.drawable.bg_dialog_rounded))
    }
}
