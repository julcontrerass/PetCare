package frgp.utn.edu.petcare

import android.net.Uri
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat
import java.io.File
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.temporal.ChronoUnit

/** Textos, colores e íconos que comparten las pantallas del administrador. */
object AdminUi {

    data class Estilo(val texto: String, val fondo: Int, val color: Int)

    fun estiloVet(estado: String) = when (estado) {
        AdminRepo.PENDIENTE -> Estilo("En revisión", R.drawable.bg_chip_warn, R.color.accent_orange_dark)
        AdminRepo.ACTIVO -> Estilo("Activo", R.drawable.bg_chip_ok, R.color.success_green)
        AdminRepo.RECHAZADO -> Estilo("Rechazado", R.drawable.bg_chip_danger, R.color.danger_red)
        else -> Estilo("Suspendido", R.drawable.bg_chip_neutral, R.color.text_gray)
    }

    fun estiloDueno(estado: String) =
        if (estado == AdminRepo.SUSPENDIDO) Estilo("Suspendido", R.drawable.bg_chip_neutral, R.color.text_gray)
        else Estilo("Activo", R.drawable.bg_chip_ok, R.color.success_green)

    fun aplicar(chip: TextView, estilo: Estilo) {
        chip.text = estilo.texto
        chip.setBackgroundResource(estilo.fondo)
        chip.setTextColor(ContextCompat.getColor(chip.context, estilo.color))
    }

    /** Muestra la foto si existe; si no, las iniciales del nombre. */
    fun avatar(iniciales: TextView, foto: ImageView, nombre: String, fotoPath: String?) {
        val archivo = fotoPath?.let { File(it) }
        if (archivo != null && archivo.exists()) {
            foto.setImageURI(Uri.fromFile(archivo))
            foto.visibility = View.VISIBLE
            iniciales.visibility = View.GONE
        } else {
            foto.visibility = View.GONE
            iniciales.visibility = View.VISIBLE
            iniciales.text = AdminRepo.iniciales(nombre)
        }
    }

    fun cuando(f: LocalDateTime): String =
        "${Fechas.relativa(f.toLocalDate())} · %02d:%02d".format(f.hour, f.minute)

    fun hace(fecha: LocalDate): String {
        val dias = ChronoUnit.DAYS.between(fecha, LocalDate.now())
        return when {
            dias <= 0 -> "Hoy"
            dias == 1L -> "Ayer"
            else -> "Hace $dias días"
        }
    }

    /** Ícono y color de fondo del ícono según el tipo de actividad. */
    fun iconoActividad(tipo: TipoActividad): Pair<Int, Int> = when (tipo) {
        TipoActividad.REGISTRO -> R.drawable.ic_person to R.color.primary_teal
        TipoActividad.APROBACION -> R.drawable.ic_check_circle to R.color.success_green
        TipoActividad.RECHAZO -> R.drawable.ic_cancel to R.color.danger_red
        TipoActividad.SUSPENSION -> R.drawable.ic_lock to R.color.accent_orange_dark
        TipoActividad.REACTIVACION -> R.drawable.ic_check to R.color.success_green
    }

    /** Arma la fila de una actividad; se usa en el inicio y en la pestaña de actividad. */
    fun vistaActividad(inflater: LayoutInflater, padre: ViewGroup, a: ActividadAdmin): View {
        val vista = inflater.inflate(R.layout.item_admin_actividad, padre, false)
        enlazarActividad(vista, a)
        return vista
    }

    fun enlazarActividad(vista: View, a: ActividadAdmin) {
        val (icono, color) = iconoActividad(a.tipo)
        vista.findViewById<ImageView>(R.id.ivActividad).apply {
            setImageResource(icono)
            setColorFilter(ContextCompat.getColor(context, color))
        }
        vista.findViewById<TextView>(R.id.tvActividadTexto).text = a.texto
        vista.findViewById<TextView>(R.id.tvActividadCuando).text = cuando(a.cuando)
    }
}
