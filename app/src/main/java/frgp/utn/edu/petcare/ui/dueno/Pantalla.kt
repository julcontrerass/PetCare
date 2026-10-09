package frgp.utn.edu.petcare.ui.dueno

import android.view.View
import frgp.utn.edu.petcare.ui.common.Avisos
import android.widget.TextView
import frgp.utn.edu.petcare.ui.common.Efectos

/**
 * Una sección de la app del dueño (inicio, mascotas, calendario...). Se dibuja dentro del contenedor de
 * [DuenoActivity] y navega a las demás a través de él.
 */
abstract class Pantalla(protected val host: DuenoActivity) {

    protected fun <T : View> vista(id: Int): T? = host.findViewById<T>(id)

    protected fun dp(valor: Int) = host.dp(valor)

    protected fun toast(texto: String) = Avisos.mostrar(host, texto)

    protected fun toast(recurso: Int) = Avisos.mostrar(host, recurso)

    protected fun alTocar(id: Int, accion: (View) -> Unit) {
        vista<View>(id)?.setOnClickListener(accion)
    }

    /** Igual que [alTocar] pero con un pequeño rebote del botón. */
    protected fun alTocarConRebote(id: Int, accion: (View) -> Unit) {
        vista<View>(id)?.setOnClickListener {
            Efectos.rebote(it)
            accion(it)
        }
    }

    protected fun texto(id: Int, valor: String) {
        vista<TextView>(id)?.text = valor
    }
}
