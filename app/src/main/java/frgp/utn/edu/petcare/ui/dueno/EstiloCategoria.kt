package frgp.utn.edu.petcare.ui.dueno

import frgp.utn.edu.petcare.R

/** Ícono y colores con los que se muestra cada categoría de evento. */
object EstiloCategoria {

    fun icono(categoria: String?): Int {
        val c = categoria?.lowercase() ?: return R.drawable.ic_calendar
        if (categoria != null && frgp.utn.edu.petcare.data.CatalogoMedico.TODAS.contains(categoria)) {
            return servicio(categoria).icono
        }
        return when {
            c.contains("vacuna") -> R.drawable.ic_syringe
            c.contains("cirug") || c.contains("castraci") -> R.drawable.ic_cirugia
            c.contains("chequeo") || c.contains("control") -> R.drawable.ic_medical_kit
            c.contains("estudio") || c.contains("tratamiento") || c.contains("laboratorio") ||
                c.contains("tomograf") || c.contains("cardio") || c.contains("neuro") -> R.drawable.ic_pulse
            c.contains("peluquer") -> R.drawable.ic_dog
            else -> R.drawable.ic_calendar
        }
    }

    /** Color de fondo del ícono. */
    fun fondo(categoria: String?): Int {
        val c = categoria?.lowercase() ?: return R.color.icon_teal_bg
        if (categoria != null && frgp.utn.edu.petcare.data.CatalogoMedico.TODAS.contains(categoria)) {
            return servicio(categoria).fondo
        }
        return when {
            c.contains("vacuna") -> R.color.icon_green_bg
            c.contains("control") || c.contains("consulta") || c.contains("chequeo") -> R.color.icon_blue_bg
            c.contains("cirug") || c.contains("castraci") -> R.color.icon_pink_bg
            c.contains("desparasit") -> R.color.icon_orange_bg
            else -> R.color.icon_purple_bg
        }
    }

    /** Color del ícono. */
    fun colorIcono(categoria: String?): Int {
        val c = categoria?.lowercase() ?: return R.color.primary_teal
        if (categoria != null && frgp.utn.edu.petcare.data.CatalogoMedico.TODAS.contains(categoria)) {
            return servicio(categoria).color
        }
        return when {
            c.contains("vacuna") -> R.color.success_green
            c.contains("control") || c.contains("consulta") || c.contains("chequeo") -> R.color.primary_teal
            c.contains("cirug") || c.contains("castraci") -> R.color.danger_red
            c.contains("desparasit") -> R.color.accent_orange
            else -> R.color.accent_purple
        }
    }

    /** Ícono y colores con los que se presenta un servicio o una especialidad médica al elegirla. */
    class EstiloServicio(val icono: Int, val fondo: Int, val color: Int)

    fun servicio(nombre: String): EstiloServicio {
        val verde = EstiloServicio(0, R.color.icon_green_bg, R.color.success_green)
        val azul = EstiloServicio(0, R.color.icon_blue_bg, R.color.primary_teal)
        val rojo = EstiloServicio(0, R.color.icon_pink_bg, R.color.danger_red)
        val violeta = EstiloServicio(0, R.color.icon_purple_bg, R.color.accent_purple)
        val naranja = EstiloServicio(0, R.color.icon_orange_bg, R.color.accent_orange)
        val teal = EstiloServicio(0, R.color.icon_teal_bg, R.color.primary_teal)
        fun con(base: EstiloServicio, icono: Int) = EstiloServicio(icono, base.fondo, base.color)
        return when (nombre) {
            "Chequeo médico integral" -> con(azul, R.drawable.ic_medical_kit)
            "Castraciones y limpieza dental" -> con(rojo, R.drawable.ic_medical)
            "Cirugía 24hs" -> con(rojo, R.drawable.ic_cirugia)
            "Laboratorio y diagnóstico por imágenes" -> con(violeta, R.drawable.ic_science)
            "Tomografía" -> con(violeta, R.drawable.ic_activity)
            "Baño y peluquería" -> con(naranja, R.drawable.ic_drop)
            "Oncología" -> con(rojo, R.drawable.ic_medical)
            "Cardiología" -> con(rojo, R.drawable.ic_favorite)
            "Fisioterapia" -> con(teal, R.drawable.ic_activity)
            "Gastroenterología" -> con(naranja, R.drawable.ic_nutrition)
            "Nutrición" -> con(verde, R.drawable.ic_nutrition)
            "Dermatología" -> con(teal, R.drawable.ic_medical)
            "Exóticos" -> con(naranja, R.drawable.ic_dog)
            "Oftalmología" -> con(azul, R.drawable.ic_eye)
            "Nefrourología" -> con(azul, R.drawable.ic_drop)
            "Endocrinología" -> con(violeta, R.drawable.ic_pulse)
            "Neurología" -> con(violeta, R.drawable.ic_activity)
            "Homeopatía" -> con(verde, R.drawable.ic_nutrition)
            "Medicina felina" -> con(teal, R.drawable.ic_dog)
            "Hematología" -> con(rojo, R.drawable.ic_drop)
            "Parasitología" -> con(naranja, R.drawable.ic_syringe)
            "Neumonología" -> con(azul, R.drawable.ic_pulse)
            "Medicina del dolor" -> con(naranja, R.drawable.ic_medical_kit)
            else -> EstiloServicio(icono(nombre), fondo(nombre), colorIcono(nombre))
        }
    }

    class EstiloTurno(val icono: Int, val fondo: Int, val color: Int)

    /** Estilo del encabezado de la ficha de un turno. */
    fun turno(categoria: String): EstiloTurno {
        val c = categoria.lowercase()
        return when {
            c.contains("vacuna") -> EstiloTurno(R.drawable.ic_syringe, R.drawable.bg_icon_teal, R.color.primary_teal)
            c.contains("control") || c.contains("chequeo") ->
                EstiloTurno(R.drawable.ic_pulse, R.drawable.bg_icon_teal, R.color.primary_teal)
            c.contains("cirug") || c.contains("castraci") ->
                EstiloTurno(R.drawable.ic_cirugia, R.drawable.bg_icon_orange, R.color.accent_orange)
            else -> EstiloTurno(R.drawable.ic_activity, R.drawable.bg_icon_purple, R.color.accent_purple)
        }
    }
}
