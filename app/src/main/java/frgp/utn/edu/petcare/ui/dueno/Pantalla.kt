package frgp.utn.edu.petcare.ui.dueno

import android.view.View
import android.widget.TextView
import android.widget.Toast
import frgp.utn.edu.petcare.ui.common.Efectos

/**
 * Una sección de la app del dueño (inicio, mascotas, calendario...). Se dibuja dentro del contenedor de
 * [DuenoActivity] y navega a las demás a través de él.
 */
abstract class Pantalla(protected val host: DuenoActivity) {

    protected fun <T : View> vista(id: Int): T? = host.findViewById<T>(id)

    protected fun dp(valor: Int) = host.dp(valor)

    protected fun toast(texto: String) = Toast.makeText(host, texto, Toast.LENGTH_SHORT).show()

    protected fun toast(recurso: Int) = Toast.makeText(host, recurso, Toast.LENGTH_SHORT).show()

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
