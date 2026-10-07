package frgp.utn.edu.petcare

import android.app.Activity
import android.net.Uri
import android.widget.ImageView
import android.view.ViewGroup
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updatePadding

/** Ajustes de pantalla compartidos por las vistas del veterinario. */
object VetUi {

    /** Muestra la foto del veterinario en sesión: la que subió o, si no hay, la de su perfil por defecto. */
    fun cargarFotoVet(imagen: ImageView?) {
        imagen ?: return
        val uri = PerfilVetRepo.fotoUriString
        if (!uri.isNullOrEmpty()) {
            try {
                imagen.setImageURI(Uri.parse(uri))
                return
            } catch (e: Exception) {
                // Si la imagen ya no está disponible se usa la de por defecto
            }
        }
        imagen.setImageResource(PerfilVetRepo.fotoRes)
    }

    /**
     * Deja la barra de estado con íconos oscuros y evita que el contenido quede debajo de ella.
     * Con [conPadding] en false solo cambia el color de los íconos (para pantallas con encabezado de color).
     */
    fun barras(activity: Activity, conPadding: Boolean = true, iconosOscuros: Boolean = true) {
        WindowCompat.getInsetsController(activity.window, activity.window.decorView)
            .isAppearanceLightStatusBars = iconosOscuros
        if (!conPadding) return
        val raiz = (activity.findViewById<ViewGroup>(android.R.id.content)).getChildAt(0) ?: return
        ViewCompat.setOnApplyWindowInsetsListener(raiz) { vista, insets ->
            val barras = insets.getInsets(WindowInsetsCompat.Type.statusBars())
            vista.updatePadding(top = barras.top)
            insets
        }
        ViewCompat.requestApplyInsets(raiz)
    }
}
