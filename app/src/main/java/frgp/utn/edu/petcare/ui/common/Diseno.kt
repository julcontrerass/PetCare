package frgp.utn.edu.petcare.ui.common

import android.view.View

/** Ayudas para el cálculo de diseño de las pantallas que cambian de contenido sin abrir otra actividad. */
object Diseno {

    /**
     * Tras el ingreso, en algunos teléfonos Android deja sin calcular el diseño de lo que se acaba de mostrar o de
     * llenar (queda vacío). Se pide el cálculo de nuevo de [vista] y de todo lo que la contiene.
     */
    fun forzar(vista: View?) {
        vista ?: return
        vista.post {
            var actual: View? = vista
            while (actual != null) {
                actual.forceLayout()
                actual = actual.parent as? View
            }
            vista.rootView.requestLayout()
        }
    }
}
