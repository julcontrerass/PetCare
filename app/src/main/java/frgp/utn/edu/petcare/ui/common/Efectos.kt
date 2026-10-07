package frgp.utn.edu.petcare.ui.common

import android.view.View
import android.view.animation.DecelerateInterpolator
import android.view.animation.OvershootInterpolator

/** Animaciones cortas que se repiten en la interfaz. */
object Efectos {

    /** Pequeño "rebote" al tocar un botón. */
    fun rebote(vista: View?) {
        vista ?: return
        vista.animate().cancel()
        vista.scaleX = 0.92f
        vista.scaleY = 0.92f
        vista.animate().scaleX(1f).scaleY(1f).setDuration(220).setInterpolator(OvershootInterpolator(4f)).start()
    }

    /** Aparece desde abajo, para cuando cambia el paso de un asistente. */
    fun entradaDePaso(vista: View?, desplazamientoPx: Int) {
        vista ?: return
        vista.animate().cancel()
        vista.alpha = 0f
        vista.translationY = desplazamientoPx.toFloat()
        vista.animate().alpha(1f).translationY(0f).setDuration(280).setInterpolator(DecelerateInterpolator()).start()
    }
}
