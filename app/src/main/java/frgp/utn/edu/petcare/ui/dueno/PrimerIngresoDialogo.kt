package frgp.utn.edu.petcare.ui.dueno

import android.widget.CheckBox
import android.widget.EditText
import android.widget.TextView
import androidx.appcompat.app.AlertDialog
import androidx.lifecycle.lifecycleScope
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.data.Errores
import frgp.utn.edu.petcare.data.Registro
import frgp.utn.edu.petcare.data.Servicios
import frgp.utn.edu.petcare.data.repositorio.DuenoRepo
import frgp.utn.edu.petcare.ui.common.Avisos
import kotlinx.coroutines.launch

/**
 * Primer ingreso de un dueño al que un veterinario le creó la cuenta: la contraseña con la que entró es temporal
 * (la conoce el veterinario), así que tiene que elegir una propia y aceptar los términos antes de seguir.
 */
class PrimerIngresoDialogo(private val host: DuenoActivity) {

    fun mostrar() {
        val vista = host.layoutInflater.inflate(R.layout.dialog_primer_ingreso, null)
        val nombre = DuenoRepo.perfil.primerNombre
        vista.findViewById<TextView>(R.id.tvPrimerIngresoTexto).text =
            (if (nombre.isNotBlank()) "Hola $nombre, " else "Hola, ") +
                "tu veterinario te creó esta cuenta con una contraseña temporal. " +
                "Elegí una propia para empezar a usarla."
        val etNueva = vista.findViewById<EditText>(R.id.etPrimerPassword)
        val etRepetida = vista.findViewById<EditText>(R.id.etPrimerPassword2)
        val cbTerminos = vista.findViewById<CheckBox>(R.id.cbPrimerTerminos)

        val dialogo = AlertDialog.Builder(host)
            .setTitle("Elegí tu contraseña")
            .setView(vista)
            .setCancelable(false)
            .setPositiveButton("Guardar", null)
            .setNegativeButton("Cerrar sesión", null)
            .create()
        dialogo.setOnShowListener {
            dialogo.getButton(AlertDialog.BUTTON_NEGATIVE).setOnClickListener {
                dialogo.dismiss()
                host.cerrarSesion()
            }
            val guardar = dialogo.getButton(AlertDialog.BUTTON_POSITIVE)
            guardar.setOnClickListener {
                val nueva = etNueva.text.toString()
                val error = when {
                    nueva.length < 6 -> "La contraseña debe tener al menos 6 caracteres"
                    nueva != etRepetida.text.toString() -> "Las contraseñas no coinciden"
                    !cbTerminos.isChecked -> "Tenés que aceptar los términos y condiciones"
                    else -> null
                }
                if (error != null) {
                    Avisos.mostrar(host, error)
                    return@setOnClickListener
                }
                guardar.isEnabled = false
                host.lifecycleScope.launch {
                    try {
                        Servicios.fuente.definirPassword(nueva)
                        Servicios.fuente.completarPrimerIngreso(Registro.VERSION_TERMINOS)
                        DuenoRepo.perfil.debeCambiarPassword = false
                        dialogo.dismiss()
                        Avisos.mostrar(host, "Listo, ya podés usar tu cuenta")
                    } catch (e: Exception) {
                        guardar.isEnabled = true
                        Avisos.error(host, Errores.mensaje(e))
                    }
                }
            }
        }
        dialogo.show()
    }
}
