package frgp.utn.edu.petcare.ui.dueno

import frgp.utn.edu.petcare.R

/** Ícono y colores con los que se muestra cada categoría de evento. */
object EstiloCategoria {

    fun icono(categoria: String?): Int {
        val c = categoria?.lowercase() ?: return R.drawable.ic_calendar
        return when {
            c.contains("vacuna") -> R.drawable.ic_syringe
            c.contains("control") -> R.drawable.ic_pencil
            c.contains("cirug") -> R.drawable.ic_cirugia
            c.contains("estudio") || c.contains("tratamiento") -> R.drawable.ic_pulse
            else -> R.drawable.ic_calendar
        }
    }

    /** Color de fondo del ícono. */
    fun fondo(categoria: String?): Int {
        val c = categoria?.lowercase() ?: return R.color.icon_teal_bg
        return when {
            c.contains("vacuna") -> R.color.icon_green_bg
            c.contains("control") || c.contains("consulta") -> R.color.icon_blue_bg
            c.contains("cirug") -> R.color.icon_pink_bg
            c.contains("desparasit") -> R.color.icon_orange_bg
            else -> R.color.icon_purple_bg
        }
    }

    /** Color del ícono. */
    fun colorIcono(categoria: String?): Int {
        val c = categoria?.lowercase() ?: return R.color.primary_teal
        return when {
            c.contains("vacuna") -> R.color.success_green
            c.contains("control") || c.contains("consulta") -> R.color.primary_teal
            c.contains("cirug") -> R.color.danger_red
            c.contains("desparasit") -> R.color.accent_orange
            else -> R.color.accent_purple
        }
    }

    class EstiloTurno(val icono: Int, val fondo: Int, val color: Int)

    /** Estilo del encabezado de la ficha de un turno. */
    fun turno(categoria: String): EstiloTurno = when (categoria) {
        "Vacuna" -> EstiloTurno(R.drawable.ic_syringe, R.drawable.bg_icon_teal, R.color.primary_teal)
        "Control" -> EstiloTurno(R.drawable.ic_pulse, R.drawable.bg_icon_teal, R.color.primary_teal)
        "Cirugía" -> EstiloTurno(R.drawable.ic_cirugia, R.drawable.bg_icon_orange, R.color.accent_orange)
        else -> EstiloTurno(R.drawable.ic_activity, R.drawable.bg_icon_purple, R.color.accent_purple)
    }
}
