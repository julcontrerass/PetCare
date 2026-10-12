package frgp.utn.edu.petcare.ui.common

import android.app.Activity
import android.net.Uri
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.annotation.DrawableRes
import com.google.android.material.bottomsheet.BottomSheetDialog
import com.google.android.material.button.MaterialButton
import frgp.utn.edu.petcare.data.Imagenes
import frgp.utn.edu.petcare.R

/** Hoja inferior con una lista de opciones tocables (mascotas, veterinarios...). */
object HojaLista {

    /** Una opción de la lista; muestra la foto si hay una y, si no, el [icono]. */
    class Fila(
        val titulo: String,
        val subtitulo: String,
        @DrawableRes val icono: Int,
        val fotoUri: Uri? = null,
        val fotoPath: String? = null,
        val alTocar: () -> Unit
    )

    fun mostrar(
        actividad: Activity,
        titulo: String,
        subtitulo: String,
        filas: List<Fila>,
        textoPrincipal: String? = null,
        alPrincipal: () -> Unit = {}
    ): BottomSheetDialog {
        val hoja = BottomSheetDialog(actividad)
        val vista = actividad.layoutInflater.inflate(R.layout.sheet_lista, null)
        hoja.setContentView(vista)
        vista.findViewById<TextView>(R.id.tvListaTitulo).text = titulo
        vista.findViewById<TextView>(R.id.tvListaSubtitulo).text = subtitulo

        val contenedor = vista.findViewById<LinearLayout>(R.id.llListaItems)
        filas.forEach { fila ->
            contenedor.addView(crearFila(actividad, contenedor, fila, hoja))
        }

        vista.findViewById<MaterialButton>(R.id.btnListaPrincipal).apply {
            if (textoPrincipal != null) {
                visibility = View.VISIBLE
                text = textoPrincipal
                setOnClickListener {
                    hoja.dismiss()
                    alPrincipal()
                }
            }
        }
        vista.findViewById<View>(R.id.btnListaCerrar).setOnClickListener { hoja.dismiss() }
        hoja.show()
        return hoja
    }

    private fun crearFila(actividad: Activity, padre: ViewGroup, fila: Fila, hoja: BottomSheetDialog): View {
        val vista = actividad.layoutInflater.inflate(R.layout.item_detalle_paciente_resumen, padre, false)
        vista.findViewById<TextView>(R.id.tvTitle).text = fila.titulo
        vista.findViewById<TextView>(R.id.tvSubtitle).apply {
            text = fila.subtitulo
            maxLines = 2
        }
        val icono = vista.findViewById<ImageView>(R.id.ivIcon)
        icono.setImageResource(fila.icono)
        if (fila.fotoUri != null || !fila.fotoPath.isNullOrBlank()) {
            Imagenes.mostrar(icono, fila.fotoUri, fila.fotoPath) { hayFoto ->
                if (hayFoto) ocuparTodoElMarco(vista, icono)
            }
        }
        vista.setOnClickListener {
            hoja.dismiss()
            fila.alTocar()
        }
        return vista
    }

    /** La foto llena el recuadro (con las esquinas redondeadas) y sin el tinte que usan los íconos. */
    private fun ocuparTodoElMarco(fila: View, icono: ImageView) {
        val marco = fila.findViewById<View>(R.id.cvIcon)
        marco.clipToOutline = true
        icono.imageTintList = null
        icono.scaleType = ImageView.ScaleType.CENTER_CROP
        icono.layoutParams = FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT
        )
    }
}
