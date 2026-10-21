package frgp.utn.edu.petcare.ui.common

import android.view.View
import android.widget.TextView

/** Contador rojo de la campana: muestra la cantidad de avisos sin leer ("9+" a partir de diez). */
object Insignia {

    fun texto(cantidad: Int): String = if (cantidad > 9) "9+" else cantidad.toString()

    fun actualizar(vista: View?, cantidad: Int) {
        vista ?: return
        vista.visibility = if (cantidad > 0) View.VISIBLE else View.GONE
        if (vista is TextView && cantidad > 0) {
            vista.text = texto(cantidad)
            vista.contentDescription = if (cantidad == 1) "1 notificación sin leer" else "$cantidad notificaciones sin leer"
        }
    }
}
