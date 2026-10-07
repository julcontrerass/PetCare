package frgp.utn.edu.petcare

import android.app.Activity
import android.net.Uri
import android.widget.ImageView
import android.view.ViewGroup
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.updateLayoutParams
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
     * Deja la barra de estado con íconos oscuros y evita que el contenido quede debajo de las barras del sistema.
     * Con [conPadding] en false solo cambia el color de los íconos (para pantallas con encabezado de color).
     */
    fun barras(activity: Activity, conPadding: Boolean = true, iconosOscuros: Boolean = true) {
        WindowCompat.getInsetsController(activity.window, activity.window.decorView)
            .isAppearanceLightStatusBars = iconosOscuros
        if (!conPadding) return
        val raiz = (activity.findViewById<ViewGroup>(android.R.id.content)).getChildAt(0) ?: return
        // La barra inferior del veterinario se acomoda sola sobre los botones de navegación del sistema
        val barraInferior = activity.findViewById<android.view.View>(R.id.bottomNavContainer)
        val tieneBarraInferior = barraInferior != null
        if (barraInferior != null) {
            // La barra de íconos ya suma el espacio de los botones del sistema; el botón central también debe subir
            val fab = activity.findViewById<android.view.View>(R.id.fabCenter)
            val margenFab = (fab?.layoutParams as? ViewGroup.MarginLayoutParams)?.bottomMargin ?: 0
            ViewCompat.setOnApplyWindowInsetsListener(barraInferior) { vista, insets ->
                val barras = insets.getInsets(WindowInsetsCompat.Type.systemBars())
                fab?.updateLayoutParams<ViewGroup.MarginLayoutParams> { bottomMargin = margenFab + barras.bottom }
                insets
            }
            ViewCompat.requestApplyInsets(barraInferior)
        }
        ViewCompat.setOnApplyWindowInsetsListener(raiz) { vista, insets ->
            val barras = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            val teclado = insets.getInsets(WindowInsetsCompat.Type.ime())
            // Arriba la barra de estado; abajo los botones de navegación del sistema o el teclado
            val abajo = if (tieneBarraInferior) 0 else maxOf(barras.bottom, teclado.bottom)
            vista.updatePadding(top = barras.top, bottom = abajo)
            insets
        }
        ViewCompat.requestApplyInsets(raiz)
    }
}
