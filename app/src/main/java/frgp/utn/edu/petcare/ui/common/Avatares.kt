package frgp.utn.edu.petcare.ui.common

import android.view.View
import android.widget.ImageView
import com.google.android.material.imageview.ShapeableImageView
import com.google.android.material.shape.RelativeCornerSize
import com.google.android.material.shape.ShapeAppearanceModel
import frgp.utn.edu.petcare.R
import frgp.utn.edu.petcare.data.Imagenes
import frgp.utn.edu.petcare.data.repositorio.DuenoRepo

/** Fotos de perfil de las personas que aparecen en las listas: el veterinario para el dueño y el dueño para el veterinario. */
object Avatares {

    /** Foto de perfil en [imagen]; mientras no llega (o si no hay) queda el avatar por defecto. */
    fun mostrar(imagen: ImageView?, fotoPath: String?) {
        imagen ?: return
        imagen.setImageResource(R.drawable.avatar_default)
        Imagenes.mostrar(imagen, null, fotoPath)
    }

    /**
     * Foto de perfil en [imagen] con [respaldo] (por ejemplo una inicial o un ícono) para cuando no hay foto:
     * se ve uno u otro, nunca los dos.
     */
    fun conRespaldo(imagen: ImageView?, fotoPath: String?, respaldo: View?) {
        imagen ?: return
        imagen.visibility = View.GONE
        respaldo?.visibility = View.VISIBLE
        Imagenes.mostrar(imagen, null, fotoPath) { hayFoto ->
            imagen.visibility = if (hayFoto) View.VISIBLE else View.GONE
            respaldo?.visibility = if (hayFoto) View.GONE else View.VISIBLE
        }
    }

    /** Foto del veterinario con ese id, tal como la ve el dueño en su catálogo. */
    fun veterinario(imagen: ImageView?, veterinarioId: String?) =
        mostrar(imagen, DuenoRepo.perfilDeVeterinario(veterinarioId)?.fotoPath)

    /** Foto del veterinario de un turno; si el turno no tiene veterinario asignado la vista se oculta. */
    fun deEvento(imagen: ImageView?, veterinarioId: String?) {
        imagen ?: return
        if (veterinarioId == null) {
            imagen.visibility = View.GONE
            return
        }
        imagen.visibility = View.VISIBLE
        veterinario(imagen, veterinarioId)
    }

    /** Un [ShapeableImageView] redondo, para los lugares donde las filas se arman por código. */
    fun redonda(imagen: ShapeableImageView): ShapeableImageView {
        imagen.scaleType = ImageView.ScaleType.CENTER_CROP
        imagen.shapeAppearanceModel = ShapeAppearanceModel.builder().setAllCornerSizes(RelativeCornerSize(0.5f)).build()
        return imagen
    }
}
